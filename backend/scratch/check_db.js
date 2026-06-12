const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  const hash = await bcrypt.hash('Admin@123456', 12);
  await prisma.user.update({
    where: { email: 'admin@loanflow.com' },
    data: { passwordHash: hash }
  });
  console.log('Password reset to Admin@123456');
  process.exit(0);
}

reset();
