const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { generateLoanNumber } = require('../utils/loanCalc');
const prisma = new PrismaClient();

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Get the initial batch size for a tenure unit.
 * This is how many installments we generate at a time.
 */
function getBatchSize(tenureUnit) {
  if (tenureUnit === 'WEEKS') return 52;
  if (tenureUnit === 'MONTHS') return 12;
  return 365; // DAYS
}

/**
 * Generate interest-only installment records.
 * @param {string} loanId
 * @param {number} interestPerPeriod - interest amount per installment
 * @param {string} tenureUnit - WEEKS | MONTHS | DAYS
 * @param {Date} startFrom - the date to start generating from
 * @param {number} startNo - installment number to start from
 * @param {number} count - how many installments to generate
 */
function generateInstallments(loanId, principalPerPeriod, interestPerPeriod, tenureUnit, startFrom, startNo, count) {
  const installments = [];

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startFrom);
    const offset = i + 1; // offset from startFrom
    if (tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
    else if (tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
    else dueDate.setDate(dueDate.getDate() + offset);

    let prin = round2(principalPerPeriod);
    let intst = round2(interestPerPeriod);
    let due = round2(prin + intst);

    installments.push({
      loanId,
      installmentNo: startNo + i,
      dueDate,
      dueAmount: due,
      principal: prin,
      interest: intst,
      status: 'PENDING',
    });
  }
  return installments;
}

/**
 * Auto-extend a loan's installments if most existing ones are paid/used.
 * Generates another batch when unpaid installments fall below a threshold.
 */
async function autoExtendIfNeeded(loanId) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status !== 'ACTIVE') return;
  if (loan.interestType === 'WITHOUT_INTEREST' || loan.interestType === 'FIXED_FLAT') return; // Fixed tenure, no auto-extend

  // Count unpaid installments
  const unpaidCount = await prisma.repayment.count({
    where: { loanId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
  });

  // Threshold: extend when fewer than 4 unpaid installments remain
  const threshold = 4;
  if (unpaidCount >= threshold) return;

  // Get the last installment to know where to continue from
  const lastInstallment = await prisma.repayment.findFirst({
    where: { loanId },
    orderBy: { installmentNo: 'desc' },
  });

  if (!lastInstallment) return;

  const interestPerPeriod = loan.principalAmount * (loan.interestRate / 100);
  const batchSize = getBatchSize(loan.tenureUnit);
  const startNo = lastInstallment.installmentNo + 1;
  const startFrom = new Date(lastInstallment.dueDate);

  const newInstallments = generateInstallments(
    loanId, 0, interestPerPeriod, loan.tenureUnit, startFrom, startNo, batchSize
  );

  await prisma.repayment.createMany({ data: newInstallments });

  // Update loan tenure count and end date
  const newEndDate = newInstallments[newInstallments.length - 1].dueDate;
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      tenure: startNo + batchSize - 1,
      endDate: newEndDate,
      totalInterest: round2(interestPerPeriod * (startNo + batchSize - 1)),
      totalPayable: round2(loan.principalAmount + interestPerPeriod * (startNo + batchSize - 1)),
    },
  });
}

// GET /api/loans
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, customerId, agentId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (agentId) where.agentId = agentId;
    // if (req.user.role === 'AGENT') where.agentId = req.user.id; // Removed so all agents see all loans
    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
      if (customer) where.customerId = customer.id;
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          agent: { select: { id: true, name: true } },
          repayments: {
            select: { id: true, status: true, dueAmount: true, paidAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.loan.count({ where }),
    ]);

    res.json({ success: true, data: loans, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/loans/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Auto-extend installments if running low (before fetching)
    await autoExtendIfNeeded(req.params.id);

    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        agent: { select: { id: true, name: true, phone: true } },
        repayments: {
          include: { payments: { include: { collectedBy: { select: { id: true, name: true } } } } },
          orderBy: { installmentNo: 'asc' },
        },
      },
    });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/loans — Create loan (ALL loans are continuous / interest-only until principal is paid)
