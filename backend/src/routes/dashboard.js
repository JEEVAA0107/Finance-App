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

    // Pending Collections = ONLY already-due amounts (OVERDUE + PARTIAL)
    // PENDING status = future installments not yet due — DO NOT include those!
    const pendingDues = await prisma.repayment.aggregate({
      where: {
        OR: [
          { status: 'OVERDUE' },
          { status: 'PARTIAL' },
          { status: 'PENDING', dueDate: { lte: endOfToday } }, // Today's pending only
        ]
      },
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

    // Calculate actual realized monthly interest & profit
    const monthlyPaymentRecords = await prisma.payment.findMany({
      where: { collectedAt: { gte: startOfMonth } },
      include: {
        repayment: {
          include: { loan: { select: { interestType: true, principalAmount: true, totalPayable: true, totalInterest: true } } }
        }
      }
    });

    let monthlyInterestIncome = 0;
    monthlyPaymentRecords.forEach(p => {
      const loan = p.repayment?.loan;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      if (type === 'FLAT') {
        monthlyInterestIncome += (p.amount || 0);
      } else if (type === 'FIXED_FLAT') {
        const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
        monthlyInterestIncome += (p.amount || 0) * interestRatio;
      }
    });

    const monthlyDeductionLoans = await prisma.loan.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        interestType: 'WITHOUT_INTEREST'
      },
      select: { totalInterest: true, processingFee: true }
    });

    monthlyDeductionLoans.forEach(l => {
      monthlyInterestIncome += (l.totalInterest || l.processingFee || 0);
    });

    monthlyInterestIncome = Math.round(monthlyInterestIncome * 100) / 100;

    // === All-Time Actual Profit (what was really collected, not expected) ===
    const allPaymentRecords = await prisma.payment.findMany({
      include: {
        repayment: {
          include: { loan: { select: { interestType: true, totalPayable: true, totalInterest: true } } }
        }
      }
    });

    let totalActualProfit = 0;
    allPaymentRecords.forEach(p => {
      const loan = p.repayment?.loan;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      if (type === 'FLAT') {
        totalActualProfit += (p.amount || 0);
      } else if (type === 'FIXED_FLAT') {
        const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
        totalActualProfit += (p.amount || 0) * interestRatio;
      }
    });

    // All deduction-based loans: interest was realized at disbursement
    const allDeductionLoans = await prisma.loan.findMany({
      where: { interestType: 'WITHOUT_INTEREST' },
      select: { totalInterest: true, processingFee: true }
    });
    allDeductionLoans.forEach(l => {
      totalActualProfit += (l.totalInterest || l.processingFee || 0);
    });
    totalActualProfit = Math.round(totalActualProfit * 100) / 100;


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

      // Actual interest collected in this specific month
      const mPayRecords = await prisma.payment.findMany({
        where: { collectedAt: { gte: start, lte: end } },
        include: {
          repayment: {
            include: { loan: { select: { interestType: true, totalPayable: true, totalInterest: true } } }
          }
        }
      });
      let mInterest = 0;
      mPayRecords.forEach(p => {
        const loan = p.repayment?.loan;
        if (!loan) return;
        const type = loan.interestType || 'FLAT';
        if (type === 'FLAT') {
          mInterest += (p.amount || 0);
        } else if (type === 'FIXED_FLAT') {
          const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
          mInterest += (p.amount || 0) * interestRatio;
        }
      });
      const mDeductionLoans = await prisma.loan.findMany({
        where: { createdAt: { gte: start, lte: end }, interestType: 'WITHOUT_INTEREST' },
        select: { totalInterest: true, processingFee: true }
      });
      mDeductionLoans.forEach(l => { mInterest += (l.totalInterest || l.processingFee || 0); });
      mInterest = Math.round(mInterest * 100) / 100;
      
      months.push({
        name: start.toLocaleString('default', { month: 'short' }),
        disbursed: mLoan._sum.principalAmount || 0,
        collected: mPay._sum.amount || 0,
        interest: mInterest,
        profit: mInterest,
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
        totalInterestCollected: totalActualProfit, // Actual profit collected so far
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
          interestIncome: monthlyInterestIncome,
          profit: monthlyInterestIncome,
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

// POST /api/dashboard/reset-all-data — Reset production database
router.post('/reset-all-data', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    try { await prisma.notificationLog.deleteMany({}); } catch (e) {}
    await prisma.payment.deleteMany({});
    try { await prisma.auditLog.deleteMany({}); } catch (e) {}
    await prisma.repayment.deleteMany({});
    await prisma.loan.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.user.deleteMany({ where: { role: 'CUSTOMER' } });

    res.json({ success: true, message: 'All test data reset successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// GET /api/dashboard/profit — Detailed Profit Breakdown with filters
router.get('/profit', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { loanType, dateFrom, dateTo, period } = req.query;

    // Build date range
    const now = new Date();
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'THIS_WEEK') {
      const day = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'LAST_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === 'THIS_YEAR') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default: All time
      startDate = new Date('2020-01-01');
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    // Build loan type filter
    const loanTypeFilter = loanType && loanType !== 'ALL' ? { interestType: loanType } : {};

    // Fetch all payments in date range with loan info
    const payments = await prisma.payment.findMany({
      where: {
        collectedAt: { gte: startDate, lte: endDate },
        repayment: { loan: { ...loanTypeFilter } }
      },
      include: {
        repayment: {
          include: {
            loan: {
              select: {
                id: true,
                loanNumber: true,
                interestType: true,
                principalAmount: true,
                totalPayable: true,
                totalInterest: true,
                disbursedAt: true,
                customer: { select: { name: true, phone: true } }
              }
            }
          }
        },
        collectedBy: { select: { name: true } }
      },
      orderBy: { collectedAt: 'desc' }
    });

    // Deduction loans created in date range (interest realized at disbursement)
    const deductionLoans = await prisma.loan.findMany({
      where: {
        disbursedAt: { gte: startDate, lte: endDate },
        interestType: 'WITHOUT_INTEREST',
        ...loanTypeFilter
      },
      select: {
        id: true,
        loanNumber: true,
        interestType: true,
        principalAmount: true,
        totalInterest: true,
        processingFee: true,
        disbursedAt: true,
        customer: { select: { name: true, phone: true } }
      }
    });

    // Build profit entries
    const profitEntries = [];
    let totalProfit = 0;

    // FLAT & FIXED_FLAT: profit comes from payments
    const byLoan = {};
    payments.forEach(p => {
      const loan = p.repayment?.loan;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      let profit = 0;
      if (type === 'FLAT') {
        profit = p.amount || 0;
      } else if (type === 'FIXED_FLAT') {
        const ratio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
        profit = (p.amount || 0) * ratio;
      } else {
        return; // WITHOUT_INTEREST handled separately
      }
      const key = loan.id;
      if (!byLoan[key]) {
        byLoan[key] = {
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          customerName: loan.customer?.name || '-',
          customerPhone: loan.customer?.phone || '-',
          loanType: type,
          principalAmount: loan.principalAmount,
          totalExpectedInterest: loan.totalInterest,
          collectedInterest: 0,
          lastCollected: p.collectedAt
        };
      }
      byLoan[key].collectedInterest = Math.round((byLoan[key].collectedInterest + profit) * 100) / 100;
      totalProfit += profit;
    });

    Object.values(byLoan).forEach(e => profitEntries.push(e));

    // WITHOUT_INTEREST: profit realized at disbursement
    deductionLoans.forEach(l => {
      const profit = l.totalInterest || l.processingFee || 0;
      profitEntries.push({
        loanId: l.id,
        loanNumber: l.loanNumber,
        customerName: l.customer?.name || '-',
        customerPhone: l.customer?.phone || '-',
        loanType: 'WITHOUT_INTEREST',
        principalAmount: l.principalAmount,
        totalExpectedInterest: profit,
        collectedInterest: profit,
        lastCollected: l.disbursedAt
      });
      totalProfit += profit;
    });

    totalProfit = Math.round(totalProfit * 100) / 100;

    // Summary by loan type
    const byType = { FLAT: 0, FIXED_FLAT: 0, WITHOUT_INTEREST: 0 };
    profitEntries.forEach(e => {
      byType[e.loanType] = Math.round(((byType[e.loanType] || 0) + e.collectedInterest) * 100) / 100;
    });

    res.json({
      success: true,
      data: {
        totalProfit,
        byType,
        entries: profitEntries.sort((a, b) => new Date(b.lastCollected) - new Date(a.lastCollected)),
        dateRange: { from: startDate, to: endDate }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
