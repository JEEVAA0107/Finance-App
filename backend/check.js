const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const loan = await prisma.loan.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { payments: true }
  });
  console.log('Outstanding Principal:', loan.outstandingPrincipal);
  console.log('Principal Amount:', loan.principalAmount);
  console.log('Payments:', loan.payments);
}
main().catch(console.error).finally(() => prisma.());
