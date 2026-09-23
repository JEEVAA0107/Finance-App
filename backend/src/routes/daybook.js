const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, authorize } = require('../middleware/auth');
const dayjs = require('dayjs');

// Helper to get start and end of a given date (default today)
const getDayBounds = (dateStr) => {
  const start = dateStr ? dayjs(dateStr).startOf('day') : dayjs().startOf('day');
  const end = dateStr ? dayjs(dateStr).endOf('day') : dayjs().endOf('day');
  return { start: start.toDate(), end: end.toDate() };
};

// GET /api/daybook/summary?date=YYYY-MM-DD
router.get('/summary', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { start, end } = getDayBounds(req.query.date);
    const companyId = req.user.companyId;
    const paymentWhere = companyId ? { repayment: { loan: { companyId } } } : {};
    const loanWhere = companyId ? { companyId } : {};
    const expenseWhere = companyId ? { companyId } : {};

    // 1. Collections (Payments made on this date) with Repayment & Loan details for accurate Principal vs Interest separation
    const payments = await prisma.payment.findMany({
      where: { collectedAt: { gte: start, lte: end }, ...paymentWhere },
      include: {
        repayment: {
          select: {
            principal: true,
            interest: true,
            dueAmount: true,
            loan: {
              select: { interestType: true, principalAmount: true, totalPayable: true, totalInterest: true }
            }
          }
        }
      }
    });

    let principalCollected = 0;
    let interestCollected = 0;
    let penaltyCollected = 0;

    payments.forEach(p => {
      const amt = p.amount || 0;
      if (p.paymentType === 'PENALTY') {
        penaltyCollected += amt;
      } else if (p.paymentType === 'PRINCIPAL') {
        principalCollected += amt;
      } else if (p.paymentType === 'INTEREST') {
        interestCollected += amt;
      } else if (p.paymentType === 'EMI') {
        const rep = p.repayment;
        if (rep && (rep.principal > 0 || rep.interest > 0)) {
          const total = (rep.principal || 0) + (rep.interest || 0);
          const pRatio = (rep.principal || 0) / total;
          const iRatio = (rep.interest || 0) / total;
          principalCollected += amt * pRatio;
          interestCollected += amt * iRatio;
        } else if (rep?.loan && rep.loan.totalPayable > 0) {
          const iRatio = (rep.loan.totalInterest || 0) / rep.loan.totalPayable;
          interestCollected += amt * iRatio;
          principalCollected += amt * (1 - iRatio);
        } else {
          principalCollected += amt;
        }
      } else {
        const loan = p.repayment?.loan;
        if (loan?.interestType === 'WITHOUT_INTEREST') {
          principalCollected += amt;
        } else if (loan?.interestType === 'FLAT') {
          interestCollected += amt;
        } else {
          principalCollected += amt;
        }
      }
    });

    principalCollected = Math.round(principalCollected * 100) / 100;
    interestCollected = Math.round(interestCollected * 100) / 100;
    penaltyCollected = Math.round(penaltyCollected * 100) / 100;

    // Total Inflow from payments:
    const collections = Math.round((principalCollected + interestCollected + penaltyCollected) * 100) / 100;

    // 2. Loan Distributed (Principal of Loans disbursed on this date)
    const disbursedLoans = await prisma.loan.findMany({
      where: { 
        disbursedAt: { gte: start, lte: end },
        status: { not: 'PENDING' },
        ...loanWhere
      }
    });
    const loanDistributed = disbursedLoans.reduce((sum, l) => sum + (l.principalAmount || 0), 0);
    const processingFees = disbursedLoans.reduce((sum, l) => sum + (l.processingFee || 0), 0);

    // 3. Office Expenses today
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end }, ...expenseWhere },
      orderBy: { createdAt: 'desc' }
    });
    const officeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. Calculate Opening Balance:
    // Past Inflow = past payments + past processing fees
    // Past Outflow = past office expenses
    const pastPayments = await prisma.payment.aggregate({
      where: { collectedAt: { lt: start }, ...paymentWhere },
      _sum: { amount: true }
    });
    
    const pastExpenses = await prisma.expense.aggregate({
      where: { date: { lt: start }, ...expenseWhere },
      _sum: { amount: true }
    });

    const pastFees = await prisma.loan.aggregate({
      where: { disbursedAt: { lt: start }, status: { not: 'PENDING' }, ...loanWhere },
      _sum: { processingFee: true }
    });

    const totalPastIn = (pastPayments._sum.amount || 0) + (pastFees._sum.processingFee || 0);
    const totalPastOut = pastExpenses._sum.amount || 0;
    const openingBalance = Math.round((totalPastIn - totalPastOut) * 100) / 100;

    // 5. Profit Breakdown:
    // Pure Interest Profit = Interest collected from installments + Processing Fees/Deductions
    const interestProfit = Math.round((interestCollected + processingFees) * 100) / 100;
    // Penalty Profit = Penalty collected
    const penaltyProfit = penaltyCollected;
    // Total Combined Profit = Interest Profit + Penalty Profit
    const totalProfit = Math.round((interestProfit + penaltyProfit) * 100) / 100;

    // 6. Cash in Hand:
    // Physical cash in hand = Opening Balance + Collections (Principal + Interest + Penalty) + Processing Fees - Office Expenses
    // NOTE: Loans Distributed is capital disbursed to market, NOT subtracted from physical cash in hand.
    const cashInHand = Math.round((openingBalance + collections + processingFees - officeExpenses) * 100) / 100;

    res.json({
      success: true,
      data: {
        date: start,
        openingBalance,
        collections,
        principalCollected,
        interestCollected,
        penaltyCollected,
        processingFees,
        interestProfit,
        penaltyProfit,
        totalProfit,
        loanDistributed,
        officeExpenses,
        cashInHand,
        expenseDetails: expenses
      }
    });
  } catch (error) {
    console.error('Daybook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/daybook/expense
router.post('/expense', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: req.user.companyId || null,
        amount: parseFloat(amount),
        category: category || 'OFFICE',
        description: description || '',
        date: date ? new Date(date) : new Date()
      }
    });

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/daybook/expense/:id
router.delete('/expense/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (req.user.companyId && expense.companyId && expense.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied to this expense' });
    }
    await prisma.expense.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
