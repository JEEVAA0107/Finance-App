const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  try {
    // Try JWT token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
        });
        if (user && user.isActive) {
          req.user = user;
          return next();
        }
      } catch (_) { /* token invalid, fall through to bypass */ }
    }

    // BYPASS: Auto-login as first Admin (dev mode)
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    });

    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'No admin user found. Run seed first.' });
    }

    req.user = adminUser;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Auth error: ' + error.message });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

module.exports = { authenticate, authorize };
