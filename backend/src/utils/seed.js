const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAdmin() {
  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME || 'Super Admin',
      email: process.env.ADMIN_EMAIL || 'admin@loanflow.com',
      phone: process.env.ADMIN_PHONE || '9999999999',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user seeded:', process.env.ADMIN_EMAIL);
}

module.exports = { seedAdmin };
