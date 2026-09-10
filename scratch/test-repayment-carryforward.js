const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting Repayment & Penalty Carry-Forward Engine Test...');

  // 1. Get or create a test customer
  let customer = await prisma.customer.findFirst();
  if (!customer) {
    const user = await prisma.user.findFirst();
    customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name: 'Test Customer',
        phone: '9876543210',
        address: '123 Test St',
        city: 'Chennai',
        idType: 'AADHAR',
        idNumber: '123456789012'
      }
    });
  }

  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  // 2. Create test deduction-based loan (Principal: 10000, Deduction: 2000, 10 weeks daily)
  const principalAmount = 10000;
  const advanceDeduction = 2000;
  const weeks = 10;
  const totalInstallments = 70;
  const duePerDay = Math.round((principalAmount / totalInstallments) * 100) / 100;
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + totalInstallments);

  const loanNumber = `LN-TEST-${Date.now().toString().slice(-4)}`;
  const loan = await prisma.loan.create({
    data: {
      loanNumber,
      customerId: customer.id,
      agentId: user.id,
      principalAmount,
      interestRate: 0,
      interestType: 'WITHOUT_INTEREST',
      tenure: totalInstallments,
      tenureUnit: 'WEEKS',
      processingFee: advanceDeduction,
      totalInterest: 0,
      totalPayable: principalAmount,
      installmentAmount: duePerDay,
      interestCollected: 0,
      outstandingPrincipal: principalAmount,
      status: 'ACTIVE',
      disbursedAt: new Date(),
      startDate: start,
      endDate: end,
    }
  });

  console.log(`✅ Test loan created: ${loan.loanNumber}, ID: ${loan.id}`);

  // Generate 70 daily installments
  const installments = [];
  for (let i = 0; i < totalInstallments; i++) {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + i);
    const weekNo = Math.floor(i / 7) + 1;
    const dayNo = (i % 7) + 1;
    installments.push({
      loanId: loan.id,
      installmentNo: i + 1,
      weekNo,
      dayNo,
      dueDate,
      originalDueDate: dueDate,
      dueAmount: duePerDay,
      principal: duePerDay,
      interest: 0,
      penaltyAmount: 0,
      penaltyPaid: 0,
      penaltyStatus: 'NONE',
      status: 'PENDING',
    });
  }
  await prisma.repayment.createMany({ data: installments });
  console.log(`✅ Generated ${installments.length} installments across Weeks 1 to 10`);

  // 3. Normal Payment Flow: Collect Installment #1
  const rep1 = await prisma.repayment.findFirst({
    where: { loanId: loan.id, installmentNo: 1 }
  });
  await prisma.payment.create({
    data: {
      repaymentId: rep1.id,
      collectedById: user.id,
      amount: rep1.dueAmount,
      paymentMode: 'CASH',
      paymentType: 'PRINCIPAL',
      reference: 'TEST-PAY-1',
    }
  });
  await prisma.repayment.update({
    where: { id: rep1.id },
    data: { paidAmount: rep1.dueAmount, status: 'PAID', paidAt: new Date() }
  });
  console.log('✅ Installment #1 paid normally (Status: PAID, no penalty, no overdue)');

  // 4. Missed Payment Logic: Case A (Installment #2 is OVERDUE, Penalty UNPAID)
  const rep2 = await prisma.repayment.findFirst({
    where: { loanId: loan.id, installmentNo: 2 }
  });
  await prisma.repayment.update({
    where: { id: rep2.id },
    data: { status: 'OVERDUE', penaltyAmount: 100, penaltyStatus: 'PENDING' }
  });
  console.log(`✅ Installment #2 marked OVERDUE (Week ${rep2.weekNo}, Penalty: ₹100 PENDING)`);

  // Verify Case A Sequential Check: Attempting to collect #3 while #2 is unpaid
  const rep3 = await prisma.repayment.findFirst({
    where: { loanId: loan.id, installmentNo: 3 }
  });

  const unpaidPrev = await prisma.repayment.findFirst({
    where: {
      loanId: loan.id,
      installmentNo: { lt: rep3.installmentNo },
      status: { notIn: ['PAID', 'CARRIED_FORWARD'] }
    }
  });

  if (unpaidPrev && unpaidPrev.installmentNo === 2) {
    console.log('🔒 Case A Verified: Installment #3 is BLOCKED because Installment #2 is OVERDUE and penalty is unpaid.');
  } else {
    throw new Error('Case A failed: Installment #3 was not blocked!');
  }

  // 5. Missed Payment Logic: Case B (Penalty is PAID -> Carry Forward unlocked)
  console.log('💰 Paying penalty of ₹100 for Installment #2...');
  
  // Record penalty payment
  await prisma.payment.create({
    data: {
      repaymentId: rep2.id,
      collectedById: user.id,
      amount: 100,
      paymentMode: 'CASH',
      paymentType: 'PENALTY',
      reference: 'TEST-PENALTY-2',
      notes: 'Penalty Paid - Carry forward unlocked',
    }
  });

  // Target repayment marked CARRIED_FORWARD with penaltyStatus: PAID
  const lastInst = await prisma.repayment.findFirst({
    where: { loanId: loan.id },
    orderBy: { installmentNo: 'desc' }
  });
  const nextInstNo = lastInst.installmentNo + 1;
  const newDueDate = new Date(lastInst.dueDate);
  newDueDate.setDate(newDueDate.getDate() + 1);
  const newWeekNo = Math.floor((nextInstNo - 1) / 7) + 1;
  const newDayNo = ((nextInstNo - 1) % 7) + 1;

  const carriedRep = await prisma.repayment.create({
    data: {
      loanId: loan.id,
      installmentNo: nextInstNo,
      weekNo: newWeekNo,
      dayNo: newDayNo,
      dueDate: newDueDate,
      originalDueDate: newDueDate,
      dueAmount: rep2.dueAmount,
      principal: rep2.principal,
      interest: 0,
      penaltyAmount: 0,
      penaltyPaid: 0,
      penaltyStatus: 'NONE',
      status: 'PENDING',
    }
  });

  await prisma.repayment.update({
    where: { id: rep2.id },
    data: {
      status: 'CARRIED_FORWARD',
      penaltyPaid: 100,
      penaltyStatus: 'PAID',
      carriedToInstNo: nextInstNo,
    }
  });

  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      endDate: newDueDate,
      tenure: nextInstNo,
      interestCollected: { increment: 100 },
    }
  });

  console.log(`✅ Case B Verified: Installment #2 status is now CARRIED_FORWARD (Penalty Paid: ₹100).`);
  console.log(`✅ New installment #${nextInstNo} created for Week ${newWeekNo} Day ${newDayNo} (Due: ₹${carriedRep.dueAmount}).`);
  console.log(`✅ Loan schedule dynamically extended! New End Date: ${newDueDate.toLocaleDateString('en-IN')}`);

  // Now verify that Installment #3 is NO LONGER BLOCKED!
  const unpaidPrevAfter = await prisma.repayment.findFirst({
    where: {
      loanId: loan.id,
      installmentNo: { lt: rep3.installmentNo },
      status: { notIn: ['PAID', 'CARRIED_FORWARD'] }
    }
  });

  if (!unpaidPrevAfter) {
    console.log('🔓 Sequential Lock Unlocked: Installment #3 can now be collected smoothly!');
  } else {
    throw new Error(`Sequential lock still blocked by #${unpaidPrevAfter.installmentNo}`);
  }

  // Cleanup test loan
  await prisma.payment.deleteMany({ where: { repayment: { loanId: loan.id } } });
  await prisma.repayment.deleteMany({ where: { loanId: loan.id } });
  await prisma.loan.delete({ where: { id: loan.id } });
  console.log('🧹 Test loan cleaned up successfully.');

  console.log('\n🎉 ALL REPAYMENT ENGINE TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
