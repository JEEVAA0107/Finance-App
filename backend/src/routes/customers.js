const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const prisma = new PrismaClient();

// GET /api/customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { idNumber: { contains: search } },
          ],
        }
      : {};

    // Agents can see all active customers to create new loans
    if (req.user.role === 'CUSTOMER') {
      where.userId = req.user.id;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          loans: {
            where: { status: 'ACTIVE' },
            select: { id: true, loanNumber: true, totalPayable: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: customers, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true } },
        loans: {
          include: {
            repayments: {
              orderBy: { installmentNo: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/customers
router.post('/', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const { name, phone, email, address, city, idType, idNumber } = req.body;

    // Create or find user account for customer (allow sharing User profile if same phone)
    let user = await prisma.user.findFirst({ where: { phone } });

    if (!user && email) {
      const userByEmail = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
      if (userByEmail) {
        return res.status(409).json({ success: false, message: 'Email is already registered to another user' });
      }
    }

    if (!user) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(phone, 12); // default password = phone number
      user = await prisma.user.create({
        data: { name, email: email ? email.toLowerCase() : `${phone}@loanflow.local`, phone, passwordHash, role: 'CUSTOMER' },
      });
    }

    const customer = await prisma.customer.create({
      data: { userId: user.id, name, phone, email, address, city, idType, idNumber },
    });

    await auditLog(req.user.id, 'CREATE_CUSTOMER', 'Customer', customer.id, { name, phone }, req);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const { name, phone, email, address, city, idType, idNumber } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { name, phone, email, address, city, idType, idNumber },
    });
    await auditLog(req.user.id, 'UPDATE_CUSTOMER', 'Customer', customer.id, {}, req);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    await auditLog(req.user.id, 'DELETE_CUSTOMER', 'Customer', req.params.id, {}, req);
    res.json({ success: true, message: 'Customer deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
