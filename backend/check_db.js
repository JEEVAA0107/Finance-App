const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.count();
  const loans = await prisma.loan.count();
  const payments = await prisma.payment.count();
  const reps = await prisma.repayment.count();
  
  console.log({ users, loans, payments, reps });
  
  const allPayments = await prisma.payment.findMany();
  console.log("Payments:", allPayments);
}

check().catch(console.error).finally(() => prisma.$disconnect());
