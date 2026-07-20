const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { sendWhatsAppMessage } = require('./whatsappClient');

async function dispatchNotification(customerId, repaymentId, message) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    const pref = customer.notificationPref || 'BOTH';
    
    // 1. WhatsApp
    if (pref === 'WHATSAPP' || pref === 'BOTH') {
      const waSuccess = await sendWhatsAppMessage(customer.phone, message);
      await prisma.notificationLog.create({
        data: {
          customerId,
          repaymentId,
          type: 'WHATSAPP',
          status: waSuccess ? 'SENT' : 'FAILED',
          message
        }
      });
    }

    // 2. In-App Notification
    if (pref === 'APP' || pref === 'BOTH') {
      await prisma.notificationLog.create({
        data: {
          customerId,
          repaymentId,
          type: 'APP',
          status: 'SENT', // App notifications are always successful to the DB
          message
        }
      });
    }
  } catch (error) {
    console.error('[NotificationService] Error dispatching:', error);
  }
}

module.exports = {
  dispatchNotification,
  sendWhatsAppMessage
};
