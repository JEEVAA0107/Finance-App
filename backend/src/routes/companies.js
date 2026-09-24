const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { normalizePhone, isValid10DigitPhone, getPhoneSearchVariants } = require('../utils/phone');
const { invalidateDashboardCache } = require('./dashboard');

// Middleware helper: only allow SUPER_ADMIN or ADMIN with no companyId
const requireSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'SUPER_ADMIN' || (req.user.role === 'ADMIN' && !req.user.companyId))) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Super Admin access required' });
};

// GET /api/companies - List all registered finance companies
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            loans: true,
          }
        },
        users: {
          where: { role: 'ADMIN' },
          select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
          take: 1
        }
      }
    });

    const formatted = companies.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      ownerName: c.ownerName,
      phone: c.phone,
      address: c.address,
      isActive: c.isActive,
      createdAt: c.createdAt,
      stats: {
        users: c._count.users,
        customers: c._count.customers,
        loans: c._count.loans,
      },
      admin: c.users[0] || null
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/companies - Super Admin creates new finance company + provisions its Admin user
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, code, ownerName, phone, password, address } = req.body;

    if (!name || !code || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Company Name, Unique Code, Phone number, and Initial Password are required'
      });
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company code. Use letters and numbers only.'
      });
    }

    if (!isValid10DigitPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number. Please enter a valid 10-digit phone number (+91 is optional).'
      });
    }

    const cleanPhone = normalizePhone(phone);

    // Check if code already exists
    const existingCode = await prisma.company.findUnique({
      where: { code: cleanCode }
    });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Company code '${cleanCode}' is already registered. Please choose a different code.`
      });
    }

    // Check if phone already registered
    const phoneVariants = getPhoneSearchVariants(cleanPhone);
    const existingUser = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } }
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `Phone number '${cleanPhone}' is already in use by another account.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const email = `${cleanCode}_admin@loanflow.local`;

    // Create Company and Admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: name.trim(),
          code: cleanCode,
          ownerName: ownerName?.trim() || name.trim(),
          phone: cleanPhone,
          address: address?.trim() || null,
          isActive: true
        }
      });

      const adminUser = await tx.user.create({
        data: {
          companyId: company.id,
          name: ownerName?.trim() || `${name.trim()} Admin`,
          email,
          phone: cleanPhone,
          passwordHash,
          role: 'ADMIN',
          isActive: true
        }
      });

      return { company, adminUser };
    });

    await auditLog(req.user.id, 'CREATE_COMPANY', 'Company', result.company.id, { name, code: cleanCode }, req);

    res.status(201).json({
      success: true,
      data: {
        company: result.company,
        admin: {
          id: result.adminUser.id,
          name: result.adminUser.name,
          phone: result.adminUser.phone,
          email: result.adminUser.email,
          role: result.adminUser.role
        }
      },
      message: `Finance company '${name}' created successfully with code '${cleanCode}'!`
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/companies/:id - Super Admin updates company details & Admin user credentials
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id;
    const { name, code, ownerName, phone, password, address } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: { where: { role: 'ADMIN' }, take: 1 }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: 'Finance company not found' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Finance company name is required' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Company code is required' });
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Invalid company code. Use letters and numbers only.' });
    }

    // Check code collision if code changed
    if (cleanCode !== company.code.toLowerCase()) {
      const existingCode = await prisma.company.findUnique({ where: { code: cleanCode } });
      if (existingCode && existingCode.id !== companyId) {
        return res.status(409).json({ success: false, message: `Company code '${cleanCode}' is already registered.` });
      }
    }

    if (!phone || !isValid10DigitPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number. Please enter a valid 10-digit phone number (+91 is optional).'
      });
    }

    const cleanPhone = normalizePhone(phone);

    // Check phone collision with other accounts outside this company
    const phoneVariants = getPhoneSearchVariants(cleanPhone);
    const collisionUser = await prisma.user.findFirst({
      where: {
        phone: { in: phoneVariants },
        companyId: { not: companyId }
      }
    });
    if (collisionUser) {
      return res.status(409).json({
        success: false,
        message: `Phone number '${cleanPhone}' is already in use by another account.`
      });
    }

    // Find admin user of this company
    const adminUser = company.users[0] || await prisma.user.findFirst({
      where: { companyId, role: 'ADMIN' }
    });

    // Execute update in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedCompany = await tx.company.update({
        where: { id: companyId },
        data: {
          name: name.trim(),
          code: cleanCode,
          ownerName: ownerName?.trim() || name.trim(),
          phone: cleanPhone,
          address: address?.trim() || null,
        }
      });

      let updatedAdmin = null;
      if (adminUser) {
        const adminUpdate = {
          name: ownerName?.trim() || `${name.trim()} Admin`,
          phone: cleanPhone,
        };
        if (cleanCode !== company.code) {
          adminUpdate.email = `${cleanCode}_admin@loanflow.local`;
        }
        if (password && password.trim().length >= 4) {
          adminUpdate.passwordHash = await bcrypt.hash(password.trim(), 12);
          // Invalidate existing sessions on password change
          await tx.refreshToken.deleteMany({ where: { userId: adminUser.id } });
        }
        updatedAdmin = await tx.user.update({
          where: { id: adminUser.id },
          data: adminUpdate
        });
      }

      return { company: updatedCompany, admin: updatedAdmin };
    });

    if (typeof invalidateDashboardCache === 'function') {
      invalidateDashboardCache(companyId);
    }

    await auditLog(req.user.id, 'UPDATE_COMPANY', 'Company', companyId, {
      name: result.company.name,
      code: result.company.code,
      phone: cleanPhone,
      passwordChanged: !!(password && password.trim().length >= 4)
    }, req);

    res.json({
      success: true,
      message: `Company '${result.company.name}' and credentials updated successfully!`,
      data: {
        company: result.company,
        admin: result.admin ? {
          id: result.admin.id,
          name: result.admin.name,
          phone: result.admin.phone,
          email: result.admin.email,
        } : null
      }
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/companies/:id/status - Toggle Active / Suspended
router.patch('/:id/status', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive boolean flag required' });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.params.id }
    });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { isActive }
    });

    // Also update all users belonging to this company
    await prisma.user.updateMany({
      where: { companyId: req.params.id },
      data: { isActive }
    });

    // If deactivating, wipe all active refresh tokens for this company's users
    if (!isActive) {
      const companyUsers = await prisma.user.findMany({
        where: { companyId: req.params.id },
        select: { id: true }
      });
      const userIds = companyUsers.map(u => u.id);
      if (userIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } }
        });
      }
    }

    await auditLog(req.user.id, 'TOGGLE_COMPANY_STATUS', 'Company', company.id, { isActive }, req);

    res.json({
      success: true,
      data: updated,
      message: isActive
        ? `Finance company '${company.name}' activated successfully.`
        : `Finance company '${company.name}' has been suspended. Staff and Admins cannot log in.`
    });
  } catch (error) {
    console.error('Error toggling company status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/companies/:id/reset-password - Super Admin sets new password for company Admin
router.post('/:id/reset-password', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long' });
    }

    const adminUser = await prisma.user.findFirst({
      where: { companyId: req.params.id, role: 'ADMIN' }
    });

    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'No Admin user found for this company' });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 12);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { passwordHash }
    });

    // Invalidate existing refresh tokens so they must log in with new password
    await prisma.refreshToken.deleteMany({
      where: { userId: adminUser.id }
    });

    await auditLog(req.user.id, 'RESET_COMPANY_ADMIN_PASSWORD', 'User', adminUser.id, { companyId: req.params.id }, req);

    res.json({
      success: true,
      message: `Password updated for ${adminUser.name} (${adminUser.phone}).`
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/companies/:id - Delete company
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { loans: true } }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company._count.loans > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete '${company.name}' because it has ${company._count.loans} existing loans. Deactivate it instead.`
      });
    }

    // Delete users of this company
    await prisma.user.deleteMany({ where: { companyId: req.params.id } });
    await prisma.customer.deleteMany({ where: { companyId: req.params.id } });
    await prisma.company.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: `Company '${company.name}' deleted successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;