/**
 * Phone Number Normalization and Validation Utility
 * Supports:
 * - Indian 10-digit mobile numbers
 * - Optional +91 prefix (+91 98765 43210, +919876543210, 919876543210)
 * - Optional leading 0 (09876543210)
 * - Spaces, dashes, dots, parentheses
 */

function normalizePhone(input) {
  if (!input) return '';
  let cleaned = String(input).replace(/[\s\-\(\)\.\,\+]/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

function isValid10DigitPhone(input) {
  const n = normalizePhone(input);
  return /^[0-9]{10}$/.test(n);
}

function getPhoneSearchVariants(input) {
  if (!input) return [];
  const raw = String(input).trim();
  const variants = new Set([raw]);
  const norm = normalizePhone(raw);
  if (norm && norm.length === 10) {
    variants.add(norm);
    variants.add('+91' + norm);
    variants.add('+91 ' + norm);
    variants.add('91' + norm);
    variants.add('0' + norm);
  }
  return Array.from(variants);
}

module.exports = {
  normalizePhone,
  isValid10DigitPhone,
  getPhoneSearchVariants,
};
