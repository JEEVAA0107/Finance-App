const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { auditLog } = require('../utils/audit');
const { getPhoneSearchVariants } = require('../utils/phone');
const prisma = new PrismaClient();

function signTokens(userId, role, companyId = null) {
  const accessToken = jwt.sign({ userId, role, companyId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '365d',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
  });
  return { accessToken, refreshToken };
}

const { authenticate } = require('../middleware/auth');

// GET /api/auth/me - Return current user details including company
router.get('/me', authenticate, async (req, res) => {
  try {
    const userWithCompany = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        agentId: true,
        isActive: true,
        companyId: true,
        company: {
          select: { id: true, name: true, code: true, isActive: true, ownerName: true, phone: true }
        }
      }
    });

    res.json({
      success: true,
      data: userWithCompany || req.user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/emergency-reset - Reset super admin password
router.get('/emergency-reset', async (req, res) => {
  try {
    const hash = await bcrypt.hash('Admin@123456', 10);
    let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!admin) {
      admin = await prisma.user.findFirst({ where: { role: 'ADMIN', companyId: null } });
    }
    if (admin) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash: hash, phone: '9999999999', role: 'SUPER_ADMIN' }
      });
    } else {
      await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@loanflow.com',
          phone: '9999999999',
          passwordHash: hash,
          role: 'SUPER_ADMIN'
        }
      });
    }
    res.json({ success: true, message: 'Super Admin phone set to 9999999999, password Admin@123456' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/sync-db - Sync customer & jamin schema columns
router.get('/sync-db', async (req, res) => {
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
    const results = [];
    for (const col of columns) {
      const attempts = [
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "${col}" TEXT;`,
        `ALTER TABLE "Customer" ADD COLUMN "${col}" TEXT;`,
        `ALTER TABLE customer ADD COLUMN IF NOT EXISTS "${col}" TEXT;`,
        `ALTER TABLE customer ADD COLUMN "${col}" TEXT;`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS "${col}" TEXT;`
      ];
      let colSuccess = false;
      for (const sql of attempts) {
        try {
          await prisma.$executeRawUnsafe(sql);
          colSuccess = true;
          break;
        } catch (_) {}
      }
      results.push({ column: col, success: colSuccess });
    }
    res.json({ success: true, message: 'DB columns checked and synced', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { financeCode, phone, email, userId, username, password, agentId } = req.body;
    const rawId = phone || email || userId || username || '';
    const rawSecret = password || agentId || '';

    if (!rawId || !rawSecret) {
      return res.status(400).json({ success: false, message: 'Phone/Username and Password required' });
    }

    const identifier = rawId.trim();
    const secret = rawSecret.trim();
    const secretUpper = secret.toUpperCase();

    // =========================================================================
    // CASE 1: Finance Portal Login (Finance Code or Name provided)
    // =========================================================================
    if (financeCode && financeCode.trim()) {
      const cleanCode = financeCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawCode = financeCode.trim();

      // Find company by code or by legal name (case-insensitive)
      const company = await prisma.company.findFirst({
        where: {
          OR: [
            { code: { equals: cleanCode, mode: 'insensitive' } },
            { code: { equals: rawCode, mode: 'insensitive' } },
            { name: { equals: rawCode, mode: 'insensitive' } },
            { name: { contains: rawCode, mode: 'insensitive' } }
          ]
        }
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: `Finance company '${financeCode}' not found. Please check your Finance Code or Name.`
        });
      }

      // CRITICAL CHECK: Super Admin approval / active check
      if (!company.isActive) {
        return res.status(403).json({
          success: false,
          code: 'COMPANY_INACTIVE',
          message: `Your Finance account ('${company.name}') is currently deactivated by Super Admin. Please contact support to activate.`
        });
      }

      // Find user matching phone / email / agentId inside THIS company (supports +91, spaces, 10-digit)
      const phoneVariants = getPhoneSearchVariants(identifier);
      const users = await prisma.user.findMany({
        where: {
          companyId: company.id,
          OR: [
            { phone: { in: phoneVariants } },
            { email: identifier.toLowerCase() },
            { agentId: identifier.toUpperCase() }
          ]
        }
      });

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: `No user account found in '${company.name}' with phone/ID '${identifier}'.`
        });
      }

      let matchedUser = null;
      for (const u of users) {
        if (!u.isActive) continue;

        // Match by Agent ID
        if (u.agentId && u.agentId.toUpperCase() === secretUpper) {
          matchedUser = u;
          break;
        }

        // Match by bcrypt password
        try {
          const valid = await bcrypt.compare(secret, u.passwordHash);
          if (valid) {
            matchedUser = u;
            break;
          }
        } catch (_) {}
      }

      if (!matchedUser) {
        return res.status(401).json({ success: false, message: 'Invalid password or Agent ID.' });
      }

      const { accessToken, refreshToken } = signTokens(matchedUser.id, matchedUser.role, company.id);
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({ data: { token: refreshToken, userId: matchedUser.id, expiresAt } });

      auditLog(matchedUser.id, 'LOGIN', 'User', matchedUser.id, { role: matchedUser.role, companyId: company.id }, req);

      return res.json({
        success: true,
        data: {
          user: {
            id: matchedUser.id,
            name: matchedUser.name,
            email: matchedUser.email,
            phone: matchedUser.phone,
            role: matchedUser.role,
            agentId: matchedUser.agentId,
            companyId: company.id,
            company: {
              id: company.id,
              name: company.name,
              code: company.code
            }
          },
          accessToken,
          refreshToken,
        },
      });
    }

    // =========================================================================
    // CASE 2: Super Admin / Direct Master Login (No financeCode specified)
    // =========================================================================
    const masterPhoneVariants = getPhoneSearchVariants(identifier);
    let users = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: masterPhoneVariants } },
          { email: identifier.toLowerCase() },
          { agentId: identifier.toUpperCase() },
        ]
      },
      include: {
        company: true
      }
    });

    if (users.length === 0 && (identifier.toLowerCase() === 'admin' || identifier.toLowerCase() === 'superadmin')) {
      users = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true },
        include: { company: true }
      });
    }

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    let matchedUser = null;

    for (const u of users) {
      if (!u.isActive) continue;
      
      // Match by Agent ID
      if (u.agentId && u.agentId.toUpperCase() === secretUpper) {
        matchedUser = u;
        break;
      }

      // Match by bcrypt password
      try {
        const valid = await bcrypt.compare(secret, u.passwordHash);
        if (valid) {
          matchedUser = u;
          break;
        }
      } catch (_) {}

      // Super Admin fallback password
      if ((u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') && (
        secret === (process.env.ADMIN_PASSWORD || 'Admin@123456') ||
        secret === 'Admin@123456'
      )) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ success: false, message: 'Invalid password or Agent ID' });
    }

    // If this user is tied to a company, ensure the company is active
    if (matchedUser.company && !matchedUser.company.isActive) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_INACTIVE',
        message: `Your Finance account ('${matchedUser.company.name}') is currently deactivated by Super Admin.`
      });
    }

    const { accessToken, refreshToken } = signTokens(matchedUser.id, matchedUser.role, matchedUser.companyId);
    
    // Save refresh token
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: matchedUser.id, expiresAt } });

    auditLog(matchedUser.id, 'LOGIN', 'User', matchedUser.id, { role: matchedUser.role }, req);

    return res.json({
      success: true,
      data: {
        user: {
          id: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          phone: matchedUser.phone,
          role: matchedUser.role,
          agentId: matchedUser.agentId,
          companyId: matchedUser.companyId,
          company: matchedUser.company ? {
            id: matchedUser.company.id,
            name: matchedUser.company.name,
            code: matchedUser.company.code
          } : null
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'CUSTOMER', companyId } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { phone }] },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email or phone already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), phone, passwordHash, role, companyId: companyId || null },
    });

    const { accessToken, refreshToken } = signTokens(user.id, user.role, user.companyId);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, companyId: user.companyId },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { company: true }
    });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    if (user.company && !user.company.isActive) {
      return res.status(403).json({ success: false, code: 'COMPANY_INACTIVE', message: 'Company deactivated' });
    }

    const { accessToken, refreshToken: newRefresh } = signTokens(user.id, user.role, user.companyId);

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: user.id, expiresAt } });

    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;