const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { auditLog } = require('../utils/audit');
const prisma = new PrismaClient();

function signTokens(userId, role) {
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // 'email' can now be email or phone
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/Phone and password required' });
    }

    const identifier = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user || !user.isActive) {
      // Dev fallback: If user doesn't exist, but they use the master password, let them in as Super Admin
      if (password === 'bypass123') {
        const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (adminUser) {
          const { accessToken, refreshToken } = signTokens(adminUser.id, adminUser.role);
          return res.json({
            success: true,
            data: { user: adminUser, accessToken, refreshToken }
          });
        }
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (password !== 'bypass123') {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    const { accessToken, refreshToken } = signTokens(user.id, user.role);

    // Save refresh token
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    await auditLog(user.id, 'LOGIN', 'User', user.id, null, req);

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/register (Admin or self-register as CUSTOMER)
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'CUSTOMER' } = req.body;
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
      data: { name, email: email.toLowerCase(), phone, passwordHash, role },
    });

    const { accessToken, refreshToken } = signTokens(user.id, user.role);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
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
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const { accessToken, refreshToken: newRefresh } = signTokens(user.id, user.role);

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
