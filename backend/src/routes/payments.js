const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { sendSMS } = require('../utils/sms');
const prisma = new PrismaClient();

// round2 MUST be defined before any route that uses it
const round2 = (num) => Math.round(num * 100) / 100;

// POST /api/payments — Collect INTEREST payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { repaymentId, amount, paymentMode = 'CASH', reference, notes } = req.body;

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

    const payment = await prisma.payment.create({
      data: {
        repaymentId,
        collectedById: req.user.id,
        amount: parseFloat(amount),
        paymentMode,
        paymentType: 'INTEREST',
        reference,
        notes,
      },
    });

    const totalPaid = repayment.paidAmount + parseFloat(amount);
    const newStatus = totalPaid >= repayment.dueAmount ? 'PAID' : 'PARTIAL';

    await prisma.repayment.update({
      where: { id: repaymentId },
      data: { paidAmount: totalPaid, paidAt: newStatus === 'PAID' ? new Date() : null, status: newStatus },
    });

    await prisma.loan.update({
      where: { id: repayment.loanId },
      data: { interestCollected: { increment: parseFloat(amount) } },
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

    // SMS notification (async, non-blocking)
    try {
      const loanData = await prisma.loan.findUnique({
        where: { id: repayment.loanId },
        include: { customer: true },
      });
      const nextInstallment = await prisma.repayment.findFirst({
        where: { loanId: repayment.loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        orderBy: { dueDate: 'asc' },
      });
      let message = `Dear ${loanData.customer.name}, interest payment of Rs. ${amount} received. Principal balance: Rs. ${loanData.outstandingPrincipal || loanData.principalAmount}. Thank you.`;
      if (nextInstallment) {
        const nextDueDate = new Date(nextInstallment.dueDate).toLocaleDateString('en-IN');
        message = `Dear ${loanData.customer.name}, interest payment of Rs. ${amount} received. Next due: ${nextDueDate}. Principal balance: Rs. ${loanData.outstandingPrincipal || loanData.principalAmount}. Thank you.`;
      }
      sendSMS(loanData.customer.phone, message);
    } catch (_) { /* SMS failure should not block response */ }

    res.status(201).json({ success: true, data: payment });
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
      await prisma.repayment.deleteMany({
        where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] }, paidAmount: 0 },
      });
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
