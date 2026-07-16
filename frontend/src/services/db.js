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
    `CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      settings TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'CUSTOMER',
      isActive INTEGER DEFAULT 1,
      companyId TEXT,
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
      companyId TEXT,
      agentId TEXT,
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
      companyId TEXT,
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
    `CREATE INDEX IF NOT EXISTS idx_repayments_loanId ON repayments(loanId)`,
    `CREATE INDEX IF NOT EXISTS idx_loans_customerId ON loans(customerId)`,
    `CREATE INDEX IF NOT EXISTS idx_repayments_status ON repayments(status)`,
    `CREATE INDEX IF NOT EXISTS idx_repayments_dueDate ON repayments(dueDate)`
  ];
  for (const sql of statements) await _run(sql, []);

  // Safe ALTER TABLE migrations for existing schemas
  const migrations = [
    "ALTER TABLE users ADD COLUMN companyId TEXT",
    "ALTER TABLE customers ADD COLUMN companyId TEXT",
    "ALTER TABLE customers ADD COLUMN agentId TEXT",
    "ALTER TABLE loans ADD COLUMN companyId TEXT"
  ];
  for (const sql of migrations) {
    try {
      await _run(sql, []);
    } catch (_) {}
  }
}

async function seedAdminUser() {
  // Clear any corrupt/undefined entries from legacy mock database seed bug
  try {
    const compVal = localStorage.getItem('db_companies');
    if (compVal) {
      const list = JSON.parse(compVal).filter(c => c && c.id && c.id !== 'undefined');
      localStorage.setItem('db_companies', JSON.stringify(list));
    }
    const userVal = localStorage.getItem('db_users');
    if (userVal) {
      const list = JSON.parse(userVal).filter(u => u && u.id && u.id !== 'undefined');
      localStorage.setItem('db_users', JSON.stringify(list));
    }
  } catch (e) {
    console.error('Error clearing legacy seed corrupt entries:', e);
  }

  // 1. Seed default company
  const companyCheck = await _query("SELECT id FROM companies WHERE code='demo' LIMIT 1", []);
  if (companyCheck.length === 0) {
    await _run(
      "INSERT INTO companies (id, name, code, isActive) VALUES (?, ?, ?, 1)",
      ['demo-company-id', 'Demo Finance', 'demo']
    );
  }

  // 2. Seed Super Admin
  const superCheck = await _query("SELECT id FROM users WHERE role='SUPER_ADMIN' LIMIT 1", []);
  if (superCheck.length === 0) {
    await _run(
      "INSERT INTO users (id, name, email, phone, passwordHash, role, companyId) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      ['super-admin-id', 'System Super Admin', 'super@loanflow.com', '9999999999', 'Admin@123456', 'SUPER_ADMIN']
    );
  }

  // 3. Seed Company Admin (Finance Admin)
  const adminCheck = await _query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1", []);
  if (adminCheck.length === 0) {
    await _run(
      "INSERT INTO users (id, name, email, phone, passwordHash, role, companyId) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['demo-admin-id', 'Demo Finance Admin', 'admin@loanflow.com', '6380372501', 'Admin@123456', 'ADMIN', 'demo-company-id']
    );
  }

  // 4. Update any existing legacy data to the default tenant company
  await _run("UPDATE customers SET companyId='demo-company-id' WHERE companyId IS NULL", []);
  await _run("UPDATE loans SET companyId='demo-company-id' WHERE companyId IS NULL", []);
  await _run("UPDATE users SET companyId='demo-company-id' WHERE companyId IS NULL AND role != 'SUPER_ADMIN'", []);

  // Sync user in localStorage
  if (!localStorage.getItem('user')) {
    const adminUser = { id: 'demo-admin-id', name: 'Demo Finance Admin', email: 'admin@loanflow.com', phone: '6380372501', role: 'ADMIN', companyId: 'demo-company-id' };
    localStorage.setItem('user', JSON.stringify(adminUser));
  }
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
  const getTable = (name) => {
    try {
      const val = localStorage.getItem(`db_${name}`);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      return [];
    }
  };
  const saveTable = (name, data) => {
    localStorage.setItem(`db_${name}`, JSON.stringify(data));
  };

  return {
    async _query(sql, params) {
      const q = sql.replace(/\s+/g, ' ').trim();

      if (q.startsWith("SELECT * FROM companies WHERE code = ?") || q.startsWith("SELECT * FROM companies WHERE code=?")) {
        const companies = getTable('companies');
        const c = companies.find(x => x.code === params[0]?.toLowerCase().trim());
        return c ? [c] : [];
      }
      if (q.startsWith("SELECT * FROM companies")) {
        return getTable('companies').sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      }

      // Tenancy Dashboard Metrics Support
      if (q.startsWith("SELECT COUNT(*) as c FROM loans WHERE companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('loans').filter(l => l.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE' AND companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('loans').filter(l => l.status === 'ACTIVE' && l.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM loans WHERE status='CLOSED' AND companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('loans').filter(l => l.status === 'CLOSED' && l.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM loans WHERE status='DEFAULTED' AND companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('loans').filter(l => l.status === 'DEFAULTED' && l.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM customers WHERE isActive=1 AND companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('customers').filter(c => c.isActive === 1 && c.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM users WHERE role='AGENT' AND isActive=1 AND companyId = ?")) {
        const companyId = params[0];
        return [{ c: getTable('users').filter(u => u.role === 'AGENT' && u.isActive === 1 && u.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT SUM(principalAmount) as s FROM loans WHERE companyId = ?")) {
        const companyId = params[0];
        const sum = getTable('loans').filter(l => l.companyId === companyId).reduce((acc, l) => acc + (parseFloat(l.principalAmount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE l.companyId = ?")) {
        const companyId = params[0];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const repayments = getTable('repayments').filter(r => loans.includes(r.loanId)).map(r => r.id);
        const sum = getTable('payments').filter(p => repayments.includes(p.repaymentId)).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT SUM(r.dueAmount) as s, COUNT(*) as c FROM repayments r JOIN loans l ON r.loanId = l.id WHERE r.status='OVERDUE' AND l.companyId = ?")) {
        const companyId = params[0];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const list = getTable('repayments').filter(r => r.status === 'OVERDUE' && loans.includes(r.loanId));
        const sum = list.reduce((acc, r) => acc + (parseFloat(r.dueAmount) || 0), 0);
        return [{ s: sum, c: list.length }];
      }
      if (q.startsWith("SELECT SUM(r.dueAmount) as s FROM repayments r JOIN loans l ON r.loanId = l.id WHERE r.status IN ('PENDING','PARTIAL') AND l.companyId = ?")) {
        const companyId = params[0];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const sum = getTable('repayments').filter(r => ['PENDING','PARTIAL'].includes(r.status) && loans.includes(r.loanId)).reduce((acc, r) => acc + (parseFloat(r.dueAmount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.collectedAt >= ? AND l.companyId = ?")) {
        const minDate = params[0];
        const companyId = params[1];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const repayments = getTable('repayments').filter(r => loans.includes(r.loanId)).map(r => r.id);
        const sum = getTable('payments').filter(p => repayments.includes(p.repaymentId) && p.collectedAt >= minDate).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.paymentType='INTEREST' AND l.companyId = ?")) {
        const companyId = params[0];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const repayments = getTable('repayments').filter(r => loans.includes(r.loanId)).map(r => r.id);
        const sum = getTable('payments').filter(p => repayments.includes(p.repaymentId) && p.paymentType === 'INTEREST').reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.collectedAt >= ? AND p.collectedAt <= ? AND l.companyId = ?")) {
        const start = params[0];
        const end = params[1];
        const companyId = params[2];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const repayments = getTable('repayments').filter(r => loans.includes(r.loanId)).map(r => r.id);
        const sum = getTable('payments').filter(p => repayments.includes(p.repaymentId) && p.collectedAt >= start && p.collectedAt <= end).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE' AND agentId = ? AND companyId = ?")) {
        const agentId = params[0];
        const companyId = params[1];
        return [{ c: getTable('loans').filter(l => l.status === 'ACTIVE' && l.agentId === agentId && l.companyId === companyId).length }];
      }
      if (q.startsWith("SELECT SUM(p.amount) as s, COUNT(p.id) as c FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.collectedAt >= ? AND p.collectedById = ? AND l.companyId = ?")) {
        const minDate = params[0];
        const agentId = params[1];
        const companyId = params[2];
        const loans = getTable('loans').filter(l => l.companyId === companyId).map(l => l.id);
        const repayments = getTable('repayments').filter(r => loans.includes(r.loanId)).map(r => r.id);
        const list = getTable('payments').filter(p => repayments.includes(p.repaymentId) && p.collectedAt >= minDate && p.collectedById === agentId);
        const sum = list.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum, c: list.length }];
      }

      // 1. Simple COUNT & SUM metrics
      if (q === 'SELECT COUNT(*) as c FROM loans') {
        return [{ c: getTable('loans').length }];
      }
      if (q === "SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE'") {
        return [{ c: getTable('loans').filter(l => l.status === 'ACTIVE').length }];
      }
      if (q === "SELECT COUNT(*) as c FROM loans WHERE status='CLOSED'") {
        return [{ c: getTable('loans').filter(l => l.status === 'CLOSED').length }];
      }
      if (q === "SELECT COUNT(*) as c FROM loans WHERE status='DEFAULTED'") {
        return [{ c: getTable('loans').filter(l => l.status === 'DEFAULTED').length }];
      }
      if (q === 'SELECT COUNT(*) as c FROM customers WHERE isActive=1') {
        return [{ c: getTable('customers').filter(c => c.isActive === 1).length }];
      }
      if (q === "SELECT COUNT(*) as c FROM users WHERE role='AGENT' AND isActive=1") {
        return [{ c: getTable('users').filter(u => u.role === 'AGENT' && u.isActive === 1).length }];
      }
      if (q === 'SELECT SUM(principalAmount) as s FROM loans') {
        const sum = getTable('loans').reduce((acc, l) => acc + (parseFloat(l.principalAmount) || 0), 0);
        return [{ s: sum }];
      }
      if (q === 'SELECT SUM(amount) as s FROM payments') {
        const sum = getTable('payments').reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q === "SELECT SUM(dueAmount) as s, COUNT(*) as c FROM repayments WHERE status='OVERDUE'") {
        const list = getTable('repayments').filter(r => r.status === 'OVERDUE');
        const sum = list.reduce((acc, r) => acc + (parseFloat(r.dueAmount) || 0), 0);
        return [{ s: sum, c: list.length }];
      }
      if (q === "SELECT SUM(dueAmount) as s FROM repayments WHERE status IN ('PENDING','PARTIAL')") {
        const sum = getTable('repayments').filter(r => ['PENDING','PARTIAL'].includes(r.status)).reduce((acc, r) => acc + (parseFloat(r.dueAmount) || 0), 0);
        return [{ s: sum }];
      }
      if (q === "SELECT SUM(amount) as s FROM payments WHERE paymentType='INTEREST'") {
        const sum = getTable('payments').filter(p => p.paymentType === 'INTEREST').reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }

      // 2. Auth related queries
      if (q.includes("SELECT * FROM users WHERE (email = ? OR phone = ?)")) {
        const val = params[0]?.toLowerCase().trim();
        const users = getTable('users');
        const u = users.find(x => (x.email?.toLowerCase() === val || x.phone === val) && x.isActive === 1);
        return u ? [u] : [];
      }
      if (q.includes("FROM users WHERE role='ADMIN'")) {
        const u = getTable('users').find(x => x.role === 'ADMIN');
        return u ? [u] : [];
      }
      if (q.startsWith("SELECT id, name, email, phone, role, isActive, createdAt FROM users")) {
        let users = getTable('users');
        if (q.includes("role = ?")) {
          users = users.filter(u => u.role === params[0]);
        }
        return users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (q.includes("FROM users WHERE id = ?") || q.includes("FROM users WHERE id=?")) {
        const u = getTable('users').find(x => x.id === params[0]);
        return u ? [u] : [];
      }

      // 3. Customer query list & detail
      if (q.startsWith("SELECT c.*, (SELECT COUNT(*) FROM loans l WHERE l.customerId = c.id AND l.status = 'ACTIVE') as activeLoans FROM customers c")) {
        let customers = getTable('customers').filter(c => c.isActive === 1);
        const loans = getTable('loans');
        if (params.length > 0 && q.includes("LIKE ?")) {
          const s = params[0].replace(/%/g, '').toLowerCase().trim();
          customers = customers.filter(c =>
            c.name.toLowerCase().includes(s) ||
            c.phone.includes(s) ||
            c.idNumber.toLowerCase().includes(s)
          );
        }
        return customers.map(c => {
          const activeLoans = loans.filter(l => l.customerId === c.id && l.status === 'ACTIVE').length;
          return { ...c, activeLoans };
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (q.startsWith("SELECT id, loanNumber, status FROM loans WHERE customerId = ? AND status = 'ACTIVE'")) {
        return getTable('loans').filter(l => l.customerId === params[0] && l.status === 'ACTIVE');
      }
      if (q.startsWith("SELECT * FROM customers WHERE id = ?")) {
        const c = getTable('customers').find(x => x.id === params[0]);
        return c ? [c] : [];
      }
      if (q.includes("FROM loans") && q.includes("WHERE id") && !q.includes("LEFT JOIN")) {
        const l = getTable('loans').find(x => x.id === params[0]);
        return l ? [l] : [];
      }
      if (q.startsWith("SELECT * FROM customers WHERE isActive=1")) {
        return getTable('customers').filter(c => c.isActive === 1).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      // 4. Loans query list & detail
      if (q.startsWith("SELECT * FROM loans WHERE customerId = ? ORDER BY createdAt DESC")) {
        return getTable('loans').filter(l => l.customerId === params[0]).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (q.startsWith("SELECT * FROM repayments WHERE loanId = ? ORDER BY installmentNo ASC")) {
        return getTable('repayments').filter(r => r.loanId === params[0]).sort((a,b) => a.installmentNo - b.installmentNo);
      }
      if (q.startsWith("SELECT id, loanId, status, dueAmount, paidAmount FROM repayments WHERE loanId IN")) {
        return getTable('repayments').filter(r => params.includes(r.loanId));
      }
      if (q.startsWith("SELECT id, status, dueAmount, paidAmount FROM repayments WHERE loanId = ?")) {
        return getTable('repayments').filter(r => r.loanId === params[0]);
      }
      if (q.includes("SELECT * FROM repayments WHERE loanId") && q.includes("ORDER BY installmentNo DESC")) {
        const list = getTable('repayments').filter(r => r.loanId === params[0]);
        list.sort((a, b) => b.installmentNo - a.installmentNo);
        return list.slice(0, 1);
      }
      if (q.includes("FROM payments p JOIN repayments r ON p.repaymentId = r.id WHERE r.loanId IN")) {
        const payments = getTable('payments');
        const repayments = getTable('repayments');
        const sums = {};
        for (const p of payments) {
          if (p.paymentType !== 'INTEREST') continue;
          const r = repayments.find(x => x.id === p.repaymentId);
          if (r && params.includes(r.loanId)) {
            sums[r.loanId] = (sums[r.loanId] || 0) + p.amount;
          }
        }
        return Object.keys(sums).map(loanId => ({
          loanId,
          total: sums[loanId]
        }));
      }
      if (q.includes("SELECT SUM(amount) as total FROM payments WHERE repaymentId IN")) {
        const loanId = params[0];
        const repIds = getTable('repayments').filter(r => r.loanId === loanId).map(r => r.id);
        const sum = getTable('payments').filter(p => repIds.includes(p.repaymentId) && p.paymentType === 'INTEREST').reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ total: sum }];
      }
      if (q.startsWith("SELECT l.*, c.name as customerName, c.phone as customerPhone FROM loans l LEFT JOIN customers c")) {
        const loans = getTable('loans');
        const customers = getTable('customers');
        return loans.map(l => {
          const c = customers.find(x => x.id === l.customerId);
          return {
            ...l,
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : ''
          };
        }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (q.includes("FROM loans l") && q.includes("c.name as customerName") && q.includes("u.name as agentName") && !q.includes("WHERE l.id")) {
        let loans = getTable('loans');
        if (q.includes("l.status = ?")) {
          loans = loans.filter(l => l.status === params[0]);
        }
        const customers = getTable('customers');
        const users = getTable('users');
        const repayments = getTable('repayments');
        const payments = getTable('payments');
        const rows = loans.map(l => {
          const c = customers.find(x => x.id === l.customerId);
          const u = users.find(x => x.id === l.agentId);
          const loanRepIds = repayments.filter(r => r.loanId === l.id).map(r => r.id);
          const loanPayments = payments.filter(p => loanRepIds.includes(p.repaymentId));
          const closedAtDate = loanPayments.length ? loanPayments.reduce((max, p) => p.collectedAt > max ? p.collectedAt : max, '') : null;
          
          return {
            ...l,
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : '',
            agentName: u ? u.name : '',
            closedAtDate
          };
        });
        return rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      }
      if (q.startsWith("SELECT l.*, c.name as customerName, c.phone as customerPhone, c.address as customerAddress, u.name as agentName, u.phone as agentPhone FROM loans l")) {
        const loanId = params[0];
        const l = getTable('loans').find(x => x.id === loanId);
        if (!l) return [];
        const c = getTable('customers').find(x => x.id === l.customerId);
        const u = getTable('users').find(x => x.id === l.agentId);
        return [{
          ...l,
          customerName: c ? c.name : '',
          customerPhone: c ? c.phone : '',
          customerAddress: c ? c.address : '',
          agentName: u ? u.name : '',
          agentPhone: u ? u.phone : ''
        }];
      }

      // 5. Payments & Repayments query
      if (q.startsWith("SELECT p.*, u.name as collectedByName FROM payments p LEFT JOIN users u ON p.collectedById = u.id WHERE p.repaymentId = ?")) {
        const repId = params[0];
        const users = getTable('users');
        return getTable('payments').filter(p => p.repaymentId === repId).map(p => {
          const u = users.find(x => x.id === p.collectedById);
          return { ...p, collectedByName: u ? u.name : '' };
        });
      }
      if (q.startsWith("SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone FROM repayments r")) {
        let repayments = getTable('repayments');
        if (q.includes("r.status = ?")) {
          repayments = repayments.filter(r => r.status === params[0]);
        }
        if (q.includes("r.dueDate >= ?") && params.length >= 2) {
          const start = params[0];
          const end = params[1];
          repayments = repayments.filter(r => r.dueDate >= start && r.dueDate < end);
        }
        const loans = getTable('loans');
        const customers = getTable('customers');
        const rows = repayments.map(r => {
          const l = loans.find(x => x.id === r.loanId);
          const c = l ? customers.find(x => x.id === l.customerId) : null;
          return {
            ...r,
            loanNumber: l ? l.loanNumber : '',
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : ''
          };
        });
        return rows.sort((a,b) => a.dueDate.localeCompare(b.dueDate));
      }
      if (q.startsWith("SELECT r.*, l.loanNumber, l.agentId, c.name as customerName, c.phone as customerPhone, c.address as customerAddress FROM repayments r")) {
        const start = params[0];
        const end = params[1];
        const repayments = getTable('repayments').filter(r => r.dueDate >= start && r.dueDate < end);
        const loans = getTable('loans');
        const customers = getTable('customers');
        return repayments.map(r => {
          const l = loans.find(x => x.id === r.loanId);
          const c = l ? customers.find(x => x.id === l.customerId) : null;
          return {
            ...r,
            loanNumber: l ? l.loanNumber : '',
            agentId: l ? l.agentId : '',
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : '',
            customerAddress: c ? c.address : ''
          };
        }).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
      }
      if (q.startsWith("SELECT * FROM payments WHERE repaymentId = ?")) {
        return getTable('payments').filter(p => p.repaymentId === params[0]);
      }
      if (q.includes("SELECT COUNT(*) as c FROM repayments WHERE loanId=?") && q.includes("status IN")) {
        const loanId = params[0];
        const count = getTable('repayments').filter(r => r.loanId === loanId && ['PENDING','OVERDUE','PARTIAL'].includes(r.status)).length;
        return [{ c: count }];
      }
      if (q.startsWith("SELECT * FROM loans WHERE id=? AND status=?") || q.startsWith("SELECT * FROM loans WHERE id = ? AND status = ?")) {
        const l = getTable('loans').find(x => x.id === params[0] && x.status === params[1]);
        return l ? [l] : [];
      }
      if (q.startsWith("SELECT l.*, c.name as customerName, c.phone as customerPhone, l.outstandingPrincipal, l.principalAmount FROM loans l")) {
        const l = getTable('loans').find(x => x.id === params[0]);
        if (!l) return [];
        const c = getTable('customers').find(x => x.id === l.customerId);
        return [{
          ...l,
          customerName: c ? c.name : '',
          customerPhone: c ? c.phone : ''
        }];
      }
      if (q.startsWith("SELECT dueDate FROM repayments WHERE loanId=? AND status IN ('PENDING','OVERDUE','PARTIAL')")) {
        const list = getTable('repayments').filter(r => r.loanId === params[0] && ['PENDING','OVERDUE','PARTIAL'].includes(r.status));
        list.sort((a,b) => a.dueDate.localeCompare(b.dueDate));
        return list.length ? [{ dueDate: list[0].dueDate }] : [];
      }
      if (q.startsWith("SELECT c.name, c.phone FROM customers c LEFT JOIN loans l ON l.customerId = c.id WHERE l.id = ?")) {
        const l = getTable('loans').find(x => x.id === params[0]);
        const c = l ? getTable('customers').find(x => x.id === l.customerId) : null;
        return c ? [{ name: c.name, phone: c.phone }] : [];
      }
      if (q.startsWith("SELECT p.*, u.name as collectedByName, l.loanNumber, c.name as customerName, c.phone as customerPhone FROM payments p")) {
        const payments = getTable('payments');
        const users = getTable('users');
        const repayments = getTable('repayments');
        const loans = getTable('loans');
        const customers = getTable('customers');
        return payments.map(p => {
          const u = users.find(x => x.id === p.collectedById);
          const r = repayments.find(x => x.id === p.repaymentId);
          const l = r ? loans.find(x => x.id === r.loanId) : null;
          const c = l ? customers.find(x => x.id === l.customerId) : null;
          return {
            ...p,
            collectedByName: u ? u.name : '',
            loanNumber: l ? l.loanNumber : '',
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : ''
          };
        }).sort((a,b) => b.collectedAt.localeCompare(a.collectedAt));
      }
      if (q.startsWith("SELECT p.*, u.name as collectedByName, r.loanId, l.loanNumber, c.name as customerName, c.phone as customerPhone FROM payments p")) {
        const payments = getTable('payments');
        const users = getTable('users');
        const repayments = getTable('repayments');
        const loans = getTable('loans');
        const customers = getTable('customers');
        return payments.map(p => {
          const u = users.find(x => x.id === p.collectedById);
          const r = repayments.find(x => x.id === p.repaymentId);
          const l = r ? loans.find(x => x.id === r.loanId) : null;
          const c = l ? customers.find(x => x.id === l.customerId) : null;
          return {
            ...p,
            collectedByName: u ? u.name : '',
            loanId: r ? r.loanId : '',
            loanNumber: l ? l.loanNumber : '',
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : ''
          };
        }).sort((a,b) => b.collectedAt.localeCompare(a.collectedAt)).slice(0, 100);
      }

      // 6. Reports & Defaulters
      if (q.startsWith("SELECT SUM(amount) as s, COUNT(*) as c FROM payments WHERE collectedAt >= ?")) {
        const start = params[0];
        const pList = getTable('payments').filter(p => p.collectedAt >= start);
        const sum = pList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum, c: pList.length }];
      }
      if (q.startsWith("SELECT SUM(amount) as s FROM payments WHERE collectedAt >= ?")) {
        const start = params[0];
        const end = params[1];
        let pList = getTable('payments').filter(p => p.collectedAt >= start);
        if (end) pList = pList.filter(p => p.collectedAt <= end);
        const sum = pList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.startsWith("SELECT COUNT(*) as c FROM repayments WHERE status='OVERDUE'")) {
        return [{ c: getTable('repayments').filter(r => r.status === 'OVERDUE').length }];
      }
      if (q.startsWith("SELECT SUM(dueAmount - paidAmount) as s FROM repayments WHERE status='OVERDUE'")) {
        const sum = getTable('repayments').filter(r => r.status === 'OVERDUE').reduce((acc, r) => acc + ((parseFloat(r.dueAmount) || 0) - (parseFloat(r.paidAmount) || 0)), 0);
        return [{ s: sum }];
      }
      if (q.includes("status IN ('PENDING','PARTIAL','OVERDUE')")) {
        const start = params[0];
        const end = params[1];
        const list = getTable('repayments').filter(r => r.dueDate >= start && r.dueDate < end && ['PENDING','PARTIAL','OVERDUE'].includes(r.status));
        if (q.includes("COUNT(*)")) {
          return [{ c: list.length }];
        } else {
          const sum = list.reduce((acc, r) => acc + ((parseFloat(r.dueAmount) || 0) - (parseFloat(r.paidAmount) || 0)), 0);
          return [{ s: sum }];
        }
      }
      if (q.startsWith("SELECT SUM(amount) as s FROM payments WHERE collectedAt >= ? AND collectedAt < ?")) {
        const sum = getTable('payments').filter(p => p.collectedAt >= params[0] && p.collectedAt < params[1]).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }
      if (q.includes("overdueAmount FROM loans l LEFT JOIN customers c")) {
        const loans = getTable('loans').filter(l => l.status === 'ACTIVE');
        const customers = getTable('customers');
        const repayments = getTable('repayments');
        return loans.map(l => {
          const c = customers.find(x => x.id === l.customerId);
          const overdueAmount = repayments.filter(r => r.loanId === l.id && r.status === 'OVERDUE').reduce((acc, r) => acc + ((parseFloat(r.dueAmount) || 0) - (parseFloat(r.paidAmount) || 0)), 0);
          return {
            ...l,
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : '',
            overdueAmount
          };
        });
      }
      if (q.includes("collectedByName, l.loanNumber, c.name as customerName, c.phone as customerPhone FROM payments p WHERE p.collectedAt >= ?")) {
        const start = params[0];
        const end = params[1];
        const payments = getTable('payments').filter(p => p.collectedAt >= start && p.collectedAt < end);
        const users = getTable('users');
        const repayments = getTable('repayments');
        const loans = getTable('loans');
        const customers = getTable('customers');
        return payments.map(p => {
          const u = users.find(x => x.id === p.collectedById);
          const r = repayments.find(x => x.id === p.repaymentId);
          const l = r ? loans.find(x => x.id === r.loanId) : null;
          const c = l ? customers.find(x => x.id === l.customerId) : null;
          return {
            ...p,
            collectedByName: u ? u.name : '',
            loanNumber: l ? l.loanNumber : '',
            customerName: c ? c.name : '',
            customerPhone: c ? c.phone : ''
          };
        }).sort((a,b) => b.collectedAt.localeCompare(a.collectedAt));
      }
      if (q.startsWith("SELECT a.*, u.name as userName, u.role as userRole FROM audit_logs a")) {
        const logs = getTable('audit_logs');
        const users = getTable('users');
        return logs.map(l => {
          const u = users.find(x => x.id === l.userId);
          return { ...l, userName: u ? u.name : '', userRole: u ? u.role : '' };
        }).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
      }
      if (q.startsWith("SELECT SUM(amount) as s FROM payments WHERE collectedAt >= ? AND collectedAt <= ?")) {
        const sum = getTable('payments').filter(p => p.collectedAt >= params[0] && p.collectedAt <= params[1]).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        return [{ s: sum }];
      }

      console.warn("SQL Query not matched in mock:", sql, params);
      return [];
    },

    async _run(sql, params) {
      const q = sql.replace(/\s+/g, ' ').trim();
      
      // 1. CREATE TABLE
      if (q.startsWith("CREATE TABLE")) {
        const match = q.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (match) {
          const tableName = match[1];
          if (!localStorage.getItem(`db_${tableName}`)) {
            saveTable(tableName, []);
          }
        }
        return;
      }

      if (q.startsWith("INSERT INTO companies")) {
        const companies = getTable('companies');
        companies.push({
          id: params[0],
          name: params[1],
          code: params[2],
          isActive: params[3] !== undefined ? params[3] : 1,
          createdAt: new Date().toISOString()
        });
        saveTable('companies', companies);
        return;
      }
      if (q.startsWith("UPDATE companies SET isActive = ? WHERE id = ?") || q.startsWith("UPDATE companies SET isActive=? WHERE id=?")) {
        const companies = getTable('companies');
        const c = companies.find(x => x.id === params[1]);
        if (c) {
          c.isActive = parseInt(params[0]);
          saveTable('companies', companies);
        }
        return;
      }

      // 2. INSERT/UPDATE users
      if (q.startsWith("INSERT INTO users")) {
        const users = getTable('users');
        users.push({
          id: params[0],
          name: params[1],
          email: params[2],
          phone: params[3],
          passwordHash: params[4],
          role: params[5],
          companyId: params[6],
          isActive: 1,
          createdAt: new Date().toISOString()
        });
        saveTable('users', users);
        return;
      }
      if (q.startsWith("UPDATE users SET name=?, email=?, phone=?, role=?, isActive=? WHERE id=?")) {
        const users = getTable('users');
        const u = users.find(x => x.id === params[5]);
        if (u) {
          u.name = params[0];
          u.email = params[1];
          u.phone = params[2];
          u.role = params[3];
          u.isActive = params[4];
          saveTable('users', users);
        }
        return;
      }
      if (q.startsWith("UPDATE users SET passwordHash=? WHERE id=?")) {
        const users = getTable('users');
        const u = users.find(x => x.id === params[1]);
        if (u) {
          u.passwordHash = params[0];
          saveTable('users', users);
        }
        return;
      }

      // 3. INSERT/UPDATE customers
      if (q.startsWith("INSERT INTO customers")) {
        const customers = getTable('customers');
        customers.push({
          id: params[0],
          userId: params[1],
          name: params[2],
          phone: params[3],
          email: params[4],
          address: params[5],
          city: params[6],
          idType: params[7],
          idNumber: params[8],
          companyId: params[9],
          agentId: params[10],
          isActive: 1,
          createdAt: new Date().toISOString()
        });
        saveTable('customers', customers);
        return;
      }
      if (q.startsWith("UPDATE customers SET name=?, phone=?, email=?, address=?, city=?, idType=?, idNumber=? WHERE id=?")) {
        const customers = getTable('customers');
        const c = customers.find(x => x.id === params[7]);
        if (c) {
          c.name = params[0];
          c.phone = params[1];
          c.email = params[2];
          c.address = params[3];
          c.city = params[4];
          c.idType = params[5];
          c.idNumber = params[6];
          saveTable('customers', customers);
        }
        return;
      }
      if (q.startsWith("UPDATE customers SET isActive=0 WHERE id=?")) {
        const customers = getTable('customers');
        const c = customers.find(x => x.id === params[0]);
        if (c) {
          c.isActive = 0;
          saveTable('customers', customers);
        }
        return;
      }

      // 4. INSERT/UPDATE/DELETE loans & repayments
      if (q.startsWith("INSERT INTO loans")) {
        const loans = getTable('loans');
        loans.push({
          id: params[0],
          loanNumber: params[1],
          customerId: params[2],
          agentId: params[3],
          principalAmount: parseFloat(params[4]),
          interestRate: parseFloat(params[5]),
          interestType: params[6],
          tenure: parseInt(params[7]),
          tenureUnit: params[8],
          processingFee: parseFloat(params[9] || 0),
          totalInterest: parseFloat(params[10]),
          totalPayable: parseFloat(params[11]),
          installmentAmount: parseFloat(params[12]),
          interestCollected: 0,
          outstandingPrincipal: parseFloat(params[13]),
          status: params[14],
          startDate: params[15],
          endDate: params[16],
          companyId: params[17],
          createdAt: new Date().toISOString()
        });
        saveTable('loans', loans);
        return;
      }
      if (q.startsWith("INSERT INTO repayments")) {
        const repayments = getTable('repayments');
        repayments.push({
          id: params[0],
          loanId: params[1],
          installmentNo: parseInt(params[2]),
          dueDate: params[3],
          dueAmount: parseFloat(params[4]),
          principal: parseFloat(params[5] || 0),
          interest: parseFloat(params[6]),
          paidAmount: 0,
          paidAt: null,
          status: params[7] || 'PENDING'
        });
        saveTable('repayments', repayments);
        return;
      }
      if (q.startsWith("UPDATE loans SET status=? WHERE id=?")) {
        const loans = getTable('loans');
        const l = loans.find(x => x.id === params[1]);
        if (l) {
          l.status = params[0];
          saveTable('loans', loans);
        }
        return;
      }
      if (q.startsWith("INSERT INTO payments")) {
        const payments = getTable('payments');
        payments.push({
          id: params[0],
          repaymentId: params[1],
          collectedById: params[2],
          amount: parseFloat(params[3]),
          paymentMode: params[4],
          paymentType: params[5],
          reference: params[6],
          notes: params[7],
          collectedAt: new Date().toISOString()
        });
        saveTable('payments', payments);
        return;
      }
      if (q.startsWith("UPDATE repayments SET paidAmount=?, status=?, paidAt=? WHERE id=?")) {
        const repayments = getTable('repayments');
        const r = repayments.find(x => x.id === params[3]);
        if (r) {
          r.paidAmount = parseFloat(params[0]);
          r.status = params[1];
          r.paidAt = params[2];
          saveTable('repayments', repayments);
        }
        return;
      }
      if (q.startsWith("UPDATE loans SET interestCollected = interestCollected + ? WHERE id=?")) {
        const loans = getTable('loans');
        const l = loans.find(x => x.id === params[1]);
        if (l) {
          l.interestCollected = (l.interestCollected || 0) + parseFloat(params[0]);
          saveTable('loans', loans);
        }
        return;
      }
      if (q.startsWith("UPDATE loans SET outstandingPrincipal=0, status='CLOSED' WHERE id=?")) {
        const loans = getTable('loans');
        const l = loans.find(x => x.id === params[0]);
        if (l) {
          l.outstandingPrincipal = 0;
          l.status = 'CLOSED';
          saveTable('loans', loans);
        }
        return;
      }
      if (q.startsWith("DELETE FROM repayments WHERE loanId=?")) {
        let repayments = getTable('repayments');
        repayments = repayments.filter(r => !(r.loanId === params[0] && ['PENDING','OVERDUE'].includes(r.status) && r.paidAmount === 0));
        saveTable('repayments', repayments);
        return;
      }
      if (q.startsWith("UPDATE loans SET outstandingPrincipal=?, status=? WHERE id=?") || q.startsWith("UPDATE loans SET outstandingPrincipal=?, status=? WHERE id = ?")) {
        const loans = getTable('loans');
        const l = loans.find(x => x.id === params[2]);
        if (l) {
          l.outstandingPrincipal = parseFloat(params[0]);
          l.status = params[1];
          saveTable('loans', loans);
        }
        return;
      }
      if (q.startsWith("UPDATE loans SET outstandingPrincipal=? WHERE id=?")) {
        const loans = getTable('loans');
        const l = loans.find(x => x.id === params[1]);
        if (l) {
          l.outstandingPrincipal = parseFloat(params[0]);
          saveTable('loans', loans);
        }
        return;
      }

      // 5. Audit logs
      if (q.startsWith("INSERT INTO audit_logs")) {
        const logs = getTable('audit_logs');
        logs.push({
          id: params[0],
          userId: params[1],
          action: params[2],
          entity: params[3],
          entityId: params[4],
          details: params[5],
          createdAt: new Date().toISOString()
        });
        saveTable('audit_logs', logs);
        return;
      }

      // 6. Overdue background triggers
      if (q.startsWith("UPDATE repayments SET status='OVERDUE' WHERE status='PENDING' AND dueDate < ?")) {
        const repayments = getTable('repayments');
        const limitDate = params[0];
        let updated = false;
        repayments.forEach(r => {
          if (r.status === 'PENDING' && r.dueDate < limitDate) {
            r.status = 'OVERDUE';
            updated = true;
          }
        });
        if (updated) saveTable('repayments', repayments);
        return;
      }
      if (q.startsWith("UPDATE repayments SET status='OVERDUE' WHERE loanId=? AND status='PENDING' AND dueDate < ?")) {
        const repayments = getTable('repayments');
        const loanId = params[0];
        const limitDate = params[1];
        let updated = false;
        repayments.forEach(r => {
          if (r.loanId === loanId && r.status === 'PENDING' && r.dueDate < limitDate) {
            r.status = 'OVERDUE';
            updated = true;
          }
        });
        if (updated) saveTable('repayments', repayments);
        return;
      }

      console.warn("SQL Run not matched in mock:", sql, params);
    }
  };
}
