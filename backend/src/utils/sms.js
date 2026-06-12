const axios = require('axios');

async function sendToDevice(deviceId, apiKey, phone, message) {
  return await axios.post(
    `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
    {
      recipients: [phone],
      message: message
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      }
    }
  );
}

async function sendSMS(phone, message) {
  try {
    const API_KEY = process.env.TEXTBEE_API_KEY;
    const PRIMARY_DEVICE = process.env.TEXTBEE_DEVICE_ID;
    const BACKUP_DEVICE = process.env.TEXTBEE_DEVICE_ID_BACKUP;

    if (!API_KEY || !PRIMARY_DEVICE) {
      console.warn('SMS skipped: TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID not set in .env');
      return false;
    }

    try {
      // 1. Attempt sending with the Primary Android Phone first
      await sendToDevice(PRIMARY_DEVICE, API_KEY, phone, message);
      console.log(`SMS successfully sent to ${phone} via PRIMARY device.`);
      return true;
    } catch (primaryError) {
      console.error('Primary SMS device failed (limit reached or offline).', primaryError.response?.data?.message || primaryError.message);
      
      // 2. If it fails, check if a Backup Device is configured and attempt it
      if (BACKUP_DEVICE && BACKUP_DEVICE.trim() !== "") {
        console.log(`Switching to BACKUP device to send SMS to ${phone}...`);
        try {
          await sendToDevice(BACKUP_DEVICE, API_KEY, phone, message);
          console.log(`SMS successfully sent to ${phone} via BACKUP device.`);
          return true;
        } catch (backupError) {
          console.error('Backup SMS device ALSO failed.', backupError.response?.data?.message || backupError.message);
          return false;
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Critical failure in SMS utility:', error.message);
    return false;
  }
}

module.exports = { sendSMS };
