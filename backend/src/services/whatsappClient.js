const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

let isClientReady = false;

client.on('qr', (qr) => {
  // Generate and scan this code with your phone
  console.log('\n=========================================');
  console.log('SCAN THIS QR CODE WITH WHATSAPP TO LINK:');
  console.log('=========================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  isClientReady = true;
  console.log('WhatsApp Client is ready!');
});

client.on('authenticated', () => {
  console.log('WhatsApp Client Authenticated successfully.');
});

client.on('auth_failure', msg => {
  console.error('WhatsApp Client Authentication failure', msg);
});

// Initialize client
client.initialize();

/**
 * Send a WhatsApp message
 * @param {string} phone - 10 digit Indian phone number
 * @param {string} message - Message to send
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppMessage(phone, message) {
  if (!isClientReady) {
    console.error(`WhatsApp Client not ready. Failed to send message to ${phone}`);
    return false;
  }

  try {
    // Sanitize phone number (remove spaces, +, -, etc)
    let cleanPhone = phone.replace(/\D/g, '');
    
    // If it's a 10 digit number, prepend 91
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    const formattedPhone = `${cleanPhone}@c.us`;
    await client.sendMessage(formattedPhone, message);
    console.log(`WhatsApp message sent successfully to ${phone}`);
    return true;
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${phone}:`, error);
    return false;
  }
}

module.exports = { sendWhatsAppMessage };
