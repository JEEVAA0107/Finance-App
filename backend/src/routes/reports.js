const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/reports/defaulters
router.get('/defaulters', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    await prisma.repayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    const defaulters = await prisma.repayment.findMany({
      where: { status: 'OVERDUE' },
      include: {
        loan: {
          include: {
            customer: { select: { name: true, phone: true, address: true, city: true } },
            agent: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: defaulters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/daily-collection
router.get('/daily-collection', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const { date } = req.query;
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const where = { collectedAt: { gte: day, lt: nextDay } };
    if (req.user.role === 'AGENT') where.collectedById = req.user.id;

    const payments = await prisma.payment.findMany({
      where,
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
      orderBy: { collectedAt: 'asc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({ success: true, data: payments, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/customer/:id
router.get('/customer/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        loans: {
          include: {
            repayments: {
              include: { payments: { include: { collectedBy: { select: { name: true } } } } },
              orderBy: { installmentNo: 'asc' },
            },
          },
        },
      },
    });

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
