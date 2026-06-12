import { dbQuery } from './db';

const URL_KEY = 'sheetsScriptUrl';
const LAST_SYNC_KEY = 'lastSheetsSync';

export function getScriptUrl() { return localStorage.getItem(URL_KEY) || ''; }
export function setScriptUrl(url) { localStorage.setItem(URL_KEY, url.trim()); }
export function getLastSync() { return localStorage.getItem(LAST_SYNC_KEY) || null; }
export function queueSync() {} // no-op, kept for compatibility

export async function fullSync() {
  const url = getScriptUrl();
  if (!url) throw new Error('Script URL not set. Go to Settings.');
  if (!navigator.onLine) throw new Error('No internet connection.');

  const [customers, loans, payments] = await Promise.all([
    dbQuery('SELECT * FROM customers WHERE isActive=1 ORDER BY createdAt DESC', []),
    dbQuery(`SELECT l.*, c.name as customerName, c.phone as customerPhone
             FROM loans l LEFT JOIN customers c ON l.customerId=c.id
             ORDER BY l.createdAt DESC`, []),
    dbQuery(`SELECT p.*, u.name as collectedByName,
             l.loanNumber, c.name as customerName, c.phone as customerPhone
             FROM payments p
             LEFT JOIN users u ON p.collectedById=u.id
             LEFT JOIN repayments r ON p.repaymentId=r.id
             LEFT JOIN loans l ON r.loanId=l.id
             LEFT JOIN customers c ON l.customerId=c.id
             ORDER BY p.collectedAt DESC`, []),
  ]);

  const payload = { customers, loans, payments };

  // Log what we're sending
  console.log('Sync payload:', JSON.stringify({ c: customers.length, l: loans.length, p: payments.length }));

  if (customers.length === 0 && loans.length === 0 && payments.length === 0) {
    const { Capacitor } = await import('@capacitor/core');
    throw new Error(`No data found. isNative=${Capacitor.isNativePlatform()} platform=${Capacitor.getPlatform()}`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Sync failed');

  localStorage.setItem(LAST_SYNC_KEY, new Date().toLocaleString('en-IN'));
  return payload;
}

export function initAutoSync() {
  window.addEventListener('online', () => fullSync().catch(() => {}));
}
