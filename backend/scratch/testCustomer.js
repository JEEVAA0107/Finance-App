async function run() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing duplicate customer creation...');
    
    // Find or create User
    let user = await prisma.user.findFirst({ where: { phone: '1234567890' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Test Shared User',
          phone: '1234567890',
          email: 'test@example.com',
          passwordHash: 'dummy'
        }
      });
    }
    
    // Create customer 1
    const cust1 = await prisma.customer.create({
      data: {
        userId: user.id,
        name: 'Test Customer 1',
        phone: '1234567890',
        address: '123 Main St',
        city: 'Mumbai',
        idType: 'AADHAR',
        idNumber: '111122223333'
      }
    });
    console.log('Created customer 1:', cust1.id);

    // Create customer 2 with same phone and user
    const cust2 = await prisma.customer.create({
      data: {
        userId: user.id,
        name: 'Test Customer 2',
        phone: '1234567890',
        address: '456 Side St',
        city: 'Pune',
        idType: 'PAN',
        idNumber: 'ABCDE1234F'
      }
    });
    console.log('Created customer 2 with same phone and user successfully:', cust2.id);

    // Clean up
    await prisma.customer.deleteMany({ where: { id: { in: [cust1.id, cust2.id] } } });
    console.log('Cleaned up test customers successfully!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
