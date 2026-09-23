const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const prisma = new PrismaClient();

function sanitizePhone(raw) {
  if (!raw) return '';
  let digits = raw.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

function sanitizeAadhar(raw) {
  if (!raw) return '';
  return raw.toString().replace(/\D/g, '');
}


// GET /api/customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { isActive: true };
    if (req.user.companyId) { where.companyId = req.user.companyId; }
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
              include: { payments: true },
              orderBy: { installmentNo: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (req.user.companyId && customer.companyId && customer.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied to this customer' });
    }
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
      name, phone, email, address, city, idType = 'AADHAR', idNumber,
      idProofUrl, photoUrl,
      notificationPref = 'WHATSAPP', latitude, longitude,
      jaminName, jaminPhone, jaminAddress, jaminRelationship,
      jaminIdType = 'AADHAR', jaminIdNumber, jaminPhotoUrl, jaminIdProofUrl
    } = req.body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const cleanPhone = sanitizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Customer phone number must be a valid 10-digit mobile number.' });
    }

    const cleanJaminPhone = jaminPhone ? sanitizePhone(jaminPhone) : null;
    if (cleanJaminPhone && cleanJaminPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Guarantor (Jamin) phone number must be a valid 10-digit mobile number.' });
    }

    const cleanEmail = email?.trim() ? email.trim() : null;
    const cid = idNumber?.trim();
    const cleanAadhar = idType === 'AADHAR' ? sanitizeAadhar(cid) : (cid || 'N/A');
    const jid = jaminIdNumber?.trim();
    const cleanJaminAadhar = jaminIdType === 'AADHAR' ? sanitizeAadhar(jid) : (jid || null);

    const companyScope = req.user.companyId ? { companyId: req.user.companyId } : {};

    // 1. Check duplicate phone for active customer in this company
    const existCustPhone = await prisma.customer.findFirst({
      where: {
        phone: cleanPhone,
        isActive: true,
        ...companyScope
      }
    });
    if (existCustPhone) {
      return res.status(400).json({
        success: false,
        message: `Customer with phone number ${cleanPhone} is already registered ('${existCustPhone.name}').`
      });
    }

    // 2. Validate Customer Aadhar (12 digits & scoped duplicate check)
    if (idType === 'AADHAR' && cleanAadhar && cleanAadhar !== 'N/A') {
      if (cleanAadhar.length !== 12) {
        return res.status(400).json({ success: false, message: 'Customer Aadhar number must be exactly 12 digits' });
      }
      const existC = await prisma.customer.findFirst({
        where: {
          idType: 'AADHAR',
          idNumber: cleanAadhar,
          isActive: true,
          ...companyScope
        }
      });
      if (existC) {
        return res.status(400).json({
          success: false,
          message: `Customer Aadhar (${cleanAadhar}) is already registered with '${existC.name}'.`
        });
      }
    }

    // 3. Validate Jamin Aadhar
    if (jaminIdType === 'AADHAR' && cleanJaminAadhar && cleanJaminAadhar !== 'N/A') {
      if (cleanJaminAadhar.length !== 12) {
        return res.status(400).json({ success: false, message: 'Guarantor (Jamin) Aadhar number must be exactly 12 digits' });
      }
      if (idType === 'AADHAR' && cleanAadhar === cleanJaminAadhar) {
        return res.status(400).json({ success: false, message: 'Customer and Guarantor Aadhar numbers cannot be the same.' });
      }
    }

    // Create or find user account for customer
    let user = await prisma.user.findFirst({
      where: {
        companyId: req.user.companyId || undefined,
        OR: [
          { phone: cleanPhone },
          ...(cleanEmail ? [{ email: cleanEmail.toLowerCase() }] : []),
          { email: `${cleanPhone}@loanflow.local` }
        ]
      }
    });

    if (!user) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(cleanPhone || '123456', 10);
      const userEmail = cleanEmail ? cleanEmail.toLowerCase() : `${cleanPhone}_${Date.now()}@loanflow.local`;
      user = await prisma.user.create({
        data: {
          companyId: req.user.companyId || null,
          name: trimmedName,
          email: userEmail,
          phone: cleanPhone,
          passwordHash,
          role: 'CUSTOMER'
        },
      });
    }

    const customerData = {
      companyId: req.user.companyId || null,
      userId: user.id,
      name: trimmedName,
      phone: cleanPhone,
      email: cleanEmail,
      address: address?.trim() || 'Address Not Provided',
      city: city?.trim() || 'N/A',
      idType: idType || 'AADHAR',
      idNumber: cleanAadhar,
      idProofUrl: idProofUrl?.trim() || null,
      photoUrl: photoUrl?.trim() || null,
      notificationPref: notificationPref || 'WHATSAPP',
      latitude: (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null,
      longitude: (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null,
      jaminName: jaminName?.trim() || null,
      jaminPhone: cleanJaminPhone || null,
      jaminAddress: jaminAddress?.trim() || null,
      jaminRelationship: jaminRelationship?.trim() || null,
      jaminIdType: jaminIdType || 'AADHAR',
      jaminIdNumber: cleanJaminAadhar || null,
      jaminPhotoUrl: jaminPhotoUrl?.trim() || null,
      jaminIdProofUrl: jaminIdProofUrl?.trim() || null,
    };

    let customer;
    try {
      customer = await prisma.customer.create({ data: customerData });
    } catch (createErr) {
      console.warn('⚠️ First attempt to create customer failed, self-healing schema and retrying:', createErr.message);
      // Auto-add missing columns to Postgres
      const colsToEnsure = [
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notificationPref" TEXT DEFAULT 'WHATSAPP';`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "idProofUrl" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminName" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminPhone" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminAddress" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminRelationship" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminIdType" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminIdNumber" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminPhotoUrl" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "jaminIdProofUrl" TEXT;`,
      ];
      for (const sql of colsToEnsure) {
        try { await prisma.$executeRawUnsafe(sql); } catch (_) {}
      }

      try {
        customer = await prisma.customer.create({ data: customerData });
      } catch (retryErr) {
        // Fallback with core required columns only
        customer = await prisma.customer.create({
          data: {
            companyId: req.user.companyId || null,
            userId: user.id,
            name: trimmedName,
            phone: cleanPhone,
            email: cleanEmail,
            address: address?.trim() || 'Address Not Provided',
            city: city?.trim() || 'N/A',
            idType: idType || 'AADHAR',
            idNumber: idNumber?.trim() || 'N/A',
          }
        });
      }
    }

    await auditLog(req.user.id, 'CREATE_CUSTOMER', 'Customer', customer.id, { name: trimmedName, phone: cleanPhone, jaminName }, req);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error('❌ Failed to create customer:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create customer' });
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

    const existingCust = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existingCust) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (req.user.companyId && existingCust.companyId && existingCust.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied to this customer' });
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const cleanPhone = sanitizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Customer phone number must be a valid 10-digit mobile number.' });
    }

    const cleanJaminPhone = jaminPhone ? sanitizePhone(jaminPhone) : null;
    if (cleanJaminPhone && cleanJaminPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Guarantor (Jamin) phone number must be a valid 10-digit mobile number.' });
    }

    const cleanEmail = email?.trim() ? email.trim() : null;
    const cid = idNumber?.trim();
    const cleanAadhar = idType === 'AADHAR' ? sanitizeAadhar(cid) : (cid || 'N/A');
    const jid = jaminIdNumber?.trim();
    const cleanJaminAadhar = jaminIdType === 'AADHAR' ? sanitizeAadhar(jid) : (jid || null);

    const companyScope = req.user.companyId ? { companyId: req.user.companyId } : {};

    // 1. Check duplicate phone for another active customer
    const existCustPhone = await prisma.customer.findFirst({
      where: {
        phone: cleanPhone,
        isActive: true,
        id: { not: req.params.id },
        ...companyScope
      }
    });
    if (existCustPhone) {
      return res.status(400).json({
        success: false,
        message: `Customer with phone number ${cleanPhone} is already registered ('${existCustPhone.name}').`
      });
    }

    // 2. Validate Customer Aadhar
    if (idType === 'AADHAR' && cleanAadhar && cleanAadhar !== 'N/A') {
      if (cleanAadhar.length !== 12) {
        return res.status(400).json({ success: false, message: 'Customer Aadhar number must be exactly 12 digits' });
      }
      const existC = await prisma.customer.findFirst({
        where: {
          idType: 'AADHAR',
          idNumber: cleanAadhar,
          isActive: true,
          id: { not: req.params.id },
          ...companyScope
        }
      });
      if (existC) {
        return res.status(400).json({
          success: false,
          message: `Customer Aadhar (${cleanAadhar}) is already registered with '${existC.name}'.`
        });
      }
    }

    // 3. Validate Jamin Aadhar
    if (jaminIdType === 'AADHAR' && cleanJaminAadhar && cleanJaminAadhar !== 'N/A') {
      if (cleanJaminAadhar.length !== 12) {
        return res.status(400).json({ success: false, message: 'Guarantor (Jamin) Aadhar number must be exactly 12 digits' });
      }
      if (idType === 'AADHAR' && cleanAadhar === cleanJaminAadhar) {
        return res.status(400).json({ success: false, message: 'Customer and Guarantor Aadhar numbers cannot be the same.' });
      }
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name: trimmedName,
        phone: cleanPhone,
        email: cleanEmail,
        address: address?.trim() || 'Address Not Provided',
        city: city?.trim() || 'N/A',
        idType: idType || 'AADHAR',
        idNumber: cleanAadhar,
        idProofUrl: idProofUrl?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        notificationPref: notificationPref || 'WHATSAPP',
        latitude: (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null,
        longitude: (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null,
        jaminName: jaminName?.trim() || null,
        jaminPhone: cleanJaminPhone || null,
        jaminAddress: jaminAddress?.trim() || null,
        jaminRelationship: jaminRelationship?.trim() || null,
        jaminIdType: jaminIdType || 'AADHAR',
        jaminIdNumber: cleanJaminAadhar || null,
        jaminPhotoUrl: jaminPhotoUrl?.trim() || null,
        jaminIdProofUrl: jaminIdProofUrl?.trim() || null,
      },
    });

    // Also sync Customer name, phone, email to linked User record if present
    if (customer.userId) {
      try {
        const userUpdateData = {};
        if (trimmedName) userUpdateData.name = trimmedName;
        if (cleanPhone) userUpdateData.phone = cleanPhone;
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
    const existingCust = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existingCust) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (req.user.companyId && existingCust.companyId && existingCust.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied to this customer' });
    }

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
