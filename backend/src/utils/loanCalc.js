// Loan calculation utilities

/**
 * Calculate flat interest loan details
 * Interest = Principal × (Rate/100) × Tenure
 * where Rate is per period (e.g., per week, per month)
 */
function calculateFlatInterest(principal, periodRate, tenure, tenureUnit) {
  const interestPerPeriod = principal * (periodRate / 100);
  const totalInterest = interestPerPeriod * tenure;
  const totalPayable = principal + totalInterest;
  // Installment = interest only (principal is paid separately as lump sum)
  const installmentAmount = interestPerPeriod;

  return {
    totalInterest: round2(totalInterest),
    totalPayable: round2(totalPayable),
    installmentAmount: round2(installmentAmount),
  };
}

/**
 * Calculate reducing balance loan details (EMI)
 * EMI = P × r × (1+r)^n / ((1+r)^n - 1)
 * where r = interest rate per period, n = number of periods
 */
function calculateReducingInterest(principal, periodRate, tenure, tenureUnit) {
  let n = tenure; // number of installments
  let r = periodRate / 100; // period interest rate

  // Interest-only model: installment = interest on full principal per period
  const interestPerPeriod = principal * r;
  const totalInterest = interestPerPeriod * n;
  const totalPayable = principal + totalInterest;

  return {
    totalInterest: round2(totalInterest),
    totalPayable: round2(totalPayable),
    installmentAmount: round2(interestPerPeriod),
  };
}

/**
 * Generate repayment schedule
 * ALL installments are INTEREST-ONLY.
 * Principal is separate and only paid when customer pays a lump sum to close the loan.
 */
function generateSchedule(loan) {
  const { id, principalAmount, interestType, tenure, tenureUnit, startDate, interestRate } = loan;
  const schedule = [];
  const start = new Date(startDate);

  // Interest per period
  const interestPerPeriod = round2(principalAmount * (interestRate / 100));

  for (let i = 1; i <= tenure; i++) {
    const dueDate = new Date(start);
    if (tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + i);
    else if (tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + i * 7);
    else dueDate.setDate(dueDate.getDate() + i);

    schedule.push({
      loanId: id,
      installmentNo: i,
      dueDate,
      dueAmount: interestPerPeriod,   // Only interest — no principal in weekly/monthly installments
      principal: 0,                     // Principal is NOT included in regular installments
      interest: interestPerPeriod,
      status: 'PENDING',
    });
  }

  return schedule;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function generateLoanNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `LN${year}${month}${random}`;
}

/**
 * Update repayment status to OVERDUE ONLY IF the due date has passed (i.e. starting the day AFTER the due date).
 * On the due date itself, if not paid, status remains PENDING/PARTIAL (Due Today).
 * Also fixes any records prematurely marked OVERDUE for today or future dates.
 */
async function syncOverdueStatus(prisma) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 1. Revert any repayments due TODAY or FUTURE that were incorrectly marked OVERDUE
  await prisma.repayment.updateMany({
    where: {
      status: 'OVERDUE',
      dueDate: { gte: startOfToday },
    },
    data: { status: 'PENDING' },
  });

  // 2. Mark repayments as OVERDUE ONLY IF due date is strictly BEFORE start of today (i.e. yesterday or earlier)
  await prisma.repayment.updateMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: startOfToday },
    },
    data: { status: 'OVERDUE' },
  });
}

module.exports = {
  calculateFlatInterest,
  calculateReducingInterest,
  generateSchedule,
  generateLoanNumber,
  syncOverdueStatus,
};
