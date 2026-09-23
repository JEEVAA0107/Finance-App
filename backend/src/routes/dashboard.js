const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

// High performance in-memory cache for dashboard data
const dashboardCache = new Map();
function getCached(key, ttlMs = 2000) {
  const item = dashboardCache.get(key);
  if (item && Date.now() - item.time < ttlMs) {
    return item.data;
  }
  return null;
}
function setCached(key, data) {
  dashboardCache.set(key, { time: Date.now(), data });
}
function invalidateDashboardCache(companyId) {
  if (!companyId) {
    dashboardCache.clear();
    return;
  }
  const idStr = String(companyId);
  for (const key of dashboardCache.keys()) {
    if (key.includes(idStr) || key.includes('all')) {
      dashboardCache.delete(key);
    }
  }
}
router.invalidateDashboardCache = invalidateDashboardCache;

const { syncOverdueStatus } = require('../utils/loanCalc');

// GET /api/dashboard/summary
router.get('/summary', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const cacheKey = `summary_${req.user.companyId || req.user.id || 'all'}`;
    const cached = getCached(cacheKey, 2000);
    if (cached) {
      return res.json(cached);
    }
    const now = new Date();
    
    // Start of current day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Next 7 days
    const next7Days = new Date(startOfToday);
    next7Days.setDate(next7Days.getDate() + 7);

    // Multi-tenant isolation filters
    const companyId = req.user.companyId;
    const loanWhere = companyId ? { companyId } : {};
    const customerWhere = companyId ? { companyId, isActive: true } : { isActive: true };
    const paymentWhere = companyId ? { repayment: { loan: { companyId } } } : {};
    const repaymentWhere = companyId ? { loan: { companyId } } : {};

    // Update overdues (only starting day after due date)
    await syncOverdueStatus(prisma);

    const [
      activeLoans,
      activeCustomers
    ] = await Promise.all([
      prisma.loan.count({ where: { status: 'ACTIVE', ...loanWhere } }),
      prisma.customer.count({ where: customerWhere }),
    ]);

    // Financial aggregates (Overall)
    const loanAgg = await prisma.loan.aggregate({
      where: { status: { in: ['ACTIVE', 'CLOSED', 'DEFAULTED'] }, ...loanWhere },
      _sum: { principalAmount: true, totalPayable: true, totalInterest: true },
    });

    // Payments aggregate
    // Penalty Aggregates (Carry Forward & Late Penalties)
    const [penaltyAgg, todayPenaltyAgg, repPenaltyAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { paymentType: 'PENALTY', ...paymentWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          paymentType: 'PENALTY',
          collectedAt: { gte: startOfToday, lte: endOfToday },
          ...paymentWhere,
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.repayment.aggregate({
        where: repaymentWhere,
        _sum: { penaltyPaid: true },
      }),
    ]);
    const totalPenaltyCollectedAmt = Math.max(penaltyAgg._sum.amount || 0, repPenaltyAgg._sum.penaltyPaid || 0);

    const paymentAgg = await prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    });

    // Today's Collection
    const todaysPayments = await prisma.payment.aggregate({
      where: { collectedAt: { gte: startOfToday, lte: endOfToday }, ...paymentWhere },
      _sum: { amount: true },
    });

    // Today's Dues
    const todaysDues = await prisma.repayment.aggregate({
      where: { dueDate: { gte: startOfToday, lte: endOfToday }, ...repaymentWhere },
      _sum: { dueAmount: true, paidAmount: true },
    });

    // Pending Collections = ONLY already-due amounts (OVERDUE + PARTIAL)
    // PENDING status = future installments not yet due — DO NOT include those!
    const pendingDues = await prisma.repayment.aggregate({
      where: {
        ...repaymentWhere,
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
      where: { status: 'OVERDUE', ...repaymentWhere },
    });

    const overdueAgg = await prisma.repayment.aggregate({
      where: { status: 'OVERDUE', ...repaymentWhere },
      _sum: { dueAmount: true, paidAmount: true },
    });

    // Monthly Aggregates
    const monthlyLoans = await prisma.loan.aggregate({
      where: { createdAt: { gte: startOfMonth }, ...loanWhere },
      _sum: { principalAmount: true, totalInterest: true },
    });

    const monthlyPayments = await prisma.payment.aggregate({
      where: { collectedAt: { gte: startOfMonth }, ...paymentWhere },
      _sum: { amount: true },
    });

    // Calculate actual realized monthly interest & profit
    const monthlyPaymentRecords = await prisma.payment.findMany({
      where: { collectedAt: { gte: startOfMonth }, ...paymentWhere },
      include: {
        repayment: {
          include: { loan: { select: { interestType: true, principalAmount: true, totalPayable: true, totalInterest: true } } }
        }
      }
    });

    let monthlyInterestIncome = 0;
    let monthlyCashPrincipal = 0;
    let monthlyCashInterest = 0;
    let monthlyCashPenalty = 0;

    monthlyPaymentRecords.forEach(p => {
      const loan = p.repayment?.loan;
      const amt = p.amount || 0;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      
      // Separate PENALTY payments completely so they never pollute Principal or Interest
      if (p.paymentType === 'PENALTY') {
        monthlyCashPenalty += amt;
        return;
      }
      
      if (type === 'FLAT') {
        if (p.paymentType === 'PRINCIPAL') {
          monthlyCashPrincipal += amt;
        } else {
          monthlyInterestIncome += amt;
          monthlyCashInterest += amt;
        }
      } else if (type === 'EMI') {
        const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
        const intPortion = amt * interestRatio;
        const princPortion = amt - intPortion;
        monthlyInterestIncome += intPortion;
        monthlyCashInterest += intPortion;
        monthlyCashPrincipal += princPortion;
      } else if (type === 'WITHOUT_INTEREST') {
        monthlyCashPrincipal += amt;
      }
    });

    const monthlyDeductionLoans = await prisma.loan.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        interestType: 'WITHOUT_INTEREST',
        ...loanWhere,
      },
      select: { totalInterest: true, processingFee: true }
    });

    monthlyDeductionLoans.forEach(l => {
      monthlyInterestIncome += (l.totalInterest || l.processingFee || 0);
    });

    monthlyCashPrincipal = Math.round(monthlyCashPrincipal * 100) / 100;
    monthlyCashInterest = Math.round(monthlyCashInterest * 100) / 100;
    monthlyCashPenalty = Math.round(monthlyCashPenalty * 100) / 100;
    monthlyInterestIncome = Math.round(monthlyInterestIncome * 100) / 100;

    // === All-Time Actual Profit (what was really collected, not expected) ===
    const allPaymentRecords = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        paymentType: true,
        repayment: {
          select: {
            loan: { select: { interestType: true, totalPayable: true, totalInterest: true } }
          }
        }
      }
    });

    let totalActualProfit = 0;
    let totalPrincipalCollected = 0;

    allPaymentRecords.forEach(p => {
      const loan = p.repayment?.loan;
      const amt = p.amount || 0;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      if (p.paymentType === 'PENALTY') return; // Handled separately

      if (type === 'FLAT') {
        if (p.paymentType !== 'PRINCIPAL') {
          totalActualProfit += amt;
        } else {
          totalPrincipalCollected += amt;
        }
      } else if (type === 'EMI') {
        const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
        totalActualProfit += amt * interestRatio;
        totalPrincipalCollected += amt * (1 - interestRatio);
      } else if (type === 'WITHOUT_INTEREST') {
        totalPrincipalCollected += amt;
      }
    });

    // All deduction-based loans: interest was realized at disbursement
    const allDeductionLoans = await prisma.loan.findMany({
      where: { interestType: 'WITHOUT_INTEREST', ...loanWhere },
      select: { totalInterest: true, processingFee: true }
    });
    allDeductionLoans.forEach(l => {
      totalActualProfit += (l.totalInterest || l.processingFee || 0);
    });
    totalActualProfit = Math.round(totalActualProfit * 100) / 100;
    totalPrincipalCollected = Math.round(totalPrincipalCollected * 100) / 100;

    // Today's Principal, Interest, and Penalty breakdown
    const todayPaymentRecords = await prisma.payment.findMany({
      where: { collectedAt: { gte: startOfToday, lte: endOfToday }, ...paymentWhere },
      include: {
        repayment: {
          include: { loan: { select: { interestType: true, totalPayable: true, totalInterest: true } } }
        }
      }
    });

    let todayPrincipal = 0;
    let todayInterest = 0;
    let todayPenalty = 0;

    todayPaymentRecords.forEach(p => {
      const amt = p.amount || 0;
      if (p.paymentType === 'PENALTY') {
        todayPenalty += amt;
      } else if (p.paymentType === 'PRINCIPAL') {
        todayPrincipal += amt;
      } else if (p.paymentType === 'INTEREST') {
        todayInterest += amt;
      } else if (p.paymentType === 'EMI') {
        const loan = p.repayment?.loan;
        const interestRatio = (loan && loan.totalPayable > 0) ? (loan.totalInterest / loan.totalPayable) : 0;
        const intPortion = amt * interestRatio;
        todayInterest += intPortion;
        todayPrincipal += (amt - intPortion);
      } else {
        const loan = p.repayment?.loan;
        if (loan?.interestType === 'WITHOUT_INTEREST') {
          todayPrincipal += amt;
        } else if (loan?.interestType === 'FLAT') {
          todayInterest += amt;
        } else {
          todayPrincipal += amt;
        }
      }
    });

    const todayDeductionLoans = await prisma.loan.findMany({
      where: {
        disbursedAt: { gte: startOfToday, lte: endOfToday },
        interestType: 'WITHOUT_INTEREST',
        ...loanWhere,
      },
      select: { totalInterest: true, processingFee: true }
    });
    todayDeductionLoans.forEach(l => {
      todayInterest += (l.totalInterest || l.processingFee || 0);
    });

    const todayPrincipalCollected = Math.round(todayPrincipal * 100) / 100;
    const todayInterestCollected = Math.round(todayInterest * 100) / 100;
    const todayPenaltyCollected = Math.round(todayPenalty * 100) / 100;
    const todayCombinedProfit = Math.round((todayInterestCollected + todayPenaltyCollected) * 100) / 100;
    const totalCombinedProfit = Math.round((totalActualProfit + totalPenaltyCollectedAmt) * 100) / 100;


    // Upcoming Dues (Next 7 days)
    const upcomingDues = await prisma.repayment.findMany({
      where: { 
        dueDate: { gt: endOfToday, lte: next7Days },
        status: { in: ['PENDING', 'PARTIAL'] },
        ...repaymentWhere,
      },
      include: { loan: { include: { customer: { select: { name: true, phone: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Recent Collections (Last 5)
    const recentCollections = await prisma.payment.findMany({
      where: paymentWhere,
      include: { 
        repayment: { include: { loan: { include: { customer: { select: { name: true } } } } } },
        collectedBy: { select: { name: true } }
      },
      orderBy: { collectedAt: 'desc' },
      take: 5,
    });

    // Monthly Chart Data (Last 6 months) — Optimized: parallel batch query & in-memory grouping
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [chartPayments, chartLoans, chartDeductionLoans] = await Promise.all([
      prisma.payment.findMany({
        where: { collectedAt: { gte: sixMonthsAgo }, ...paymentWhere },
        select: {
          amount: true,
          paymentType: true,
          collectedAt: true,
          repayment: {
            select: {
              loan: { select: { interestType: true, totalPayable: true, totalInterest: true } }
            }
          }
        }
      }),
      prisma.loan.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, ...loanWhere },
        select: {
          principalAmount: true,
          createdAt: true
        }
      }),
      prisma.loan.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, interestType: 'WITHOUT_INTEREST', ...loanWhere },
        select: { totalInterest: true, processingFee: true, createdAt: true }
      })
    ]);

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const startMs = start.getTime();
      const endMs = end.getTime();

      let disbursed = 0;
      for (let j = 0; j < chartLoans.length; j++) {
        const l = chartLoans[j];
        const t = new Date(l.createdAt).getTime();
        if (t >= startMs && t <= endMs) {
          disbursed += (l.principalAmount || 0);
        }
      }

      let collected = 0;
      let mInterest = 0;
      for (let j = 0; j < chartPayments.length; j++) {
        const p = chartPayments[j];
        const t = new Date(p.collectedAt).getTime();
        if (t >= startMs && t <= endMs) {
          const amt = p.amount || 0;
          collected += amt;
          const loan = p.repayment?.loan;
          if (loan) {
            const type = loan.interestType || 'FLAT';
            if (type === 'FLAT') {
              if (p.paymentType !== 'PRINCIPAL') {
                mInterest += amt;
              }
            } else if (type === 'EMI') {
              const interestRatio = loan.totalPayable > 0 ? (loan.totalInterest / loan.totalPayable) : 0;
              mInterest += amt * interestRatio;
            }
          }
        }
      }

      for (let j = 0; j < chartDeductionLoans.length; j++) {
        const l = chartDeductionLoans[j];
        const t = new Date(l.createdAt).getTime();
        if (t >= startMs && t <= endMs) {
          mInterest += (l.totalInterest || l.processingFee || 0);
        }
      }

      mInterest = Math.round(mInterest * 100) / 100;

      months.push({
        name: start.toLocaleString('default', { month: 'short' }),
        disbursed,
        collected,
        interest: mInterest,
        profit: mInterest,
      });
    }


    // Outstanding separated by Loan Types and Principal vs Interest
    const activeLoanRecords = await prisma.loan.findMany({
      where: { status: 'ACTIVE', ...loanWhere },
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
      EMI: { count: 0, amount: 0, principal: 0, interest: 0, label: 'Reducing Principal (அசலோடு தவணை)' },
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
        // EMI (Reducing Principal)
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

    const responseData = {
      success: true,
      data: {
        outstandingAmount: totalOutstandingPrincipal + totalOutstandingInterest,
        outstandingPrincipal: totalOutstandingPrincipal,
        outstandingInterest: totalOutstandingInterest,
        totalDisbursed: loanAgg._sum.principalAmount || 0,
        totalCollected: paymentAgg._sum.amount || 0,
        totalPrincipalCollected,
        totalInterestCollected: totalActualProfit, // Pure interest profit collected so far
        totalPenaltyCollected: totalPenaltyCollectedAmt, // Total penalty collected
        totalCombinedProfit, // Total Profit (Interest + Penalty)
        activeCustomers,
        activeLoans,
        todayCollection: todaysPayments._sum.amount || 0,
        todayPrincipalCollected,
        todayInterestCollected,
        todayPenaltyCollected,
        todayCombinedProfit,
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
          principalCollected: monthlyCashPrincipal,
          interestCollected: monthlyCashInterest,
          penaltyCollected: monthlyCashPenalty,
          interestIncome: monthlyInterestIncome,
          profit: monthlyInterestIncome,
        },
        monthlyTrend: months,
        totalPenaltyCount: penaltyAgg._count || 0,
        todayPenaltyCount: todayPenaltyAgg._count || 0,
      },
    };
    setCached(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/dashboard/agent
router.get('/agent', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const agentId = req.user.role === 'AGENT' ? req.user.id : (req.query.agentId || null);
    const companyId = req.user.companyId;
    const cacheKey = `agent_${companyId || 'all'}_${agentId || req.user.id}`;
    const cached = getCached(cacheKey, 15000);
    if (cached) {
      return res.json(cached);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await syncOverdueStatus(prisma);

    // Build filters scoped strictly by companyId and agentId
    const loanWhere = { status: 'ACTIVE' };
    if (companyId) loanWhere.companyId = companyId;
    if (agentId) loanWhere.agentId = agentId;

    const repaymentWhere = { dueDate: { gte: today, lt: tomorrow } };
    if (companyId || agentId) {
      repaymentWhere.loan = {};
      if (companyId) repaymentWhere.loan.companyId = companyId;
      if (agentId) repaymentWhere.loan.agentId = agentId;
    }

    const paymentWhere = { collectedAt: { gte: today } };
    if (agentId) paymentWhere.collectedById = agentId;
    if (companyId) paymentWhere.repayment = { loan: { companyId } };

    const paymentWhereAll = {};
    if (agentId) paymentWhereAll.collectedById = agentId;
    if (companyId) paymentWhereAll.repayment = { loan: { companyId } };

    const [collectedToday, totalCollected] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: paymentWhereAll,
        _sum: { amount: true },
        _count: true,
      })
    ]);

    const responseData = {
      success: true,
      data: {
        collectedToday: { amount: collectedToday._sum.amount || 0, count: collectedToday._count },
        totalCollected: { amount: totalCollected._sum.amount || 0, count: totalCollected._count },
      },
    };
    setCached(cacheKey, responseData);
    res.json(responseData);
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
    let deductionLoans = [];
    if (!loanType || loanType === 'ALL' || loanType === 'WITHOUT_INTEREST') {
      deductionLoans = await prisma.loan.findMany({
        where: {
          disbursedAt: { gte: startDate, lte: endDate },
          interestType: 'WITHOUT_INTEREST'
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
    }

    // Build profit entries
    const profitEntries = [];
    let totalProfit = 0;

    // FLAT & EMI: profit comes from payments
    const byLoan = {};
    payments.forEach(p => {
      const loan = p.repayment?.loan;
      if (!loan) return;
      const type = loan.interestType || 'FLAT';
      let profit = 0;
      if (type === 'FLAT') {
        if (p.paymentType !== 'PRINCIPAL') {
          profit = p.amount || 0;
        }
      } else if (type === 'EMI') {
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
    const byType = { FLAT: 0, EMI: 0, WITHOUT_INTEREST: 0 };
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
