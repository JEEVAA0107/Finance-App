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
      } catch (_) { 
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
    }

    return res.status(401).json({ success: false, message: 'Authentication required' });
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