router.post('/', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const {
      customerId, agentId, principalAmount, interestRate,
      interestType = 'FLAT', tenure, tenureUnit = 'MONTHS',
      processingFee = 0, startDate,
    } = req.body;

    if (!customerId || !principalAmount || interestRate === undefined || !startDate) {
      return res.status(400).json({ success: false, message: 'Missing required loan fields' });
    }

    const start = new Date(startDate);
    
    let batchSize, interestPerPeriod, principalPerPeriod, installmentAmount, totalPayable, totalInterest;

    if (interestType === 'WITHOUT_INTEREST') {
      batchSize = tenure ? parseInt(tenure) : getBatchSize(tenureUnit);
      interestPerPeriod = 0;
      principalPerPeriod = parseFloat(principalAmount) / batchSize;
      installmentAmount = principalPerPeriod;
      totalPayable = parseFloat(principalAmount);
      totalInterest = 0;
    } else if (interestType === 'FIXED_FLAT') {
      batchSize = tenure ? parseInt(tenure) : getBatchSize(tenureUnit);
      const r_flat = parseFloat(interestRate);
      
      totalInterest = parseFloat(principalAmount) * (r_flat / 100);
      totalPayable = parseFloat(principalAmount) + totalInterest;
      installmentAmount = batchSize > 0 ? totalPayable / batchSize : 0;
      
      principalPerPeriod = batchSize > 0 ? parseFloat(principalAmount) / batchSize : 0;
      interestPerPeriod = batchSize > 0 ? totalInterest / batchSize : 0;
    } else {
      batchSize = getBatchSize(tenureUnit);
      interestPerPeriod = parseFloat(principalAmount) * (parseFloat(interestRate) / 100);
      principalPerPeriod = 0;
      installmentAmount = interestPerPeriod;
      totalPayable = parseFloat(principalAmount) + (interestPerPeriod * batchSize);
      totalInterest = interestPerPeriod * batchSize;
    }

    const calc = {
      totalInterest: round2(totalInterest),
      totalPayable: round2(totalPayable),
      installmentAmount: round2(installmentAmount),
    };

    // End date = last installment of initial batch (will auto-extend)
    const end = new Date(start);
    if (tenureUnit === 'MONTHS') end.setMonth(end.getMonth() + batchSize);
    else if (tenureUnit === 'WEEKS') end.setDate(end.getDate() + batchSize * 7);
    else end.setDate(end.getDate() + batchSize);

    const loanNumber = generateLoanNumber();

    const loan = await prisma.loan.create({
      data: {
        loanNumber,
        customerId,
        agentId: agentId || req.user.id,
        principalAmount: parseFloat(principalAmount),
        interestRate: parseFloat(interestRate),
        interestType,
        tenure: batchSize,  // Initial batch count (will grow as we auto-extend)
        tenureUnit,
        processingFee: parseFloat(processingFee),
        ...calc,
        interestCollected: 0,
        outstandingPrincipal: parseFloat(principalAmount),
        status: 'ACTIVE',
        disbursedAt: new Date(),
        startDate: start,
        endDate: end,
      },
    });

    // Generate initial installment batch
    const installments = generateInstallments(
      loan.id, principalPerPeriod, interestPerPeriod, tenureUnit, start, 1, batchSize
    );
    await prisma.repayment.createMany({ data: installments });

    await auditLog(req.user.id, 'CREATE_LOAN', 'Loan', loan.id, { loanNumber, principalAmount, continuous: true }, req);

    const fullLoan = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: { customer: true, repayments: { orderBy: { installmentNo: 'asc' } } },
    });

    res.status(201).json({ success: true, data: fullLoan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/loans/:id/status
router.patch('/:id/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const loan = await prisma.loan.update({ where: { id: req.params.id }, data: { status } });
    await auditLog(req.user.id, 'UPDATE_LOAN_STATUS', 'Loan', loan.id, { status }, req);
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/loans/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.loan.update({ where: { id: req.params.id }, data: { status: 'DEFAULTED' } });
    res.json({ success: true, message: 'Loan marked as defaulted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/loans/:id/report — Download CSV report of the full loan history
router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        agent: { select: { name: true, phone: true } },
        repayments: {
          include: {
            payments: {
              include: { collectedBy: { select: { name: true } } },
              orderBy: { collectedAt: 'asc' },
            },
          },
          orderBy: { installmentNo: 'asc' },
        },
      },
    });

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    // Build CSV content
    let csv = '';

    // ─── Section 1: Loan Summary ───
    csv += 'LOAN REPORT\r\n';
    csv += `Generated On,"${formatDateTime(new Date())}"\r\n`;
    csv += '\r\n';
    csv += 'LOAN DETAILS\r\n';
    csv += `Loan Number,"${loan.loanNumber}"\r\n`;
    csv += `Status,"${loan.status}"\r\n`;
    csv += `Customer Name,"${loan.customer?.name}"\r\n`;
    csv += `Customer Phone,"${loan.customer?.phone}"\r\n`;
    csv += `Customer Address,"${loan.customer?.address || 'N/A'}"\r\n`;
    csv += `Agent,"${loan.agent?.name || 'N/A'}"\r\n`;
    csv += `Principal Amount,"${loan.principalAmount}"\r\n`;
    csv += `Outstanding Principal,"${loan.outstandingPrincipal ?? loan.principalAmount}"\r\n`;
    csv += `Interest Rate,"${loan.interestRate}% per ${loan.tenureUnit === 'WEEKS' ? 'week' : loan.tenureUnit === 'MONTHS' ? 'month' : 'day'}"\r\n`;
    csv += `Installment Amount,"${loan.installmentAmount}"\r\n`;
    csv += `Collection Frequency,"${loan.tenureUnit === 'WEEKS' ? 'Weekly' : loan.tenureUnit === 'MONTHS' ? 'Monthly' : 'Daily'}"\r\n`;
    csv += `Total Interest Collected,"${loan.interestCollected || 0}"\r\n`;
    csv += `Start Date,"${formatDate(loan.startDate)}"\r\n`;
    csv += `Created On,"${formatDate(loan.createdAt)}"\r\n`;
    csv += '\r\n';

    // ─── Section 2: Interest Collection Schedule ───
    csv += 'INTEREST COLLECTION SCHEDULE\r\n';
    csv += 'Installment #,Due Date,Interest Due,Paid Amount,Status,Paid On,Collected By,Payment Mode,Reference\r\n';

    // Only include repayments that are PAID or have some activity
    const paidRepayments = loan.repayments.filter(r => r.status === 'PAID' || r.paidAmount > 0);

    for (const r of paidRepayments) {
      if (r.payments && r.payments.length > 0) {
        for (const p of r.payments) {
          if (p.paymentType === 'PRINCIPAL') continue; // Skip principal payments here
          csv += `${r.installmentNo},"${formatDate(r.dueDate)}",${r.dueAmount},${p.amount},${r.status},"${formatDateTime(p.collectedAt)}","${p.collectedBy?.name || 'N/A'}",${p.paymentMode || 'CASH'},"${p.reference || ''}"\r\n`;
        }
      } else {
        csv += `${r.installmentNo},"${formatDate(r.dueDate)}",${r.dueAmount},${r.paidAmount},${r.status},"${formatDate(r.paidAt)}","-","-","-"\r\n`;
      }
    }
    csv += '\r\n';

    // ─── Section 3: Principal Payments ───
    const principalPayments = loan.repayments
      .flatMap(r => (r.payments || []).filter(p => p.paymentType === 'PRINCIPAL'));

    if (principalPayments.length > 0) {
      csv += 'PRINCIPAL PAYMENTS\r\n';
      csv += 'Date,Amount,Payment Mode,Reference,Collected By,Notes\r\n';
      for (const p of principalPayments) {
        csv += `"${formatDateTime(p.collectedAt)}",${p.amount},${p.paymentMode || 'CASH'},"${p.reference || ''}","${p.collectedBy?.name || 'N/A'}","${p.notes || ''}"\r\n`;
      }
      csv += '\r\n';
    }

    // ─── Section 4: Summary ───
    const totalInterestPaid = paidRepayments.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const totalPrincipalPaid = principalPayments.reduce((sum, p) => sum + p.amount, 0);
    csv += 'SUMMARY\r\n';
    csv += `Total Interest Payments,"${paidRepayments.length}"\r\n`;
    csv += `Total Interest Collected,"${round2(totalInterestPaid)}"\r\n`;
    csv += `Total Principal Paid,"${round2(totalPrincipalPaid)}"\r\n`;
    csv += `Grand Total Received,"${round2(totalInterestPaid + totalPrincipalPaid)}"\r\n`;
    csv += `Outstanding Principal,"${loan.outstandingPrincipal ?? loan.principalAmount}"\r\n`;
    csv += `Loan Status,"${loan.status}"\r\n`;

    // Send as downloadable CSV
    const filename = `Loan_${loan.loanNumber}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
