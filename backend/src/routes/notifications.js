const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { processReminders } = require('../jobs/cron');
const { dispatchNotification } = require('../services/notification');

// Get Dashboard Summary
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const [dueToday, dueTomorrow, upcoming, overdue, sent, failed] = await Promise.all([
      prisma.repayment.count({ where: { status: 'PENDING', dueDate: { gte: today, lt: tomorrow } } }),
      prisma.repayment.count({ where: { status: 'PENDING', dueDate: { gte: tomorrow, lt: nextWeek } } }), // using nextWeek as "upcoming" for simplicity, or just tomorrow to nextWeek
      prisma.repayment.count({ where: { status: 'PENDING', dueDate: { gt: tomorrow } } }),
      prisma.repayment.count({ where: { status: 'PENDING', dueDate: { lt: today } } }),
      prisma.notificationLog.count({ where: { status: 'SENT' } }),
      prisma.notificationLog.count({ where: { status: 'FAILED' } }),
    ]);

    res.json({
      success: true,
      data: { dueToday, dueTomorrow, upcoming, overdue, sent, failed }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Settings
router.get('/settings', async (req, res) => {
  try {
    let setting = await prisma.reminderSetting.findUnique({ where: { id: 'default' } });
    if (!setting) {
      setting = await prisma.reminderSetting.create({ data: { id: 'default' } });
    }
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Settings
router.put('/settings', async (req, res) => {
  try {
    const { enabled, daysBeforeDue } = req.body;
    const setting = await prisma.reminderSetting.upsert({
      where: { id: 'default' },
      update: { enabled, daysBeforeDue: JSON.stringify(daysBeforeDue) },
      create: { id: 'default', enabled, daysBeforeDue: JSON.stringify(daysBeforeDue) }
    });
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Logs/History
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await prisma.notificationLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, phone: true } },
        repayment: { include: { loan: { select: { loanNumber: true } } } }
      }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manually trigger Cron Job (for testing)
router.post('/trigger', async (req, res) => {
  try {
    processReminders(); // Async fire and forget
    res.json({ success: true, message: 'Reminder processing started' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get In-App Notifications for current user (Agent/Customer)
router.get('/in-app', async (req, res) => {
  try {
    // If it's an agent, maybe they want to see alerts? 
    // Usually customers get notifications. For now, fetch ALL APP notifications for dashboard demo.
    const logs = await prisma.notificationLog.findMany({
      where: { type: 'APP', readAt: null },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
  try {
    await prisma.notificationLog.update({
      where: { id: req.params.id },
      data: { readAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
