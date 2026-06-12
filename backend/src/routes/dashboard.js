const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/dashboard/summary
router.get('/summary', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalLoans,
      activeLoans,
      closedLoans,
      defaultedLoans,
      totalCustomers,
      totalAgents,
    ] = await Promise.all([
      prisma.loan.count(),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.count({ where: { status: 'CLOSED' } }),
      prisma.loan.count({ where: { status: 'DEFAULTED' } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'AGENT', isActive: true } }),
    ]);

    // Financial aggregates
    const loanAgg = await prisma.loan.aggregate({
      _sum: { principalAmount: true, totalPayable: true, totalInterest: true },
    });

    const paymentAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
    });

    const monthlyPayments = await prisma.payment.aggregate({
      where: { collectedAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    // Overdue count
    await prisma.repayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    const overdueAgg = await prisma.repayment.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { dueAmount: true },
      _count: true,
    });

    const pendingAgg = await prisma.repayment.aggregate({
      where: { status: { in: ['PENDING', 'PARTIAL'] } },
      _sum: { dueAmount: true },
    });

    // Monthly collection trend (last 6 months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const agg = await prisma.payment.aggregate({
        where: { collectedAt: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      months.push({
        month: start.toLocaleString('default', { month: 'short' }),
        year: start.getFullYear(),
        amount: agg._sum.amount || 0,
      });
    }

    res.json({
      success: true,
      data: {
        loans: { total: totalLoans, active: activeLoans, closed: closedLoans, defaulted: defaultedLoans },
        customers: totalCustomers,
        agents: totalAgents,
        financials: {
          totalDisbursed: loanAgg._sum.principalAmount || 0,
          totalPayable: loanAgg._sum.totalPayable || 0,
          totalInterest: loanAgg._sum.totalInterest || 0,
          totalCollected: paymentAgg._sum.amount || 0,
          monthlyCollected: monthlyPayments._sum.amount || 0,
          pendingDues: pendingAgg._sum.dueAmount || 0,
          overdueAmount: overdueAgg._sum.dueAmount || 0,
          overdueCount: overdueAgg._count || 0,
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

    await prisma.repayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

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
