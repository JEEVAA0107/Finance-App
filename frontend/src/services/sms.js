/**
 * sms.js — Native Android SMS sending via SIM card
 * NO internet needed. Uses phone's own SIM to send SMS.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

// Register the native plugin
const SmsSender = registerPlugin('SmsSender');

/**
 * Send SMS silently via native Android SmsManager (SIM card).
 * Falls back to opening SMS app if permission denied.
 */
export async function sendSMS(phone, message) {
  if (!phone || !message) return;
  const withCode = formatPhone(phone);

  if (Capacitor.isNativePlatform()) {
    try {
      await SmsSender.sendSMS({ phone: withCode, message });
      console.log(`[SMS] Sent to ${withCode}`);
    } catch (err) {
      console.warn('[SMS] Native failed, opening SMS app:', err.message);
      openSmsApp(withCode, message);
    }
  } else {
    console.log(`[SMS DEV] To: ${withCode}\n${message}`);
  }
}

/**
 * Open native SMS app pre-filled (user taps Send).
 * Use this when you want user confirmation before sending.
 */
export function openSmsApp(phone, message) {
  const withCode = formatPhone(phone);
  const encoded = encodeURIComponent(message);
  window.open(`sms:${withCode}?body=${encoded}`, '_system');
}

function formatPhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}

// ─── Message builders ─────────────────────────────────────────────────────────
export function buildPaymentSMS(customerName, amount, nextDueDate, outstandingPrincipal) {
  if (nextDueDate) {
    return `Dear ${customerName}, interest payment of Rs.${amount} received. Next due: ${nextDueDate}. Principal balance: Rs.${outstandingPrincipal}. -LoanFlow Pro`;
  }
  return `Dear ${customerName}, interest payment of Rs.${amount} received. Principal balance: Rs.${outstandingPrincipal}. Thank you. -LoanFlow Pro`;
}

export function buildLoanClosedSMS(customerName, amount) {
  return `Dear ${customerName}, principal payment of Rs.${amount} received. Your loan is FULLY CLOSED. Thank you! -LoanFlow Pro`;
}

export function buildPrincipalSMS(customerName, amount, remaining) {
  return `Dear ${customerName}, principal payment of Rs.${amount} received. Remaining principal: Rs.${remaining}. -LoanFlow Pro`;
}
