import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor, registerPlugin } from '@capacitor/core';

const sqlite = new SQLiteConnection(CapacitorSQLite);
const DbStorage = registerPlugin('DbStorage');

let db = null;
let dbReady = false;
let dbInitPromise = null;
let syncTimer = null;

export async function getDb() {
  if (dbReady && db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      if (Capacitor.isNativePlatform()) {
        // On first launch after reinstall, restore from external if internal is empty
        await _restoreIfNeeded();
        db = await sqlite.createConnection('loanflow', false, 'no-encryption', 1, false);
        await db.open();
      } else {
        db = createWebDb();
      }
      await initSchema();
      await seedAdminUser();
      dbReady = true;
      // Sync to external storage on startup
      _scheduleSyncToExternal();
    })();
  }
  await dbInitPromise;
  return db;
}

// Restore from Downloads/LoanFlowPro if internal DB doesn't exist yet
async function _restoreIfNeeded() {
  try {
    const res = await DbStorage.hasExternalBackup();
    if (!res.exists) return;
    // Check if internal DB already has data by trying to open it
    const testDb = await sqlite.createConnection('loanflow', false, 'no-encryption', 1, false);
    try {
      await testDb.open();
      const result = await testDb.query('SELECT COUNT(*) as c FROM users', []);
      const count = result.values?.[0]?.c || 0;
      await testDb.close();
      await sqlite.closeConnection('loanflow', false);
      if (count > 0) return; // Internal DB has data, no need to restore
    } catch (_) {
      try { await testDb.close(); } catch (_) {}
      try { await sqlite.closeConnection('loanflow', false); } catch (_) {}
    }
    // Internal is empty — restore from external
    await DbStorage.restoreFromExternal();
    console.log('✅ Data restored from Downloads/LoanFlowPro');
  } catch (e) {
    console.warn('Restore check failed (normal on first install):', e.message);
  }
}

// Debounced sync — waits 2s after last write before syncing
function _scheduleSyncToExternal() {
  if (!Capacitor.isNativePlatform()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await DbStorage.syncToExternal();
    } catch (e) {
      console.warn('Sync to external failed:', e.message);
    }
  }, 2000);
}

async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'CUSTOMER',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      idType TEXT NOT NULL,
      idNumber TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      loanNumber TEXT UNIQUE NOT NULL,
      customerId TEXT NOT NULL,
      agentId TEXT,
      principalAmount REAL NOT NULL,
      interestRate REAL NOT NULL,
      interestType TEXT DEFAULT 'FLAT',
      tenure INTEGER NOT NULL,
      tenureUnit TEXT NOT NULL,
      processingFee REAL DEFAULT 0,
      totalInterest REAL NOT NULL,
      totalPayable REAL NOT NULL,
      installmentAmount REAL NOT NULL,
      interestCollected REAL DEFAULT 0,
      outstandingPrincipal REAL,
      status TEXT DEFAULT 'ACTIVE',
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS repayments (
      id TEXT PRIMARY KEY,
      loanId TEXT NOT NULL,
      installmentNo INTEGER NOT NULL,
      dueDate TEXT NOT NULL,
      dueAmount REAL NOT NULL,
      principal REAL DEFAULT 0,
      interest REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      paidAt TEXT,
      status TEXT DEFAULT 'PENDING'
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      repaymentId TEXT NOT NULL,
      collectedById TEXT NOT NULL,
      amount REAL NOT NULL,
      paymentMode TEXT DEFAULT 'CASH',
      paymentType TEXT DEFAULT 'INTEREST',
      reference TEXT,
      notes TEXT,
      collectedAt TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT,
      details TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`,
  ];
  for (const sql of statements) await _run(sql, []);
}

async function seedAdminUser() {
  const result = await _query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1", []);
  if (result.length > 0) {
    // Ensure localStorage has the user
    if (!localStorage.getItem('user')) {
      const u = result[0];
      localStorage.setItem('user', JSON.stringify({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role }));
    }
    return;
  }
  const id = _uuid();
  await _run(
    'INSERT INTO users (id, name, email, phone, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [id, 'Super Admin', 'admin@loanflow.com', '6380372501', 'Admin@123456', 'ADMIN']
  );
  const adminUser = { id, name: 'Super Admin', email: 'admin@loanflow.com', phone: '6380372501', role: 'ADMIN' };
  localStorage.setItem('user', JSON.stringify(adminUser));
}

async function _query(sql, params) {
  if (Capacitor.isNativePlatform()) {
    const result = await db.query(sql, params);
    return result.values || [];
  }
  return db._query(sql, params);
}

async function _run(sql, params) {
  if (Capacitor.isNativePlatform()) {
    await db.run(sql, params);
  } else {
    db._run(sql, params);
  }
}

export async function dbQuery(sql, params = []) {
  await getDb();
  return _query(sql, params);
}

export async function dbRun(sql, params = []) {
  await getDb();
  await _run(sql, params);
  // Auto-sync to external after every write
  _scheduleSyncToExternal();
}

export function uuid() { return _uuid(); }

function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function round2(n) { return Math.round(n * 100) / 100; }

export function generateLoanNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `LN${y}${m}${Math.floor(Math.random() * 9000) + 1000}`;
}

function createWebDb() {
  return {
    _query() { return []; },
    _run() {},
  };
}
