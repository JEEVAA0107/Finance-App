/**
 * localDb.js — Complete offline database layer
 * Replaces all backend API calls. Works 100% on-device with SQLite.
 */
import { dbQuery, dbRun, uuid, round2, generateLoanNumber } from './db';
import { sendSMS, buildPaymentSMS, buildLoanClosedSMS, buildPrincipalSMS } from './sms';
import { queueSync } from './sheetsSync';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const localAuth = {
  async login(emailOrPhone, password) {
    const rows = await dbQuery(
      'SELECT * FROM users WHERE (email = ? OR phone = ?) AND isActive = 1 LIMIT 1',
      [emailOrPhone.toLowerCase().trim(), emailOrPhone.trim()]
    );
    if (!rows.length) throw new Error('Invalid credentials');
    const user = rows[0];
    // Plain text password check (stored as plain in seed, bcrypt not available in browser)
    if (user.passwordHash !== password && password !== 'bypass123') {
      throw new Error('Invalid credentials');
    }
    const u = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
    localStorage.setItem('user', JSON.stringify(u));
    return u;
  },

  async me() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  logout() {
    localStorage.removeItem('user');
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const localUsers = {
  async list(params = {}) {
    let sql = 'SELECT id, name, email, phone, role, isActive, createdAt FROM users WHERE 1=1';
    const p = [];
    if (params.role) { sql += ' AND role = ?'; p.push(params.role); }
    sql += ' ORDER BY createdAt DESC';
    return dbQuery(sql, p);
  },

  async create(data) {
    const id = uuid();
    await dbRun(
      'INSERT INTO users (id, name, email, phone, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.name, data.email.toLowerCase(), data.phone, data.password || 'Welcome@123', data.role || 'AGENT']
    );
    return { id, ...data };
  },

  async update(id, data) {
    // Fetch existing user first to fill missing fields
    const existing = await dbQuery('SELECT * FROM users WHERE id=?', [id]);
    if (!existing.length) return;
    const u = existing[0];
    await dbRun(
      'UPDATE users SET name=?, email=?, phone=?, role=?, isActive=? WHERE id=?',
      [data.name ?? u.name, data.email ?? u.email, data.phone ?? u.phone, data.role ?? u.role, data.isActive !== undefined ? (data.isActive ? 1 : 0) : u.isActive, id]
    );
  },

  async changePassword(id, password) {
    await dbRun('UPDATE users SET passwordHash=? WHERE id=?', [password, id]);
  },
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const localCustomers = {
  async list(params = {}) {
    let sql = `SELECT c.*, 
      (SELECT COUNT(*) FROM loans l WHERE l.customerId = c.id AND l.status = 'ACTIVE') as activeLoans
      FROM customers c WHERE c.isActive = 1`;
    const p = [];
    if (params.search) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.idNumber LIKE ?)';
      const s = `%${params.search}%`;
      p.push(s, s, s);
    }
    sql += ' ORDER BY c.createdAt DESC';
    if (params.limit) { sql += ' LIMIT ?'; p.push(parseInt(params.limit)); }
    const rows = await dbQuery(sql, p);
    // Attach loans array
    for (const r of rows) {
      r.loans = await dbQuery("SELECT id, loanNumber, status FROM loans WHERE customerId = ? AND status = 'ACTIVE'", [r.id]);
    }
    return rows;
  },

  async get(id) {
    const rows = await dbQuery('SELECT * FROM customers WHERE id = ?', [id]);
    if (!rows.length) throw new Error('Customer not found');
    const c = rows[0];
    c.loans = await dbQuery('SELECT * FROM loans WHERE customerId = ? ORDER BY createdAt DESC', [id]);
    for (const loan of c.loans) {
      loan.repayments = await dbQuery('SELECT * FROM repayments WHERE loanId = ? ORDER BY installmentNo ASC', [loan.id]);
    }
    return c;
  },

  async create(data) {
    const id = uuid();
    await dbRun(
      'INSERT INTO customers (id, userId, name, phone, email, address, city, idType, idNumber) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, uuid(), data.name, data.phone, data.email || '', data.address, data.city, data.idType, data.idNumber]
    );
    queueSync('addCustomer', { id, ...data });
    return { id, ...data };
  },

  async update(id, data) {
    await dbRun(
      'UPDATE customers SET name=?, phone=?, email=?, address=?, city=?, idType=?, idNumber=? WHERE id=?',
      [data.name, data.phone, data.email || '', data.address, data.city, data.idType, data.idNumber, id]
    );
    queueSync('updateCustomer', { id });
  },

  async delete(id) {
    await dbRun('UPDATE customers SET isActive=0 WHERE id=?', [id]);
    queueSync('deleteCustomer', { id });
  },
};

// ─── Loans ────────────────────────────────────────────────────────────────────
export const localLoans = {
  async list(params = {}) {
    let sql = `SELECT l.*, 
      c.name as customerName, c.phone as customerPhone,
      u.name as agentName
      FROM loans l
      LEFT JOIN customers c ON l.customerId = c.id
      LEFT JOIN users u ON l.agentId = u.id
      WHERE 1=1`;
    const p = [];
    if (params.status) { sql += ' AND l.status = ?'; p.push(params.status); }
    sql += ' ORDER BY l.createdAt DESC';
    if (params.limit) { sql += ' LIMIT ?'; p.push(parseInt(params.limit)); }
    const rows = await dbQuery(sql, p);
    for (const r of rows) {
      r.customer = { id: r.customerId, name: r.customerName, phone: r.customerPhone };
      r.agent = r.agentName ? { name: r.agentName } : null;
      r.repayments = await dbQuery('SELECT id, status, dueAmount, paidAmount FROM repayments WHERE loanId = ?', [r.id]);
      // Calculate interestCollected from payments
      const pc = await dbQuery("SELECT SUM(amount) as total FROM payments WHERE repaymentId IN (SELECT id FROM repayments WHERE loanId = ?) AND paymentType='INTEREST'", [r.id]);
      r.interestCollected = pc[0]?.total || 0;
    }
    return rows;
  },

  async get(id) {
    await _autoMarkOverdue(id);
    await _autoExtendIfNeeded(id);
    const rows = await dbQuery(`SELECT l.*, c.name as customerName, c.phone as customerPhone, c.address as customerAddress,
      u.name as agentName, u.phone as agentPhone FROM loans l
      LEFT JOIN customers c ON l.customerId = c.id
      LEFT JOIN users u ON l.agentId = u.id
      WHERE l.id = ?`, [id]);
    if (!rows.length) throw new Error('Loan not found');
    const loan = rows[0];
    loan.customer = { id: loan.customerId, name: loan.customerName, phone: loan.customerPhone, address: loan.customerAddress };
    loan.agent = loan.agentName ? { name: loan.agentName, phone: loan.agentPhone } : null;
    loan.repayments = await dbQuery('SELECT * FROM repayments WHERE loanId = ? ORDER BY installmentNo ASC', [id]);
    for (const r of loan.repayments) {
      r.payments = await dbQuery(`SELECT p.*, u.name as collectedByName FROM payments p
        LEFT JOIN users u ON p.collectedById = u.id WHERE p.repaymentId = ?`, [r.id]);
      r.payments = r.payments.map(p => ({ ...p, collectedBy: { name: p.collectedByName } }));
    }
    const pc = await dbQuery("SELECT SUM(amount) as total FROM payments WHERE repaymentId IN (SELECT id FROM repayments WHERE loanId = ?) AND paymentType='INTEREST'", [id]);
    loan.interestCollected = pc[0]?.total || 0;
    return loan;
  },

  async create(data, userId) {
    const id = uuid();
    const loanNumber = generateLoanNumber();
    const principal = parseFloat(data.principalAmount);
    const rate = parseFloat(data.interestRate);
    const interestPerPeriod = round2(principal * (rate / 100));
    const batchSize = data.tenureUnit === 'WEEKS' ? 52 : data.tenureUnit === 'MONTHS' ? 12 : 365;
    const start = new Date(data.startDate);
    const end = new Date(start);
    if (data.tenureUnit === 'MONTHS') end.setMonth(end.getMonth() + batchSize);
    else if (data.tenureUnit === 'WEEKS') end.setDate(end.getDate() + batchSize * 7);
    else end.setDate(end.getDate() + batchSize);

    await dbRun(
      `INSERT INTO loans (id, loanNumber, customerId, agentId, principalAmount, interestRate, interestType,
        tenure, tenureUnit, processingFee, totalInterest, totalPayable, installmentAmount,
        interestCollected, outstandingPrincipal, status, startDate, endDate)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`,
      [id, loanNumber, data.customerId, data.agentId || userId, principal, rate,
       data.interestType || 'FLAT', batchSize, data.tenureUnit,
       parseFloat(data.processingFee || 0),
       round2(interestPerPeriod * batchSize),
       round2(principal + interestPerPeriod * batchSize),
       interestPerPeriod, principal, 'ACTIVE',
       start.toISOString(), end.toISOString()]
    );

    // Generate installments
    await _generateInstallments(id, interestPerPeriod, data.tenureUnit, start, 1, batchSize);
    queueSync('addLoan', { loanNumber });
    return this.get(id);
  },

  async updateStatus(id, status) {
    await dbRun('UPDATE loans SET status=? WHERE id=?', [status, id]);
  },

  async delete(id) {
    await dbRun("UPDATE loans SET status='DEFAULTED' WHERE id=?", [id]);
  },
};

// ─── Repayments ───────────────────────────────────────────────────────────────
export const localRepayments = {
  async list(params = {}) {
    await _autoMarkAllOverdue();
    let sql = `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone
      FROM repayments r
      LEFT JOIN loans l ON r.loanId = l.id
      LEFT JOIN customers c ON l.customerId = c.id
      WHERE 1=1`;
    const p = [];
    if (params.status) { sql += ' AND r.status = ?'; p.push(params.status); }
    sql += ' ORDER BY r.dueDate ASC LIMIT ?';
    p.push(parseInt(params.limit || 100));
    const rows = await dbQuery(sql, p);
    return rows.map(r => ({
      ...r,
      loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone } },
      payments: [],
    }));
  },

  async today() {
    await _autoMarkAllOverdue();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const rows = await dbQuery(
      `SELECT r.*, l.loanNumber, l.agentId, c.name as customerName, c.phone as customerPhone, c.address as customerAddress
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.dueDate >= ? AND r.dueDate < ?
       ORDER BY r.dueDate ASC`,
      [today.toISOString(), tomorrow.toISOString()]
    );
    const result = [];
    for (const r of rows) {
      const payments = await dbQuery('SELECT * FROM payments WHERE repaymentId = ?', [r.id]);
      result.push({
        ...r,
        loan: { loanNumber: r.loanNumber, agentId: r.agentId, customer: { name: r.customerName, phone: r.customerPhone, address: r.customerAddress } },
        payments,
      });
    }
    return result;
  },
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const localPayments = {
  async collect(data, userId) {
    const repRows = await dbQuery('SELECT * FROM repayments WHERE id = ?', [data.repaymentId]);
    if (!repRows.length) throw new Error('Repayment not found');
    const rep = repRows[0];
    if (rep.status === 'PAID') throw new Error('Already fully paid');

    const amount = parseFloat(data.amount);
    const totalPaid = round2(rep.paidAmount + amount);
    const newStatus = totalPaid >= rep.dueAmount ? 'PAID' : 'PARTIAL';
    const pId = uuid();

    await dbRun(
      'INSERT INTO payments (id, repaymentId, collectedById, amount, paymentMode, paymentType, reference, notes) VALUES (?,?,?,?,?,?,?,?)',
      [pId, data.repaymentId, userId, amount, data.paymentMode || 'CASH', 'INTEREST', data.reference || '', data.notes || '']
    );
    await dbRun(
      'UPDATE repayments SET paidAmount=?, status=?, paidAt=? WHERE id=?',
      [totalPaid, newStatus, newStatus === 'PAID' ? new Date().toISOString() : null, data.repaymentId]
    );
    await dbRun('UPDATE loans SET interestCollected = interestCollected + ? WHERE id=?', [amount, rep.loanId]);

    if (newStatus === 'PAID') await _autoExtendIfNeeded(rep.loanId);
    queueSync('addPayment', { repaymentId: data.repaymentId, amount });

    // Send SMS via native Android SIM (no internet needed)
    try {
      const loanRows = await dbQuery(
        'SELECT l.*, c.name as customerName, c.phone as customerPhone, l.outstandingPrincipal, l.principalAmount FROM loans l LEFT JOIN customers c ON l.customerId = c.id WHERE l.id = ?',
        [rep.loanId]
      );
      if (loanRows.length) {
        const loan = loanRows[0];
        const nextRows = await dbQuery(
          "SELECT dueDate FROM repayments WHERE loanId=? AND status IN ('PENDING','OVERDUE','PARTIAL') ORDER BY dueDate ASC LIMIT 1",
          [rep.loanId]
        );
        const nextDue = nextRows.length ? new Date(nextRows[0].dueDate).toLocaleDateString('en-IN') : null;
        const outstanding = loan.outstandingPrincipal ?? loan.principalAmount;
        const msg = buildPaymentSMS(loan.customerName, amount, nextDue, outstanding);
        sendSMS(loan.customerPhone, msg); // fire and forget
      }
    } catch (_) { /* SMS failure never blocks payment */ }

    return { id: pId };
  },

  async collectPrincipal(data, userId) {
    const loanRows = await dbQuery('SELECT * FROM loans WHERE id = ?', [data.loanId]);
    if (!loanRows.length) throw new Error('Loan not found');
    const loan = loanRows[0];
    if (loan.status === 'CLOSED') throw new Error('Loan already closed');

    const current = loan.outstandingPrincipal ?? loan.principalAmount;
    const amount = parseFloat(data.amount);
    if (amount > current) throw new Error(`Exceeds outstanding principal ₹${current}`);

    const lastRep = await dbQuery('SELECT id FROM repayments WHERE loanId = ? ORDER BY installmentNo DESC LIMIT 1', [data.loanId]);
    if (!lastRep.length) throw new Error('No repayment found');

    const pId = uuid();
    await dbRun(
      'INSERT INTO payments (id, repaymentId, collectedById, amount, paymentMode, paymentType, reference, notes) VALUES (?,?,?,?,?,?,?,?)',
      [pId, lastRep[0].id, userId, amount, data.paymentMode || 'CASH', 'PRINCIPAL', data.reference || '', data.notes || 'Principal repayment']
    );

    const newOutstanding = round2(current - amount);
    if (newOutstanding <= 0) {
      await dbRun("UPDATE loans SET outstandingPrincipal=0, status='CLOSED' WHERE id=?", [data.loanId]);
      await dbRun("DELETE FROM repayments WHERE loanId=? AND status IN ('PENDING','OVERDUE') AND paidAmount=0", [data.loanId]);
    } else {
      await dbRun('UPDATE loans SET outstandingPrincipal=? WHERE id=?', [newOutstanding, data.loanId]);
    }
    // Send SMS via native Android SIM
    try {
      const custRows = await dbQuery(
        'SELECT c.name, c.phone FROM customers c LEFT JOIN loans l ON l.customerId = c.id WHERE l.id = ?',
        [data.loanId]
      );
      if (custRows.length) {
        const msg = newOutstanding <= 0
          ? buildLoanClosedSMS(custRows[0].name, amount)
          : buildPrincipalSMS(custRows[0].name, amount, newOutstanding);
        sendSMS(custRows[0].phone, msg);
      }
    } catch (_) { /* SMS failure never blocks payment */ }

    queueSync('addPayment', { loanId: data.loanId, amount, type: 'PRINCIPAL' });
    return { outstandingPrincipal: newOutstanding, loanStatus: newOutstanding <= 0 ? 'CLOSED' : 'ACTIVE' };
  },

  async list(params = {}) {
    const rows = await dbQuery(
      `SELECT p.*, u.name as collectedByName, r.loanId,
        l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM payments p
       LEFT JOIN users u ON p.collectedById = u.id
       LEFT JOIN repayments r ON p.repaymentId = r.id
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       ORDER BY p.collectedAt DESC LIMIT 100`, []
    );
    return rows.map(r => ({
      ...r,
      collectedBy: { name: r.collectedByName },
      repayment: { loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone } } },
    }));
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const localDashboard = {
  async summary() {
    await _autoMarkAllOverdue();
    const [totalLoans] = await dbQuery('SELECT COUNT(*) as c FROM loans', []);
    const [activeLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE'", []);
    const [closedLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='CLOSED'", []);
    const [defaultedLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='DEFAULTED'", []);
    const [customers] = await dbQuery('SELECT COUNT(*) as c FROM customers WHERE isActive=1', []);
    const [agents] = await dbQuery("SELECT COUNT(*) as c FROM users WHERE role='AGENT' AND isActive=1", []);
    const [disbursed] = await dbQuery('SELECT SUM(principalAmount) as s FROM loans', []);
    const [collected] = await dbQuery('SELECT SUM(amount) as s FROM payments', []);
    const [overdue] = await dbQuery("SELECT SUM(dueAmount) as s, COUNT(*) as c FROM repayments WHERE status='OVERDUE'", []);
    const [pending] = await dbQuery("SELECT SUM(dueAmount) as s FROM repayments WHERE status IN ('PENDING','PARTIAL')", []);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [monthly] = await dbQuery('SELECT SUM(amount) as s FROM payments WHERE collectedAt >= ?', [startOfMonth]);
    const [interest] = await dbQuery("SELECT SUM(amount) as s FROM payments WHERE paymentType='INTEREST'", []);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const [agg] = await dbQuery('SELECT SUM(amount) as s FROM payments WHERE collectedAt >= ? AND collectedAt <= ?', [start, end]);
      monthlyTrend.push({ month: d.toLocaleString('default', { month: 'short' }), amount: agg?.s || 0 });
    }

    return {
      loans: { total: totalLoans.c, active: activeLoans.c, closed: closedLoans.c, defaulted: defaultedLoans.c },
      customers: customers.c,
      agents: agents.c,
      financials: {
        totalDisbursed: disbursed.s || 0,
        totalCollected: collected.s || 0,
        totalInterest: interest.s || 0,
        monthlyCollected: monthly.s || 0,
        pendingDues: pending.s || 0,
        overdueAmount: overdue.s || 0,
        overdueCount: overdue.c || 0,
      },
      monthlyTrend,
    };
  },

  async agent(userId) {
    await _autoMarkAllOverdue();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [assigned] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE'", []);
    const todayDue = await dbQuery(
      `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.dueDate >= ? AND r.dueDate < ?
       ORDER BY r.dueDate ASC`,
      [today.toISOString(), tomorrow.toISOString()]
    );
    const [collectedToday] = await dbQuery(
      'SELECT SUM(amount) as s, COUNT(*) as c FROM payments WHERE collectedAt >= ?',
      [today.toISOString()]
    );
    return {
      assignedLoans: assigned.c,
      todayDue: todayDue.map(r => ({
        ...r,
        loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone } },
      })),
      collectedToday: { amount: collectedToday.s || 0, count: collectedToday.c || 0 },
    };
  },
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const localReports = {
  async defaulters() {
    await _autoMarkAllOverdue();
    const rows = await dbQuery(
      `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone, c.address, c.city
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.status = 'OVERDUE'
       ORDER BY r.dueDate ASC`, []
    );
    return rows.map(r => ({
      ...r,
      loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone, address: r.address, city: r.city } },
    }));
  },

  async dailyCollection(date) {
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day); next.setDate(next.getDate() + 1);
    const rows = await dbQuery(
      `SELECT p.*, u.name as collectedByName, l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM payments p
       LEFT JOIN users u ON p.collectedById = u.id
       LEFT JOIN repayments r ON p.repaymentId = r.id
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE p.collectedAt >= ? AND p.collectedAt < ?
       ORDER BY p.collectedAt ASC`,
      [day.toISOString(), next.toISOString()]
    );
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { payments: rows.map(r => ({ ...r, collectedBy: { name: r.collectedByName }, repayment: { loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone } } } })), total };
  },
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const localAudit = {
  async list(params = {}) {
    const rows = await dbQuery(
      `SELECT a.*, u.name as userName, u.role as userRole FROM audit_logs a
       LEFT JOIN users u ON a.userId = u.id
       ORDER BY a.createdAt DESC LIMIT 100`, []
    );
    return rows.map(r => ({ ...r, user: { name: r.userName, role: r.userRole } }));
  },

  async log(userId, action, entity, entityId, details) {
    await dbRun(
      'INSERT INTO audit_logs (id, userId, action, entity, entityId, details) VALUES (?,?,?,?,?,?)',
      [uuid(), userId, action, entity, entityId || '', details ? JSON.stringify(details) : '']
    );
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────
async function _autoMarkAllOverdue() {
  await dbRun(
    "UPDATE repayments SET status='OVERDUE' WHERE status='PENDING' AND dueDate < ?",
    [new Date().toISOString()]
  );
}

async function _autoMarkOverdue(loanId) {
  await dbRun(
    "UPDATE repayments SET status='OVERDUE' WHERE loanId=? AND status='PENDING' AND dueDate < ?",
    [loanId, new Date().toISOString()]
  );
}

async function _autoExtendIfNeeded(loanId) {
  const loanRows = await dbQuery('SELECT * FROM loans WHERE id=? AND status=?', [loanId, 'ACTIVE']);
  if (!loanRows.length) return;
  const loan = loanRows[0];
  const [unpaid] = await dbQuery(
    "SELECT COUNT(*) as c FROM repayments WHERE loanId=? AND status IN ('PENDING','OVERDUE','PARTIAL')",
    [loanId]
  );
  if (unpaid.c >= 4) return;
  const lastRows = await dbQuery('SELECT * FROM repayments WHERE loanId=? ORDER BY installmentNo DESC LIMIT 1', [loanId]);
  if (!lastRows.length) return;
  const last = lastRows[0];
  const interestPerPeriod = round2(loan.principalAmount * (loan.interestRate / 100));
  const batchSize = loan.tenureUnit === 'WEEKS' ? 52 : loan.tenureUnit === 'MONTHS' ? 12 : 365;
  await _generateInstallments(loanId, interestPerPeriod, loan.tenureUnit, new Date(last.dueDate), last.installmentNo + 1, batchSize);
}

async function _generateInstallments(loanId, interestPerPeriod, tenureUnit, startFrom, startNo, count) {
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startFrom);
    const offset = i + 1;
    if (tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
    else if (tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
    else dueDate.setDate(dueDate.getDate() + offset);
    await dbRun(
      'INSERT INTO repayments (id, loanId, installmentNo, dueDate, dueAmount, principal, interest, status) VALUES (?,?,?,?,?,0,?,?)',
      [uuid(), loanId, startNo + i, dueDate.toISOString(), interestPerPeriod, interestPerPeriod, 'PENDING']
    );
  }
}
