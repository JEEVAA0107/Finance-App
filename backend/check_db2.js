const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const loanAgg = await prisma.loan.aggregate({
    where: { status: { in: ['ACTIVE', 'CLOSED', 'DEFAULTED'] } },
    _sum: { principalAmount: true, totalPayable: true, totalInterest: true },
  });
  console.log('Loan Agg:', loanAgg);
  
  const paymentAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
  });
  console.log('Payment Agg:', paymentAgg);
}

check().catch(console.error).finally(() => prisma.$disconnect());
