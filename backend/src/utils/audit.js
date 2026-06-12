const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auditLog = (userId, action, entity, entityId = null, details = null, req = null) => {
  // Fire and forget: Do NOT await this in the main request flow
  // This prevents audit logging from slowing down the API response
  const data = {
    userId,
    action,
    entity,
    entityId,
    details: details ? JSON.stringify(details) : null,
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
  };

  prisma.auditLog.create({ data })
    .catch(err => console.error('[AuditLog Background Error]', err.message));
};

module.exports = { auditLog };
