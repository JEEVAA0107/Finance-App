const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
  }
});

let isClientReady = false;

client.on('qr', (qr) => {
  // Generate and scan this code with your phone
  console.log('\n=========================================');
  console.log('WhatsApp QR Code is ready!');
  console.log('Because terminal QR codes can be broken on some servers, please click the link below to view the QR code clearly:');
  console.log('\n👉 https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr) + ' 👈\n');
  console.log('SCAN THE QR CODE FROM THE LINK ABOVE WITH WHATSAPP TO LINK YOUR ACCOUNT.');
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
const fs = require('fs');

async function sendWhatsAppMessage(phone, message) {
  if (!isClientReady) {
    fs.appendFileSync('wa-error.log', `[${new Date().toISOString()}] Client not ready. Phone: ${phone}\n`);
    console.error(`WhatsApp Client not ready. Failed to send message to ${phone}`);
    return false;
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    const formattedPhone = `${cleanPhone}@c.us`;
    await client.sendMessage(formattedPhone, message);
    fs.appendFileSync('wa-error.log', `[${new Date().toISOString()}] Success sent to ${formattedPhone}\n`);
    console.log(`WhatsApp message sent successfully to ${phone}`);
    return true;
  } catch (error) {
    fs.appendFileSync('wa-error.log', `[${new Date().toISOString()}] Failed sending to ${phone}: ${error.message}\n${error.stack}\n`);
    console.error(`Failed to send WhatsApp message to ${phone}:`, error);
    return false;
  }
}

module.exports = { sendWhatsAppMessage };
