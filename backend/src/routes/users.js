const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const prisma = new PrismaClient();

// GET /api/users — Admin only
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const where = role ? { role } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: users, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users — Admin creates agent/customer account
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (existing) return res.status(409).json({ success: false, message: 'Email or phone exists' });

    const passwordHash = await bcrypt.hash(password || 'Welcome@123', 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), phone, passwordHash, role: role || 'AGENT' },
    });

    await auditLog(req.user.id, 'CREATE_USER', 'User', user.id, { role: user.role }, req);
    res.status(201).json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user });
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, email, phone, role, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, email, phone, role, isActive },
    });
    await auditLog(req.user.id, 'UPDATE_USER', 'User', user.id, { isActive }, req);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/users/:id/password
router.patch('/:id/password', authenticate, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
