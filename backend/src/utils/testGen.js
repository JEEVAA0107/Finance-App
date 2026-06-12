const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { calculateFlatInterest, calculateReducingInterest, generateSchedule, generateLoanNumber } = require('./loanCalc');
const prisma = new PrismaClient();

const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Ayaan", "Krishna", "Ishaan", "Shaurya", "Atharv", "Dhruv", "Kabir", "Ritvik", "Aryan", "Diya", "Aanya", "Priya", "Neha", "Riya", "Sneha", "Kavya", "Ananya", "Ishita", "Anjali"];
const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Reddy", "Nair", "Iyer", "Joshi", "Mishra", "Pandey"];
const locations = [
  { city: "Mumbai", state: "Maharashtra" }, { city: "Delhi", state: "Delhi" }, { city: "Bangalore", state: "Karnataka" },
  { city: "Hyderabad", state: "Telangana" }, { city: "Chennai", state: "Tamil Nadu" }, { city: "Pune", state: "Maharashtra" },
  { city: "Surat", state: "Gujarat" }, { city: "Jaipur", state: "Rajasthan" }, { city: "Lucknow", state: "Uttar Pradesh" }
];

async function seedTestData() {
  console.log('🌱 Generating 100 random customers, dynamic loans, and repayment histories...');
  
  // Create test agent if not exists
  let agent = await prisma.user.findFirst({ where: { role: 'AGENT' } });
  if (!agent) {
    const passwordHash = await bcrypt.hash('agent123', 10);
    agent = await prisma.user.create({
      data: { name: 'Test Field Agent', email: 'agent@loanflow.com', phone: '8888888888', passwordHash, role: 'AGENT' }
    });
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  let customersCreated = 0;
  let loansCreated = 0;

  for (let i = 0; i < 100; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${fn} ${ln}`;
    const phone = `9` + Math.floor(100000000 + Math.random() * 900000000).toString();
    const loc = locations[Math.floor(Math.random() * locations.length)];
    
    // Create Customer
    const passwordHash = await bcrypt.hash(phone, 10);
    const customerUser = await prisma.user.create({
      data: { name, email: `${phone}@test.com`, phone, passwordHash, role: 'CUSTOMER' }
    });
    
    const customer = await prisma.customer.create({
      data: {
        userId: customerUser.id, name, phone, email: `${phone}@test.com`, 
        address: `${Math.floor(Math.random() * 100) + 1} Main Street`, 
        city: loc.city, 
        idType: 'AADHAR', idNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString()
      }
    });

    customersCreated++;

    // 85% chance to have an active loan to properly test analytics
    if (Math.random() > 0.15) {
      const pAmount = [10000, 20000, 50000, 100000, 200000][Math.floor(Math.random() * 5)];
      const iRate = [10, 12, 14, 18, 24][Math.floor(Math.random() * 5)];
      const tenure = [3, 6, 12][Math.floor(Math.random() * 3)];
      const iType = Math.random() > 0.5 ? 'FLAT' : 'REDUCING';
      
      const calc = iType === 'FLAT'
        ? calculateFlatInterest(pAmount, iRate, tenure, 'MONTHS')
        : calculateReducingInterest(pAmount, iRate, tenure, 'MONTHS');

      // Random start date between 4 months ago and today
      const start = new Date();
      // Ensure time logic doesn't mess with today
      start.setHours(10, 0, 0, 0); 
      start.setDate(start.getDate() - Math.floor(Math.random() * 120));
      const end = new Date(start);
      end.setMonth(end.getMonth() + tenure);

      const loan = await prisma.loan.create({
        data: {
          loanNumber: generateLoanNumber(),
          customerId: customer.id,
          agentId: agent.id,
          principalAmount: pAmount, interestRate: iRate, interestType: iType,
          tenure: tenure, tenureUnit: 'MONTHS', processingFee: pAmount * 0.02,
          ...calc, status: 'ACTIVE', disbursedAt: start, startDate: start, endDate: end,
        }
      });

      loansCreated++;

      const schedule = generateSchedule({ ...loan, interestRate: iRate });
      // Bulk insert schedule
      await prisma.repayment.createMany({ data: schedule });

      // Retrieve schedule to simulate realistic past payments
      const reps = await prisma.repayment.findMany({ where: { loanId: loan.id }, orderBy: { dueDate: 'asc' } });
      
      const today = new Date();
      today.setHours(0,0,0,0);
      
      for (const rep of reps) {
        if (rep.dueDate <= today) {
          // 80% chance they paid past dues, 20% defaulted/overdue
          if (Math.random() > 0.2) {
            await prisma.repayment.update({ where: { id: rep.id }, data: { paidAmount: rep.dueAmount, status: 'PAID', paidAt: new Date(rep.dueDate) } });
            await prisma.payment.create({ data: { repaymentId: rep.id, collectedById: admin.id, amount: rep.dueAmount, paymentMode: 'CASH', collectedAt: new Date(rep.dueDate) } });
          } else {
             await prisma.repayment.update({ where: { id: rep.id }, data: { status: 'OVERDUE' }});
          }
        }
      }
      
      // Update overall loan status if all paid early/in full
      const pend = await prisma.repayment.count({ where: { loanId: loan.id, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } } });
      if (pend === 0) await prisma.loan.update({ where: { id: loan.id }, data: { status: 'CLOSED' } });
    }
    
    // Console log every 20 so backend doesn't seem frozen
    if (i % 20 === 0 && i !== 0) {
        console.log(`... Generated ${i} customers so far...`);
    }
  }

  console.log(`✅ SUCCESS! Added ${customersCreated} new customers and ${loansCreated} loans with full repayment histories!`);
}

seedTestData().catch(console.error).finally(() => process.exit(0));
