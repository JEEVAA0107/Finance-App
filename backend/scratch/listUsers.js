const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { name: true, email: true, phone: true, role: true } });
  console.table(users);
  await p.$disconnect();
}
main();
