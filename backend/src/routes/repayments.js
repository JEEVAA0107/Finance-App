const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const prisma = new PrismaClient();

const round2 = (n) => Math.round(n * 100) / 100;

function getBatchSize(tenureUnit) {
  if (tenureUnit === 'WEEKS') return 52;
  if (tenureUnit === 'MONTHS') return 12;
  return 365;
}

/**
 * Auto-extend installments for ALL active loans that are running low.
 * Called before fetching repayments so the collection page always has upcoming entries.
 */
async function autoExtendActiveLoans() {
  // Find active loans where unpaid installments are running low
  const activeLoans = await prisma.loan.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, principalAmount: true, interestRate: true, tenureUnit: true },
  });

  for (const loan of activeLoans) {
    const unpaidCount = await prisma.repayment.count({
      where: { loanId: loan.id, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
    });

    if (unpaidCount >= 4) continue;

    const lastInstallment = await prisma.repayment.findFirst({
      where: { loanId: loan.id },
      orderBy: { installmentNo: 'desc' },
    });

    if (!lastInstallment) continue;

    const interestPerPeriod = round2(loan.principalAmount * (loan.interestRate / 100));
    const batchSize = getBatchSize(loan.tenureUnit);
    const startNo = lastInstallment.installmentNo + 1;
    const startFrom = new Date(lastInstallment.dueDate);

    const installments = [];
    for (let i = 0; i < batchSize; i++) {
      const dueDate = new Date(startFrom);
      const offset = i + 1;
      if (loan.tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
      else if (loan.tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
      else dueDate.setDate(dueDate.getDate() + offset);

      installments.push({
        loanId: loan.id,
        installmentNo: startNo + i,
        dueDate,
        dueAmount: interestPerPeriod,
        principal: 0,
        interest: interestPerPeriod,
        status: 'PENDING',
      });
    }

    await prisma.repayment.createMany({ data: installments });

    const newEndDate = installments[installments.length - 1].dueDate;
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        tenure: startNo + batchSize - 1,
        endDate: newEndDate,
      },
    });
  }
}

// GET /api/repayments — list with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { loanId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (loanId) where.loanId = loanId;
    if (status) where.status = status;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    // Auto-mark overdue (fast single query)
    await prisma.repayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    // Auto-extend runs in background — does NOT block the response
    autoExtendActiveLoans().catch(err => console.error('autoExtend error:', err));

    const [repayments, total] = await Promise.all([
      prisma.repayment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          loan: { select: { loanNumber: true, interestType: true, customer: { select: { name: true, phone: true } } } },
          payments: { include: { collectedBy: { select: { name: true } } } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.repayment.count({ where }),
    ]);

    res.json({ success: true, data: repayments, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/repayments/today — Today's collections
router.get('/today', authenticate, async (req, res) => {
  try {
    // Auto-mark overdue first (fast)
    await prisma.repayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    // Auto-extend in background — does NOT block response
    autoExtendActiveLoans().catch(err => console.error('autoExtend error:', err));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const repayments = await prisma.repayment.findMany({
      where: {
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { payments: { some: { collectedAt: { gte: today, lt: tomorrow } } } },
          { paidAt: { gte: today, lt: tomorrow } },
        ]
      },
      include: {
        loan: {
          select: {
            loanNumber: true,
            interestType: true,
            agentId: true,
            customer: { select: { name: true, phone: true, address: true } },
          },
        },
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: repayments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
