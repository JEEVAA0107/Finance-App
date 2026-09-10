const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { sendSMS } = require('../utils/sms');
const { sendWhatsAppMessage } = require('../services/whatsappClient');
const prisma = new PrismaClient();

// round2 MUST be defined before any route that uses it
const round2 = (num) => Math.round(num * 100) / 100;

// POST /api/payments — Collect INTEREST payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { repaymentId, amount, paymentMode = 'CASH', reference, notes, penaltyAmount = 0 } = req.body;

    if (!repaymentId || !amount) {
      return res.status(400).json({ success: false, message: 'repaymentId and amount required' });
    }

    const repayment = await prisma.repayment.findUnique({
      where: { id: repaymentId },
      include: { loan: true },
    });

    if (!repayment) return res.status(404).json({ success: false, message: 'Repayment not found' });
    if (repayment.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Already fully paid' });
    }

    // ── Sequential Order Enforcement ──────────────────────────────────────────
    // Cannot collect installment #N if any earlier installment (#1 to #N-1) is not PAID or CARRIED_FORWARD
    if (repayment.installmentNo > 1) {
      const unpaidPrevious = await prisma.repayment.findFirst({
        where: {
          loanId: repayment.loanId,
          installmentNo: { lt: repayment.installmentNo },
          status: { notIn: ['PAID', 'CARRIED_FORWARD'] },
        },
        orderBy: { installmentNo: 'asc' },
      });
      if (unpaidPrevious) {
        return res.status(400).json({
          success: false,
          message: `முதலில் Installment #${unpaidPrevious.installmentNo} (Week ${unpaidPrevious.weekNo || '?'}, Status: ${unpaidPrevious.status}, ₹${(unpaidPrevious.dueAmount - unpaidPrevious.paidAmount).toLocaleString('en-IN')} pending) collect செய்யுங்கள் அல்லது Penalty செலுத்தி Carry Forward செய்யுங்கள்.`
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────


    const baseAmt = parseFloat(amount);
    const penaltyAmt = parseFloat(penaltyAmount) || 0;
    const totalCollectedAmt = baseAmt + penaltyAmt;

    const paymentType = (repayment.principal > 0 && repayment.interest > 0) ? 'EMI' : (repayment.principal > 0 ? 'PRINCIPAL' : 'INTEREST');

    const payment = await prisma.payment.create({
      data: {
        repaymentId,
        collectedById: req.user.id,
        amount: totalCollectedAmt,
        paymentMode,
        paymentType,
        reference,
        notes: penaltyAmt > 0 ? (notes ? `${notes} (Includes ₹${penaltyAmt} overdue interest/penalty)` : `Includes ₹${penaltyAmt} overdue interest/penalty`) : notes,
      },
    });

    const totalPaid = repayment.paidAmount + totalCollectedAmt;
    // For status check, compare against dueAmount + penaltyAmt so it only marks PAID if they cover everything
    const newStatus = totalPaid >= (repayment.dueAmount + penaltyAmt) ? 'PAID' : 'PARTIAL';

    const repUpdateData = {
      paidAmount: totalPaid,
      paidAt: newStatus === 'PAID' ? new Date() : null,
      status: newStatus,
    };
    if (penaltyAmt > 0) {
      repUpdateData.penaltyPaid = (repayment.penaltyPaid || 0) + penaltyAmt;
      repUpdateData.penaltyStatus = 'PAID';
    } else if (repayment.penaltyStatus === 'PENDING' && newStatus === 'PAID') {
      repUpdateData.penaltyStatus = 'WAIVED';
    }

    await prisma.repayment.update({
      where: { id: repaymentId },
      data: repUpdateData,
    });

    const dueAmt = repayment.dueAmount || 1;
    // Principal paid is proportional to the base amount only
    const principalPaid = baseAmt * (repayment.principal / dueAmt);
    // Interest paid is proportional to base amount PLUS the entire penalty
    const interestPaid = (baseAmt * (repayment.interest / dueAmt)) + penaltyAmt;

    await prisma.loan.update({
      where: { id: repayment.loanId },
      data: { 
        interestCollected: { increment: round2(interestPaid) },
        outstandingPrincipal: { decrement: round2(principalPaid) }
      },
    });

    // Auto-extend installments if running low
    if (newStatus === 'PAID') {
      const unpaidCount = await prisma.repayment.count({
        where: { loanId: repayment.loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      });
      if (unpaidCount < 4) {
        const loan = await prisma.loan.findUnique({ where: { id: repayment.loanId } });
        if (loan && loan.status === 'ACTIVE') {
          const lastInst = await prisma.repayment.findFirst({
            where: { loanId: repayment.loanId },
            orderBy: { installmentNo: 'desc' },
          });
          if (lastInst) {
            const interestPerPeriod = round2(loan.principalAmount * (loan.interestRate / 100));
            const batchSize = loan.tenureUnit === 'WEEKS' ? 52 : loan.tenureUnit === 'MONTHS' ? 12 : 365;
            const startNo = lastInst.installmentNo + 1;
            const startFrom = new Date(lastInst.dueDate);
            const newInstallments = [];
            for (let i = 0; i < batchSize; i++) {
              const dueDate = new Date(startFrom);
              const offset = i + 1;
              if (loan.tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
              else if (loan.tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
              else dueDate.setDate(dueDate.getDate() + offset);
              newInstallments.push({
                loanId: repayment.loanId,
                installmentNo: startNo + i,
                dueDate,
                dueAmount: interestPerPeriod,
                principal: 0,
                interest: interestPerPeriod,
                status: 'PENDING',
              });
            }
            await prisma.repayment.createMany({ data: newInstallments });
            await prisma.loan.update({
              where: { id: repayment.loanId },
              data: { tenure: startNo + batchSize - 1, endDate: newInstallments[newInstallments.length - 1].dueDate },
            });
          }
        }
      }
    }

    await auditLog(req.user.id, 'COLLECT_INTEREST', 'Payment', payment.id, { amount, paymentMode, type: 'INTEREST' }, req);

    // SMS and WhatsApp notification (async, non-blocking)
    try {
      const loanData = await prisma.loan.findUnique({
        where: { id: repayment.loanId },
        include: { customer: true },
      });
      
      const smsMessage = `Received amount: Rs. ${amount}. Your payment successfully with this ID: ${payment.id}.`;
      sendSMS(loanData.customer.phone, smsMessage);

      // WhatsApp Message
      const waMessage = `✅ *Payment Successful!*
      
Hello ${loanData.customer.name},
We have received your payment of *₹${amount}* for your loan (*${loanData.loanNumber}*).

*Installment:* #${repayment.installmentNo}
*Mode:* ${paymentMode}

Thank you for choosing LoanFlow Pro!`;
      
      sendWhatsAppMessage(loanData.customer.phone, waMessage);
    } catch (_) { /* SMS/WA failure should not block response */ }

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/penalty — Pay Penalty for Overdue Installment & Unlock Carry Forward
router.post('/penalty', authenticate, async (req, res) => {
  try {
    const { repaymentId, amount, paymentMode = 'CASH', reference, notes } = req.body;

    if (!repaymentId || !amount) {
      return res.status(400).json({ success: false, message: 'repaymentId and amount required' });
    }

    const repayment = await prisma.repayment.findUnique({
      where: { id: repaymentId },
      include: { loan: { include: { customer: true } } },
    });

    if (!repayment) return res.status(404).json({ success: false, message: 'Repayment not found' });
    if (repayment.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Installment is already fully paid' });
    }
    if (repayment.status === 'CARRIED_FORWARD') {
      return res.status(400).json({ success: false, message: 'Installment is already carried forward' });
    }

    const penaltyPaidAmt = parseFloat(amount);
    if (isNaN(penaltyPaidAmt) || penaltyPaidAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid penalty amount' });
    }

    // 1. Create Payment record with type 'PENALTY'
    const payment = await prisma.payment.create({
      data: {
        repaymentId: repayment.id,
        collectedById: req.user.id,
        amount: penaltyPaidAmt,
        paymentMode,
        paymentType: 'PENALTY',
        reference,
        notes: notes ? `Penalty Paid (Carry Forward): ${notes}` : `Penalty Paid - Installment #${repayment.installmentNo} Carried Forward`,
        collectedAt: new Date(),
      },
    });

    // 2. Find the last installment of the loan to append the carried-forward installment
    const lastInstallment = await prisma.repayment.findFirst({
      where: { loanId: repayment.loanId },
      orderBy: { installmentNo: 'desc' },
    });

    const nextInstNo = (lastInstallment ? lastInstallment.installmentNo : repayment.installmentNo) + 1;
    const isDaily = repayment.dayNo != null || repayment.loan.tenureUnit === 'DAYS';

    let newDueDate = new Date(lastInstallment ? lastInstallment.dueDate : repayment.dueDate);
    let newWeekNo, newDayNo;

    if (isDaily) {
      newDueDate.setDate(newDueDate.getDate() + 1);
      newWeekNo = Math.floor((nextInstNo - 1) / 7) + 1;
      newDayNo = ((nextInstNo - 1) % 7) + 1;
    } else if (repayment.loan.tenureUnit === 'WEEKS') {
      newDueDate.setDate(newDueDate.getDate() + 7);
      newWeekNo = (lastInstallment && lastInstallment.weekNo ? lastInstallment.weekNo : (repayment.weekNo || 1)) + 1;
      newDayNo = 1;
    } else {
      newDueDate.setMonth(newDueDate.getMonth() + 1);
      newWeekNo = (lastInstallment && lastInstallment.weekNo ? lastInstallment.weekNo : (repayment.weekNo || 1)) + 1;
      newDayNo = 1;
    }

    const remainingDue = round2(Math.max(0, repayment.dueAmount - repayment.paidAmount));

    // 3. Create the carried-forward installment at the end of the loan schedule
    const newRepayment = await prisma.repayment.create({
      data: {
        loanId: repayment.loanId,
        installmentNo: nextInstNo,
        weekNo: newWeekNo,
        dayNo: newDayNo,
        dueDate: newDueDate,
        originalDueDate: newDueDate,
        dueAmount: remainingDue,
        principal: repayment.principal,
        interest: repayment.interest,
        penaltyAmount: 0,
        penaltyPaid: 0,
        penaltyStatus: 'NONE',
        status: 'PENDING',
      },
    });

    // 4. Update the current repayment to CARRIED_FORWARD with penalty paid
    await prisma.repayment.update({
      where: { id: repayment.id },
      data: {
        status: 'CARRIED_FORWARD',
        penaltyPaid: penaltyPaidAmt,
        penaltyStatus: 'PAID',
        carriedToInstNo: nextInstNo,
      },
    });

    // 5. Update loan tenure, endDate, and interestCollected (penalties add to collected revenue)
    await prisma.loan.update({
      where: { id: repayment.loanId },
      data: {
        endDate: newDueDate,
        tenure: Math.max(repayment.loan.tenure || 0, nextInstNo),
        interestCollected: { increment: round2(penaltyPaidAmt) },
      },
    });

    await auditLog(req.user.id, 'COLLECT_PENALTY_CARRY_FORWARD', 'Payment', payment.id, {
      amount: penaltyPaidAmt,
      originalRepaymentId: repayment.id,
      installmentNo: repayment.installmentNo,
      weekNo: repayment.weekNo,
      carriedToInstNo: nextInstNo,
      newWeekNo,
      newDueDate,
    }, req);

    // 6. Non-blocking notifications
    try {
      const phone = repayment.loan.customer.phone;
      const name = repayment.loan.customer.name;
      const loanNum = repayment.loan.loanNumber;

      const sms = `Penalty of Rs.${penaltyPaidAmt} received for ${loanNum} Inst #${repayment.installmentNo}. Unpaid balance Rs.${remainingDue} carried forward to Week ${newWeekNo} (Inst #${nextInstNo}).`;
      sendSMS(phone, sms);

      const waMessage = `⚠️ *Penalty Paid & Carry Forward Activated*

Hello ${name},
Your penalty payment of *₹${penaltyPaidAmt}* for loan *${loanNum}* (Installment #${repayment.installmentNo}, Week ${repayment.weekNo || '?'}) has been recorded.

✅ *Status:* Carried Forward to Week ${newWeekNo} (Installment #${nextInstNo})
📅 *New Due Date:* ${newDueDate.toLocaleDateString('en-IN')}
💰 *Carried Balance:* ₹${remainingDue.toLocaleString('en-IN')}

The schedule has been updated accordingly. Thank you!`;
      sendWhatsAppMessage(phone, waMessage);
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: `Penalty ₹${penaltyPaidAmt} collected! Installment #${repayment.installmentNo} moved to Week ${newWeekNo} (Installment #${nextInstNo}).`,
      data: {
        payment,
        carriedFromId: repayment.id,
        carriedToInstNo: nextInstNo,
        newRepayment,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/principal — Pay PRINCIPAL amount
router.post('/principal', authenticate, async (req, res) => {
  try {
    const { loanId, amount, paymentMode = 'CASH', reference, notes } = req.body;

    if (!loanId || !amount) {
      return res.status(400).json({ success: false, message: 'loanId and amount required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { customer: true, repayments: { orderBy: { installmentNo: 'desc' }, take: 1 } },
    });

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status === 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Loan is already closed' });
    }

    const currentOutstanding = loan.outstandingPrincipal ?? loan.principalAmount;
    const payAmount = parseFloat(amount);

    if (payAmount > currentOutstanding) {
      return res.status(400).json({ success: false, message: `Amount exceeds outstanding principal of Rs.${currentOutstanding}` });
    }

    const linkRepayment = loan.repayments[0];
    if (!linkRepayment) {
      return res.status(400).json({ success: false, message: 'No repayment entry found to link' });
    }

    const payment = await prisma.payment.create({
      data: {
        repaymentId: linkRepayment.id,
        collectedById: req.user.id,
        amount: payAmount,
        paymentMode,
        paymentType: 'PRINCIPAL',
        reference,
        notes: notes || 'Principal repayment',
      },
    });

    const newOutstanding = round2(currentOutstanding - payAmount);
    const updateData = { outstandingPrincipal: newOutstanding };

    if (newOutstanding <= 0) {
      updateData.status = 'CLOSED';
      
      const repaymentsToDelete = await prisma.repayment.findMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] }, paidAmount: 0, id: { not: linkRepayment.id } },
        select: { id: true }
      });
      
      if (repaymentsToDelete.length > 0) {
        const ids = repaymentsToDelete.map(r => r.id);
        await prisma.notificationLog.deleteMany({
          where: { repaymentId: { in: ids } }
        });
        await prisma.payment.deleteMany({
          where: { repaymentId: { in: ids } }
        });
        await prisma.repayment.deleteMany({
          where: { id: { in: ids } }
        });
      }
      await prisma.repayment.updateMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    await prisma.loan.update({ where: { id: loanId }, data: updateData });

    await auditLog(req.user.id, 'COLLECT_PRINCIPAL', 'Payment', payment.id, { amount: payAmount, paymentMode, type: 'PRINCIPAL', newOutstanding }, req);

    try {
      let message = newOutstanding <= 0
        ? `Dear ${loan.customer.name}, your loan is now FULLY CLOSED. Principal payment of Rs. ${payAmount} received. Thank you!`
        : `Dear ${loan.customer.name}, principal payment of Rs. ${payAmount} received. Remaining: Rs. ${newOutstanding}. Thank you.`;
      sendSMS(loan.customer.phone, message);
    } catch (_) { /* SMS failure non-blocking */ }

    res.status(201).json({ success: true, data: { payment, outstandingPrincipal: newOutstanding, loanStatus: newOutstanding <= 0 ? 'CLOSED' : 'ACTIVE' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/close — Close a loan by paying Principal + Accrued Interest + Penalty
router.post('/close', authenticate, async (req, res) => {
  try {
    const { loanId, principalAmount, accruedInterestAmount, penaltyAmount, paymentMode = 'CASH', reference, notes } = req.body;

    if (!loanId || !principalAmount) {
      return res.status(400).json({ success: false, message: 'loanId and principalAmount required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { customer: true, repayments: { orderBy: { installmentNo: 'desc' }, take: 1 } },
    });

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status === 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Loan is already closed' });
    }

    const currentOutstanding = loan.outstandingPrincipal ?? loan.principalAmount;
    const payPrincipal = parseFloat(principalAmount);
    const payInterest = parseFloat(accruedInterestAmount || 0);
    const payPenalty = parseFloat(penaltyAmount || 0);

    if (payPrincipal > currentOutstanding) {
      return res.status(400).json({ success: false, message: `Principal amount exceeds outstanding of Rs.${currentOutstanding}` });
    }

    const linkRepayment = loan.repayments[0];
    if (!linkRepayment) {
      return res.status(400).json({ success: false, message: 'No repayment entry found to link' });
    }

    // 1. Create Accrued Interest Payment
    if (payInterest > 0) {
      await prisma.payment.create({
        data: {
          repaymentId: linkRepayment.id,
          collectedById: req.user.id,
          amount: payInterest,
          paymentMode,
          paymentType: 'INTEREST',
          reference,
          notes: notes ? `Accrued Interest: ${notes}` : 'Pre-closure Accrued Interest',
        },
      });
    }

    // 2. Create Penalty Payment
    if (payPenalty > 0) {
      await prisma.payment.create({
        data: {
          repaymentId: linkRepayment.id,
          collectedById: req.user.id,
          amount: payPenalty,
          paymentMode,
          paymentType: 'PENALTY',
          reference,
          notes: notes ? `Overdue Penalty: ${notes}` : 'Pre-closure Overdue Penalty',
        },
      });
    }

    // 3. Create Principal Payment
    const payment = await prisma.payment.create({
      data: {
        repaymentId: linkRepayment.id,
        collectedById: req.user.id,
        amount: payPrincipal,
        paymentMode,
        paymentType: 'PRINCIPAL',
        reference,
        notes: notes || 'Principal repayment (Closure)',
      },
    });

    const newOutstanding = round2(currentOutstanding - payPrincipal);
    const updateData = { outstandingPrincipal: newOutstanding };

    if (newOutstanding <= 0) {
      updateData.status = 'CLOSED';
      
      const repaymentsToDelete = await prisma.repayment.findMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] }, paidAmount: 0, id: { not: linkRepayment.id } },
        select: { id: true }
      });
      
      if (repaymentsToDelete.length > 0) {
        const ids = repaymentsToDelete.map(r => r.id);
        await prisma.notificationLog.deleteMany({
          where: { repaymentId: { in: ids } }
        });
        await prisma.payment.deleteMany({
          where: { repaymentId: { in: ids } }
        });
        await prisma.repayment.deleteMany({
          where: { id: { in: ids } }
        });
      }
      await prisma.repayment.updateMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    await prisma.loan.update({ where: { id: loanId }, data: updateData });

    const totalCollectedNow = payPrincipal + payInterest + payPenalty;
    await auditLog(req.user.id, 'LOAN_CLOSURE', 'Payment', payment.id, { amount: totalCollectedNow, paymentMode, type: 'CLOSURE', newOutstanding }, req);

    try {
      let message = newOutstanding <= 0
        ? `Dear ${loan.customer.name}, your loan is now FULLY CLOSED. Total payment of Rs. ${totalCollectedNow} (Prin: ${payPrincipal}, Int: ${payInterest}, Pen: ${payPenalty}) received. Thank you!`
        : `Dear ${loan.customer.name}, payment of Rs. ${totalCollectedNow} received. Remaining: Rs. ${newOutstanding}. Thank you.`;
      sendSMS(loan.customer.phone, message);
    } catch (_) { /* SMS failure non-blocking */ }

    res.status(201).json({ success: true, data: { payment, outstandingPrincipal: newOutstanding, loanStatus: newOutstanding <= 0 ? 'CLOSED' : 'ACTIVE' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payments — History
router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, collectedById, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (collectedById) where.collectedById = collectedById;
    if (from || to) {
      where.collectedAt = {};
      if (from) where.collectedAt.gte = new Date(from);
      if (to) where.collectedAt.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          collectedBy: { select: { name: true } },
          repayment: {
            include: {
              loan: {
                select: {
                  loanNumber: true,
                  customer: { select: { name: true, phone: true } },
                },
              },
            },
          },
        },
        orderBy: { collectedAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ success: true, data: payments, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
