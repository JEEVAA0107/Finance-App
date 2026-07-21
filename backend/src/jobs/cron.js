const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { dispatchNotification } = require('../services/notification');

const prisma = new PrismaClient();

async function processReminders() {
  console.log('[Cron] Starting reminder processing...');
  try {
    const setting = await prisma.reminderSetting.findUnique({ where: { id: 'default' } });
    
    if (!setting || !setting.enabled) {
      console.log('[Cron] Reminders are disabled.');
      return;
    }

    let daysBefore;
    try {
      daysBefore = JSON.parse(setting.daysBeforeDue);
    } catch (e) {
      daysBefore = [0, 1]; // Default to same day and 1 day before
    }

    // Find all pending repayments
    const pendingRepayments = await prisma.repayment.findMany({
      where: { status: 'PENDING' },
      include: { loan: { include: { customer: true } } }
    });

    const now = new Date();
    // Reset time to start of day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const repayment of pendingRepayments) {
      if (repayment.loan.status !== 'ACTIVE') continue;

      const due = new Date(repayment.dueDate);
      const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysBefore.includes(diffDays)) {
        // Check if we already sent this specific reminder type today to avoid spamming
        // For simplicity, we just dispatch it. In a production app, we should check NotificationLog
        // to see if a reminder for this repayment was already sent *today*.
        
        const alreadySentToday = await prisma.notificationLog.findFirst({
          where: {
            repaymentId: repayment.id,
            createdAt: {
              gte: today
            }
          }
        });

        if (alreadySentToday) {
          continue; // Skip if already sent today
        }

        let message = '';
        if (diffDays === 0) {
          message = `Hello ${repayment.loan.customer.name}, your loan installment of ₹${repayment.dueAmount} for Loan ${repayment.loan.loanNumber} is due TODAY. Please ensure payment is made.`;
        } else if (diffDays < 0) {
          message = `URGENT: Hello ${repayment.loan.customer.name}, your loan installment of ₹${repayment.dueAmount} for Loan ${repayment.loan.loanNumber} is OVERDUE by ${Math.abs(diffDays)} days.`;
        } else {
          message = `Reminder: Hello ${repayment.loan.customer.name}, your loan installment of ₹${repayment.dueAmount} for Loan ${repayment.loan.loanNumber} is due in ${diffDays} days on ${due.toLocaleDateString()}.`;
        }

        await dispatchNotification(repayment.loan.customer.id, repayment.id, message);
      }
    }
    console.log('[Cron] Reminder processing completed.');
  } catch (error) {
    console.error('[Cron] Error processing reminders:', error);
  }
}

const axios = require('axios');

function pingSelf() {
  const url = process.env.RENDER_EXTERNAL_URL || 'https://finance-app-awae.onrender.com/health';
  axios.get(url).then(() => {
    console.log('[Cron] Keep-alive ping sent to', url);
  }).catch(() => {});
}

// Schedule to run every day at 8:00 AM and keep-alive ping every 10 minutes
const startCronJobs = () => {
  cron.schedule('0 8 * * *', processReminders);
  cron.schedule('*/10 * * * *', pingSelf);
  console.log('[Cron] Background jobs and 24/7 keep-alive ping scheduled.');
};

module.exports = { startCronJobs, processReminders };
