const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

const { syncOverdueStatus } = require('../utils/loanCalc');

// GET /api/dashboard/summary
router.get('/summary', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    
    // Start of current day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Next 7 days
    const next7Days = new Date(startOfToday);
    next7Days.setDate(next7Days.getDate() + 7);

    // Update overdues (only starting day after due date)
    await syncOverdueStatus(prisma);

    const [
      activeLoans,
      activeCustomers
    ] = await Promise.all([
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.count({ where: { isActive: true } }),
    ]);

    // Financial aggregates (Overall)
    const loanAgg = await prisma.loan.aggregate({
      where: { status: { in: ['ACTIVE', 'CLOSED', 'DEFAULTED'] } },
      _sum: { principalAmount: true, totalPayable: true, totalInterest: true },
    });

    // Payments aggregate
    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
    });

    // Today's Collection
    const todaysPayments = await prisma.payment.aggregate({
      where: { collectedAt: { gte: startOfToday, lte: endOfToday } },
      _sum: { amount: true },
    });

    // Today's Dues
    const todaysDues = await prisma.repayment.aggregate({
      where: { dueDate: { gte: startOfToday, lte: endOfToday } },
      _sum: { dueAmount: true, paidAmount: true },
    });

    // Pending Collections overall (Pending + Overdue)
    const pendingDues = await prisma.repayment.aggregate({
      where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { dueAmount: true, paidAmount: true },
    });

    // Overdue Loans Count (Distinct loans with overdue)
    const overdueLoans = await prisma.repayment.groupBy({
      by: ['loanId'],
      where: { status: 'OVERDUE' },
    });

    const overdueAgg = await prisma.repayment.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { dueAmount: true, paidAmount: true },
    });

    // Monthly Aggregates
    const monthlyLoans = await prisma.loan.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { principalAmount: true, totalInterest: true },
    });

    const monthlyPayments = await prisma.payment.aggregate({
      where: { collectedAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    // Upcoming Dues (Next 7 days)
    const upcomingDues = await prisma.repayment.findMany({
      where: { 
        dueDate: { gt: endOfToday, lte: next7Days },
        status: { in: ['PENDING', 'PARTIAL'] }
      },
      include: { loan: { include: { customer: { select: { name: true, phone: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Recent Collections (Last 5)
    const recentCollections = await prisma.payment.findMany({
      include: { 
        repayment: { include: { loan: { include: { customer: { select: { name: true } } } } } },
        collectedBy: { select: { name: true } }
      },
      orderBy: { collectedAt: 'desc' },
      take: 5,
    });

    // Monthly Chart Data (Last 6 months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      
      const [mPay, mLoan] = await Promise.all([
        prisma.payment.aggregate({ where: { collectedAt: { gte: start, lte: end } }, _sum: { amount: true } }),
        prisma.loan.aggregate({ where: { createdAt: { gte: start, lte: end } }, _sum: { principalAmount: true, totalInterest: true } })
      ]);
      
      months.push({
        name: start.toLocaleString('default', { month: 'short' }),
        disbursed: mLoan._sum.principalAmount || 0,
        collected: mPay._sum.amount || 0,
        interest: mLoan._sum.totalInterest || 0,
        profit: mLoan._sum.totalInterest || 0,
      });
    }

    // Outstanding separated by Loan Types and Principal vs Interest
    const activeLoanRecords = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        interestType: true,
        principalAmount: true,
        totalPayable: true,
        outstandingPrincipal: true,
        repayments: { select: { status: true, dueDate: true, dueAmount: true, paidAmount: true } },
      },
    });

    let totalOutstandingPrincipal = 0;
    let totalOutstandingInterest = 0;

    const outstandingByLoanType = {
      FLAT: { count: 0, amount: 0, principal: 0, interest: 0, label: 'Regular Interest (வட்டி)' },
      WITHOUT_INTEREST: { count: 0, amount: 0, principal: 0, interest: 0, label: 'Deduction Based (கழித்து தருவது)' },
      FIXED_FLAT: { count: 0, amount: 0, principal: 0, interest: 0, label: 'Reducing Principal (அசலோடு தவணை)' },
    };

    activeLoanRecords.forEach(loan => {
      const type = loan.interestType || 'FLAT';
      if (!outstandingByLoanType[type]) {
        outstandingByLoanType[type] = { count: 0, amount: 0, principal: 0, interest: 0, label: type };
      }

      let princRemaining = 0;
      let intRemaining = 0;

      if (type === 'FLAT') {
        // Regular Interest: Principal = remaining principal. Interest = only unpaid interest from due/overdue installments up to today
        princRemaining = loan.outstandingPrincipal ?? loan.principalAmount;
        const unpaidDueInterest = (loan.repayments || [])
          .filter(r => r.status === 'OVERDUE' || (r.status === 'PENDING' && new Date(r.dueDate) <= startOfToday) || r.status === 'PARTIAL')
          .reduce((acc, r) => acc + Math.max(0, (r.dueAmount || 0) - (r.paidAmount || 0)), 0);
        intRemaining = unpaidDueInterest;
      } else if (type === 'WITHOUT_INTEREST') {
        // Deduction Based: Interest was deducted upfront. Total remaining = sum of unpaid installments
        const paid = (loan.repayments || []).reduce((acc, r) => acc + (r.paidAmount || 0), 0);
        const totalRemaining = Math.max(0, (loan.totalPayable || loan.principalAmount) - paid);
        princRemaining = totalRemaining;
        intRemaining = 0;
      } else {
        // FIXED_FLAT (Reducing Principal)
        const paid = (loan.repayments || []).reduce((acc, r) => acc + (r.paidAmount || 0), 0);
        const totalRemaining = Math.max(0, (loan.totalPayable || loan.principalAmount) - paid);
        princRemaining = Math.min(totalRemaining, loan.outstandingPrincipal ?? loan.principalAmount);
        intRemaining = Math.max(0, totalRemaining - princRemaining);
      }

      const totalRemaining = princRemaining + intRemaining;

      totalOutstandingPrincipal += princRemaining;
      totalOutstandingInterest += intRemaining;

      outstandingByLoanType[type].count += 1;
      outstandingByLoanType[type].amount += totalRemaining;
      outstandingByLoanType[type].principal += princRemaining;
      outstandingByLoanType[type].interest += intRemaining;
    });

    const todayDueAmt = todaysDues._sum.dueAmount || 0;
    const todayPaidAmt = todaysDues._sum.paidAmount || 0;

    res.json({
      success: true,
      data: {
        outstandingAmount: totalOutstandingPrincipal + totalOutstandingInterest,
        outstandingPrincipal: totalOutstandingPrincipal,
        outstandingInterest: totalOutstandingInterest,
        totalDisbursed: loanAgg._sum.principalAmount || 0,
        totalCollected: paymentAgg._sum.amount || 0,
        totalInterestCollected: loanAgg._sum.totalInterest || 0, // Expected profit
        activeCustomers,
        activeLoans,
        todayCollection: todaysPayments._sum.amount || 0,
        todayDueAmount: todayDueAmt,
        remainingToday: Math.max(0, todayDueAmt - todayPaidAmt), // Rough approximation
        pendingCollections: (pendingDues._sum.dueAmount || 0) - (pendingDues._sum.paidAmount || 0),
        overdueLoansCount: overdueLoans.length,
        totalOverdueAmount: (overdueAgg._sum.dueAmount || 0) - (overdueAgg._sum.paidAmount || 0),
        upcomingDues,
        recentCollections,
        outstandingByLoanType,
        monthly: {
          disbursed: monthlyLoans._sum.principalAmount || 0,
          collection: monthlyPayments._sum.amount || 0,
          interestIncome: monthlyLoans._sum.totalInterest || 0,
          profit: monthlyLoans._sum.totalInterest || 0,
        },
        monthlyTrend: months,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/dashboard/agent — Agent dashboard
router.get('/agent', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const agentId = req.user.role === 'AGENT' ? req.user.id : (req.query.agentId || null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await syncOverdueStatus(prisma);

    // Build filters — if no agentId (admin with no filter), show all
    const loanWhere = { status: 'ACTIVE' };
    if (agentId) loanWhere.agentId = agentId;

    const repaymentWhere = { dueDate: { gte: today, lt: tomorrow } };
    if (agentId) repaymentWhere.loan = { agentId };

    const paymentWhere = { collectedAt: { gte: today } };
    if (agentId) paymentWhere.collectedById = agentId;

    const [assignedLoans, todayDue, collectedToday] = await Promise.all([
      prisma.loan.count({ where: loanWhere }),
      prisma.repayment.findMany({
        where: repaymentWhere,
        include: {
          loan: { select: { loanNumber: true, customer: { select: { name: true, phone: true, address: true } } } },
        },
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        assignedLoans,
        todayDue,
        collectedToday: { amount: collectedToday._sum.amount || 0, count: collectedToday._count },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
