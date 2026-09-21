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

    // 1. Collections (Payments made today)
    const payments = await prisma.payment.findMany({
      where: { collectedAt: { gte: start, lte: end } }
    });
    const collections = payments.reduce((sum, p) => sum + p.amount, 0);
    const emiCollections = payments
      .filter(p => p.paymentType !== 'PENALTY')
      .reduce((sum, p) => sum + p.amount, 0);

    // 2. Loan Distributed (Principal of Loans disbursed today)
    const disbursedLoans = await prisma.loan.findMany({
      where: { 
        disbursedAt: { gte: start, lte: end },
        status: { not: 'PENDING' }
      }
    });
    const loanDistributed = disbursedLoans.reduce((sum, l) => sum + l.principalAmount, 0);
    const processingFees = disbursedLoans.reduce((sum, l) => sum + (l.processingFee || 0), 0);

    // 3. Office Expenses today
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' }
    });
    const officeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. Calculate Opening Balance (All time collections - disbursements - expenses BEFORE today)
    // Note: If you want a fixed manual opening balance, it needs a different model.
    // For now, we compute it dynamically based on all past history.
    // 4a. Penalty Collected today (paymentType = 'PENALTY')
    const penaltyCollected = payments
      .filter(p => p.paymentType === 'PENALTY')
      .reduce((sum, p) => sum + p.amount, 0);

    // 4b. Opening Balance:
    //   = past collections (all payment types)
    //   - past office expenses only
    //   (Loan principal is NOT subtracted — loans cycle back as repayments)
    const pastPayments = await prisma.payment.aggregate({
      where: { collectedAt: { lt: start } },
      _sum: { amount: true }
    });
    
    const pastExpenses = await prisma.expense.aggregate({
      where: { date: { lt: start } },
      _sum: { amount: true }
    });

    const totalPastIn = pastPayments._sum.amount || 0;
    const totalPastOut = pastExpenses._sum.amount || 0;
    const openingBalance = totalPastIn - totalPastOut;

    // 5. Cash in Hand
    const cashInHand = openingBalance + collections + processingFees - loanDistributed - officeExpenses;

    res.json({
      success: true,
      data: {
        date: start,
        openingBalance,
        collections,
        emiCollections,
        penaltyCollected,
        processingFees,
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
    await prisma.expense.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
