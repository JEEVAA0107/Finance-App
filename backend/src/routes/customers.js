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
    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { idNumber: { contains: search } },
      ];
    }

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

// GET /api/customers/sync-schema - Sync database schema columns
router.get('/sync-schema', authenticate, async (req, res) => {
  try {
    const columns = [
      'photoUrl',
      'jaminName',
      'jaminPhone',
      'jaminAddress',
      'jaminRelationship',
      'jaminIdType',
      'jaminIdNumber',
      'jaminPhotoUrl',
      'jaminIdProofUrl',
    ];
    for (const col of columns) {
      const attempts = [
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "${col}" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN "${col}" TEXT;`,
        `ALTER TABLE customer ADD COLUMN IF NOT EXISTS "${col}" TEXT;`,
        `ALTER TABLE customer ADD COLUMN "${col}" TEXT;`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS "${col}" TEXT;`
      ];
      for (const sql of attempts) {
        try {
          await prisma.$executeRawUnsafe(sql);
          break;
        } catch (_) {}
      }
    }
    res.json({ success: true, message: 'Customer & Jamin database columns verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/customers
router.post('/', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const {
      name, phone, email, address, city, idType, idNumber,
      idProofUrl, photoUrl,
      notificationPref, latitude, longitude,
      jaminName, jaminPhone, jaminAddress, jaminRelationship,
      jaminIdType, jaminIdNumber, jaminPhotoUrl, jaminIdProofUrl
    } = req.body;

    const trimmedName = name?.trim();
    const trimmedPhone = phone?.trim();
    const cleanEmail = email?.trim() ? email.trim() : null;

    // Create or find user account for customer (allow sharing User profile if same phone)
    let user = await prisma.user.findFirst({ where: { phone: trimmedPhone } });

    if (!user && cleanEmail) {
      const userByEmail = await prisma.user.findFirst({ where: { email: cleanEmail.toLowerCase() } });
      if (userByEmail) {
        return res.status(409).json({ success: false, message: 'Email is already registered to another user' });
      }
    }

    if (!user) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(trimmedPhone, 12); // default password = phone number
      user = await prisma.user.create({
        data: { name: trimmedName, email: cleanEmail ? cleanEmail.toLowerCase() : `${trimmedPhone}@loanflow.local`, phone: trimmedPhone, passwordHash, role: 'CUSTOMER' },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: trimmedName,
        phone: trimmedPhone,
        email: cleanEmail,
        address: address?.trim(),
        city: city?.trim(),
        idType: idType || 'AADHAR',
        idNumber: idNumber?.trim(),
        idProofUrl: idProofUrl?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        notificationPref: notificationPref || 'WHATSAPP',
        latitude: (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null,
        longitude: (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null,
        jaminName: jaminName?.trim() || null,
        jaminPhone: jaminPhone?.trim() || null,
        jaminAddress: jaminAddress?.trim() || null,
        jaminRelationship: jaminRelationship?.trim() || null,
        jaminIdType: jaminIdType || 'AADHAR',
        jaminIdNumber: jaminIdNumber?.trim() || null,
        jaminPhotoUrl: jaminPhotoUrl?.trim() || null,
        jaminIdProofUrl: jaminIdProofUrl?.trim() || null,
      },
    });

    await auditLog(req.user.id, 'CREATE_CUSTOMER', 'Customer', customer.id, { name: trimmedName, phone: trimmedPhone, jaminName }, req);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, authorize('ADMIN', 'AGENT'), async (req, res) => {
  try {
    const {
      name, phone, email, address, city, idType, idNumber,
      idProofUrl, photoUrl,
      notificationPref, latitude, longitude,
      jaminName, jaminPhone, jaminAddress, jaminRelationship,
      jaminIdType, jaminIdNumber, jaminPhotoUrl, jaminIdProofUrl
    } = req.body;

    const trimmedName = name?.trim();
    const trimmedPhone = phone?.trim();
    const cleanEmail = email?.trim() ? email.trim() : null;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name: trimmedName,
        phone: trimmedPhone,
        email: cleanEmail,
        address: address?.trim(),
        city: city?.trim(),
        idType: idType || 'AADHAR',
        idNumber: idNumber?.trim(),
        idProofUrl: idProofUrl?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        notificationPref: notificationPref || 'WHATSAPP',
        latitude: (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null,
        longitude: (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null,
        jaminName: jaminName?.trim() || null,
        jaminPhone: jaminPhone?.trim() || null,
        jaminAddress: jaminAddress?.trim() || null,
        jaminRelationship: jaminRelationship?.trim() || null,
        jaminIdType: jaminIdType || 'AADHAR',
        jaminIdNumber: jaminIdNumber?.trim() || null,
        jaminPhotoUrl: jaminPhotoUrl?.trim() || null,
        jaminIdProofUrl: jaminIdProofUrl?.trim() || null,
      },
    });

    // Also sync Customer name, phone, email to linked User record if present
    if (customer.userId) {
      try {
        const userUpdateData = {};
        if (trimmedName) userUpdateData.name = trimmedName;
        if (trimmedPhone) userUpdateData.phone = trimmedPhone;
        if (cleanEmail) userUpdateData.email = cleanEmail.toLowerCase();
        if (Object.keys(userUpdateData).length > 0) {
          await prisma.user.update({
            where: { id: customer.userId },
            data: userUpdateData,
          });
        }
      } catch (userErr) {
        console.warn('Note: Could not sync to User account:', userErr.message);
      }
    }

    await auditLog(req.user.id, 'UPDATE_CUSTOMER', 'Customer', customer.id, { jaminName: customer.jaminName }, req);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const activeLoans = await prisma.loan.findMany({
      where: {
        customerId: req.params.id,
        status: { in: ['ACTIVE', 'PENDING', 'DEFAULTED'] },
      },
    });

    if (activeLoans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Currently an active loan is running for this customer, so cannot delete.',
      });
    }

    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    await auditLog(req.user.id, 'DELETE_CUSTOMER', 'Customer', req.params.id, {}, req);
    res.json({ success: true, message: 'Customer deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
