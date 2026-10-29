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

// GET /api/companies/my-settings - Get current company's profile & financial settings
router.get('/my-settings', authenticate, async (req, res) => {
  try {
    let companyId = req.user.companyId;
    if (!companyId) {
      const firstCompany = await prisma.company.findFirst();
      companyId = firstCompany ? firstCompany.id : null;
    }

    if (!companyId) {
      return res.json({
        success: true,
        data: { company: null, settings: null }
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { customers: true, loans: true, users: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    let parsedSettings = {};
    if (company.settingsJson) {
      try {
        parsedSettings = JSON.parse(company.settingsJson);
      } catch (_) {}
    }

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          code: company.code,
          ownerName: company.ownerName,
          phone: company.phone,
          address: company.address,
          stats: company._count
        },
        settings: parsedSettings
      }
    });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/companies/my-settings - Update company profile & financial settings (Admin / Super Admin)
router.put('/my-settings', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin access required to modify financial settings' });
    }

    let companyId = req.user.companyId;
    if (!companyId) {
      const firstCompany = await prisma.company.findFirst();
      companyId = firstCompany ? firstCompany.id : null;
    }

    if (!companyId) {
      return res.status(404).json({ success: false, message: 'No company found' });
    }

    const { companyName, ownerName, phone, address, settings } = req.body;

    const updateData = {};
    if (companyName && companyName.trim()) updateData.name = companyName.trim();
    if (ownerName !== undefined) updateData.ownerName = ownerName ? ownerName.trim() : null;
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (settings) {
      updateData.settingsJson = typeof settings === 'string' ? settings : JSON.stringify(settings);
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    if (typeof invalidateDashboardCache === 'function') {
      invalidateDashboardCache(companyId);
    }

    await auditLog(req.user.id, 'UPDATE_SETTINGS', 'Company', companyId, {
      name: updated.name,
      updatedFields: Object.keys(updateData)
    }, req);

    res.json({
      success: true,
      message: 'Financial settings and company profile updated successfully!',
      data: {
        company: updated,
        settings: settings || {}
      }
    });
  } catch (error) {
    console.error('Error updating company settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/companies/backup-export - One-click full financial data export
router.get('/backup-export', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin access required for backup export' });
    }

    let companyId = req.user.companyId;
    const whereCompany = companyId ? { companyId } : {};

    const [company, customers, loans, payments, schemes] = await Promise.all([
      companyId ? prisma.company.findUnique({ where: { id: companyId } }) : prisma.company.findFirst(),
      prisma.customer.findMany({ where: whereCompany }),
      prisma.loan.findMany({
        where: whereCompany,
        include: { repayments: true }
      }),
      prisma.payment.findMany({
        where: companyId ? { repayment: { loan: { companyId } } } : {},
        take: 5000,
        orderBy: { collectedAt: 'desc' }
      }),
      prisma.loanScheme.findMany({ where: whereCompany })
    ]);

    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.name,
        company,
        stats: {
          customerCount: customers.length,
          loanCount: loans.length,
          paymentCount: payments.length,
          schemeCount: schemes.length
        },
        customers,
        loans,
        payments,
        schemes
      }
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// DELETE /api/companies/:id - Delete company (Super Admin with full cascade)
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { loans: true, customers: true, users: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Execute full cascade deletion in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Find all loans belonging to this company
      const companyLoans = await tx.loan.findMany({
        where: { companyId },
        select: { id: true }
      });
      const loanIds = companyLoans.map(l => l.id);

      if (loanIds.length > 0) {
        // Find repayments belonging to these loans
        const companyRepayments = await tx.repayment.findMany({
          where: { loanId: { in: loanIds } },
          select: { id: true }
        });
        const repaymentIds = companyRepayments.map(r => r.id);

        if (repaymentIds.length > 0) {
          // Delete payments of repayments
          await tx.payment.deleteMany({
            where: { repaymentId: { in: repaymentIds } }
          });
          // Delete notification logs of repayments
          await tx.notificationLog.deleteMany({
            where: { repaymentId: { in: repaymentIds } }
          });
          // Delete repayments
          await tx.repayment.deleteMany({
            where: { id: { in: repaymentIds } }
          });
        }

        // Delete loans
        await tx.loan.deleteMany({
          where: { id: { in: loanIds } }
        });
      }

      // 2. Find and delete customers
      const companyCustomers = await tx.customer.findMany({
        where: { companyId },
        select: { id: true }
      });
      const customerIds = companyCustomers.map(c => c.id);
      if (customerIds.length > 0) {
        await tx.notificationLog.deleteMany({
          where: { customerId: { in: customerIds } }
        });
        await tx.customer.deleteMany({
          where: { id: { in: customerIds } }
        });
      }

      // 3. Delete expenses & schemes
      await tx.expense.deleteMany({ where: { companyId } });
      await tx.loanScheme.deleteMany({ where: { companyId } });

      // 4. Find users belonging to this company
      const companyUsers = await tx.user.findMany({
        where: { companyId },
        select: { id: true }
      });
      const userIds = companyUsers.map(u => u.id);
      if (userIds.length > 0) {
        await tx.refreshToken.deleteMany({
          where: { userId: { in: userIds } }
        });
        await tx.auditLog.deleteMany({
          where: { userId: { in: userIds } }
        });
        await tx.user.deleteMany({
          where: { id: { in: userIds } }
        });
      }

      // 5. Delete company
      await tx.company.delete({ where: { id: companyId } });
    });

    if (typeof invalidateDashboardCache === 'function') {
      invalidateDashboardCache(companyId);
    }

    try {
      await auditLog(req.user.id, 'DELETE_COMPANY', 'Company', companyId, {
        name: company.name,
        code: company.code
      }, req);
    } catch (_) {}

    res.json({
      success: true,
      message: `Company '${company.name}' and all associated records deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;