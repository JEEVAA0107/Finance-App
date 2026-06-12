const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('Agent@123', 12);
  const agent = await p.user.create({
    data: {
      name: 'Agent One',
      email: 'agent@loanflow.com',
      phone: '9999900001',
      passwordHash,
      role: 'AGENT',
    },
  });
  console.log('Agent created:');
  console.log('  Email:', agent.email);
  console.log('  Phone:', agent.phone);
  console.log('  Password: Agent@123');
  console.log('  Role:', agent.role);
  await p.$disconnect();
}
main();
