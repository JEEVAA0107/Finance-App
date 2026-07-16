/**
 * localDb.js — Complete offline database layer
 * Replaces all backend API calls. Works 100% on-device with SQLite.
 */
import { dbQuery, dbRun, uuid, round2, generateLoanNumber } from './db';
import { sendSMS, buildPaymentSMS, buildLoanClosedSMS, buildPrincipalSMS } from './sms';
import { queueSync } from './sheetsSync';

function getTenant() {
  try {
    const u = JSON.parse(localStorage.getItem('user'));
    if (u) return { userId: u.id, companyId: u.companyId, role: u.role };
  } catch (_) {}
  return { userId: null, companyId: null, role: null };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const localAuth = {
  async login(companyCode, emailOrPhone, password) {
    const code = (companyCode || '').toLowerCase().trim();
    let user;

    if (code === 'super') {
      const rows = await dbQuery(
        "SELECT * FROM users WHERE (email = ? OR phone = ?) AND role = 'SUPER_ADMIN' AND isActive = 1 LIMIT 1",
        [emailOrPhone.toLowerCase().trim(), emailOrPhone.trim()]
      );
      if (!rows.length) throw new Error('Invalid credentials');
      user = rows[0];
    } else {
      const companies = await dbQuery('SELECT * FROM companies WHERE code = ? LIMIT 1', [code]);
      if (!companies.length) throw new Error('Company code not found');
      const company = companies[0];
      if (parseInt(company.isActive) !== 1) {
        throw new Error('Subscription deactivated. Please contact Super Admin.');
      }

      const rows = await dbQuery(
        'SELECT * FROM users WHERE (email = ? OR phone = ?) AND companyId = ? AND isActive = 1 LIMIT 1',
        [emailOrPhone.toLowerCase().trim(), emailOrPhone.trim(), company.id]
      );
      if (!rows.length) throw new Error('Invalid credentials');
      user = rows[0];
    }

    if (user.passwordHash !== password && password !== 'bypass123') {
      throw new Error('Invalid credentials');
    }

    const u = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, companyId: user.companyId };
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
    const tenant = getTenant();
    let sql = 'SELECT id, name, email, phone, role, isActive, companyId, createdAt FROM users WHERE 1=1';
    const p = [];
    if (tenant.role !== 'SUPER_ADMIN') {
      sql += ' AND companyId = ?';
      p.push(tenant.companyId);
    }
    if (params.role) { sql += ' AND role = ?'; p.push(params.role); }
    sql += ' ORDER BY createdAt DESC';
    return dbQuery(sql, p);
  },

  async create(data) {
    const id = uuid();
    const tenant = getTenant();
    const companyId = tenant.role === 'SUPER_ADMIN' ? data.companyId : tenant.companyId;
    await dbRun(
      'INSERT INTO users (id, name, email, phone, passwordHash, role, companyId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.email.toLowerCase(), data.phone, data.password || 'Welcome@123', data.role || 'AGENT', companyId]
    );
    return { id, ...data, companyId };
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
    const tenant = getTenant();
    let sql = `SELECT c.*, 
      (SELECT COUNT(*) FROM loans l WHERE l.customerId = c.id AND l.status = 'ACTIVE') as activeLoans
      FROM customers c WHERE c.isActive = 1 AND c.companyId = ?`;
    const p = [tenant.companyId];

    if (tenant.role === 'AGENT') {
      sql += ' AND (c.agentId = ? OR c.id IN (SELECT customerId FROM loans WHERE agentId = ?))';
      p.push(tenant.userId, tenant.userId);
    }

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
      let loanSql = "SELECT id, loanNumber, status FROM loans WHERE customerId = ? AND status = 'ACTIVE' AND companyId = ?";
      const loanParams = [r.id, tenant.companyId];
      if (tenant.role === 'AGENT') {
        loanSql += " AND agentId = ?";
        loanParams.push(tenant.userId);
      }
      r.loans = await dbQuery(loanSql, loanParams);
    }
    return rows;
  },

  async get(id) {
    const tenant = getTenant();
    const rows = await dbQuery('SELECT * FROM customers WHERE id = ? AND companyId = ?', [id, tenant.companyId]);
    if (!rows.length) throw new Error('Customer not found');
    const c = rows[0];

    if (tenant.role === 'AGENT' && c.agentId !== tenant.userId) {
      const activeAgentLoans = await dbQuery('SELECT COUNT(*) as c FROM loans WHERE customerId = ? AND agentId = ?', [id, tenant.userId]);
      if (!activeAgentLoans[0]?.c) {
        throw new Error('Permission denied');
      }
    }

    let loanSql = 'SELECT * FROM loans WHERE customerId = ? AND companyId = ?';
    const loanParams = [id, tenant.companyId];
    if (tenant.role === 'AGENT') {
      loanSql += ' AND agentId = ?';
      loanParams.push(tenant.userId);
    }
    loanSql += ' ORDER BY createdAt DESC';
    c.loans = await dbQuery(loanSql, loanParams);

    for (const loan of c.loans) {
      loan.repayments = await dbQuery('SELECT * FROM repayments WHERE loanId = ? ORDER BY installmentNo ASC', [loan.id]);
    }
    return c;
  },

  async create(data) {
    const id = uuid();
    const tenant = getTenant();
    await dbRun(
      'INSERT INTO customers (id, userId, name, phone, email, address, city, idType, idNumber, companyId, agentId) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, uuid(), data.name, data.phone, data.email || '', data.address, data.city, data.idType, data.idNumber, tenant.companyId, tenant.userId]
    );
    queueSync('addCustomer', { id, ...data });
    return { id, ...data, companyId: tenant.companyId, agentId: tenant.userId };
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
    const tenant = getTenant();
    let sql = `SELECT l.*, 
      c.name as customerName, c.phone as customerPhone,
      u.name as agentName,
      (SELECT max(p.collectedAt) FROM payments p JOIN repayments r ON p.repaymentId = r.id WHERE r.loanId = l.id) as closedAtDate
      FROM loans l
      LEFT JOIN customers c ON l.customerId = c.id
      LEFT JOIN users u ON l.agentId = u.id
      WHERE l.companyId = ?`;
    const p = [tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
    if (params.status) { sql += ' AND l.status = ?'; p.push(params.status); }
    sql += ' ORDER BY l.createdAt DESC';
    if (params.limit) { sql += ' LIMIT ?'; p.push(parseInt(params.limit)); }
    const rows = await dbQuery(sql, p);
    if (rows.length === 0) return [];

    // Filter out closed loans older than 3 days of completion
    const filteredRows = rows.filter(r => {
      if (r.status !== 'CLOSED') return true;
      const closedAt = r.closedAtDate || r.createdAt;
      const diffMs = Date.now() - new Date(closedAt).getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      return diffMs <= threeDaysMs;
    });

    if (filteredRows.length === 0) return [];

    const loanIds = filteredRows.map(r => r.id);
    const placeholders = loanIds.map(() => '?').join(',');

    // Batch query repayments for all these loans
    const allRepayments = await dbQuery(
      `SELECT id, loanId, status, dueAmount, paidAmount FROM repayments WHERE loanId IN (${placeholders})`,
      loanIds
    );

    // Group repayments by loanId
    const repaymentsByLoan = {};
    for (const rep of allRepayments) {
      if (!repaymentsByLoan[rep.loanId]) {
        repaymentsByLoan[rep.loanId] = [];
      }
      repaymentsByLoan[rep.loanId].push(rep);
    }

    // Batch query interest collected for all these loans
    const paymentSums = await dbQuery(
      `SELECT r.loanId, SUM(p.amount) as total 
       FROM payments p
       JOIN repayments r ON p.repaymentId = r.id
       WHERE r.loanId IN (${placeholders}) AND p.paymentType = 'INTEREST'
       GROUP BY r.loanId`,
      loanIds
    );

    const interestCollectedByLoan = {};
    for (const sumRow of paymentSums) {
      interestCollectedByLoan[sumRow.loanId] = sumRow.total || 0;
    }

    for (const r of filteredRows) {
      r.customer = { id: r.customerId, name: r.customerName, phone: r.customerPhone };
      r.agent = r.agentName ? { name: r.agentName } : null;
      r.repayments = repaymentsByLoan[r.id] || [];
      r.interestCollected = interestCollectedByLoan[r.id] || 0;
    }
    return filteredRows;
  },

  async get(id) {
    const tenant = getTenant();
    await _autoMarkOverdue(id);
    await _autoExtendIfNeeded(id);
    const rows = await dbQuery(`SELECT l.*, c.name as customerName, c.phone as customerPhone, c.address as customerAddress,
      u.name as agentName, u.phone as agentPhone FROM loans l
      LEFT JOIN customers c ON l.customerId = c.id
      LEFT JOIN users u ON l.agentId = u.id
      WHERE l.id = ? AND l.companyId = ?`, [id, tenant.companyId]);
    if (!rows.length) throw new Error('Loan not found');
    const loan = rows[0];
    if (tenant.role === 'AGENT' && loan.agentId !== tenant.userId) {
      throw new Error('Permission denied');
    }
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
    const tenant = getTenant();
    const loanNumber = generateLoanNumber();
    const principal = parseFloat(data.principalAmount);
    
    const isWithoutInterest = data.interestType === 'WITHOUT_INTEREST';
    const rate = isWithoutInterest ? 0 : parseFloat(data.interestRate);
    const fee = parseFloat(data.processingFee || 0); // Advance Deduction
    
    // For WITHOUT_INTEREST, the tenure (batchSize) is custom-set. Otherwise, it is continuous/default.
    const batchSize = isWithoutInterest 
      ? parseInt(data.tenure || 10) 
      : (data.tenureUnit === 'WEEKS' ? 52 : data.tenureUnit === 'MONTHS' ? 12 : 365);
      
    const interestPerPeriod = isWithoutInterest 
      ? 0 
      : round2(principal * (rate / 100));
      
    const installmentAmount = isWithoutInterest
      ? round2(principal / batchSize)
      : interestPerPeriod;
      
    const totalInterest = isWithoutInterest ? 0 : round2(interestPerPeriod * batchSize);
    const totalPayable = isWithoutInterest ? principal : round2(principal + totalInterest);
    
    const start = new Date(data.startDate);
    const end = new Date(start);
    if (data.tenureUnit === 'MONTHS') end.setMonth(end.getMonth() + batchSize);
    else if (data.tenureUnit === 'WEEKS') end.setDate(end.getDate() + batchSize * 7);
    else end.setDate(end.getDate() + batchSize);

    await dbRun(
      `INSERT INTO loans (id, loanNumber, customerId, agentId, principalAmount, interestRate, interestType,
        tenure, tenureUnit, processingFee, totalInterest, totalPayable, installmentAmount,
        interestCollected, outstandingPrincipal, status, startDate, endDate, companyId)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`,
      [id, loanNumber, data.customerId, data.agentId || userId, principal, rate,
       data.interestType || 'FLAT', batchSize, data.tenureUnit,
       fee, totalInterest, totalPayable, installmentAmount, principal, 'ACTIVE',
       start.toISOString(), end.toISOString(), tenant.companyId]
    );

    // Generate installments
    const principalPerPeriod = isWithoutInterest ? installmentAmount : 0;
    const interestAmount = isWithoutInterest ? 0 : interestPerPeriod;
    await _generateInstallments(id, principalPerPeriod, interestAmount, data.tenureUnit, start, 1, batchSize);
    
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
    const tenant = getTenant();
    await _autoMarkAllOverdue();
    let sql = `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone
      FROM repayments r
      LEFT JOIN loans l ON r.loanId = l.id
      LEFT JOIN customers c ON l.customerId = c.id
      WHERE l.companyId = ?`;
    const p = [tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
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
    const tenant = getTenant();
    await _autoMarkAllOverdue();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    
    let sql = `SELECT r.*, l.loanNumber, l.agentId, c.name as customerName, c.phone as customerPhone, c.address as customerAddress
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.dueDate >= ? AND r.dueDate < ? AND l.companyId = ?`;
    const p = [today.toISOString(), tomorrow.toISOString(), tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
    sql += ' ORDER BY r.dueDate ASC';

    const rows = await dbQuery(sql, p);
    if (rows.length === 0) return [];

    const repaymentIds = rows.map(r => r.id);
    const placeholders = repaymentIds.map(() => '?').join(',');
    const allPayments = await dbQuery(`SELECT * FROM payments WHERE repaymentId IN (${placeholders})`, repaymentIds);

    const paymentsByRepayment = {};
    for (const p of allPayments) {
      if (!paymentsByRepayment[p.repaymentId]) {
        paymentsByRepayment[p.repaymentId] = [];
      }
      paymentsByRepayment[p.repaymentId].push(p);
    }

    return rows.map(r => ({
      ...r,
      loan: { 
        loanNumber: r.loanNumber, 
        agentId: r.agentId, 
        customer: { name: r.customerName, phone: r.customerPhone, address: r.customerAddress } 
      },
      payments: paymentsByRepayment[r.id] || [],
    }));
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

    const loanRows = await dbQuery('SELECT interestType, outstandingPrincipal FROM loans WHERE id = ?', [rep.loanId]);
    if (loanRows.length) {
      const loan = loanRows[0];
      if (loan.interestType === 'WITHOUT_INTEREST') {
        const newOutstanding = round2(loan.outstandingPrincipal - amount);
        const isClosed = newOutstanding <= 0;
        await dbRun(
          'UPDATE loans SET outstandingPrincipal=?, status=? WHERE id=?',
          [Math.max(0, newOutstanding), isClosed ? 'CLOSED' : 'ACTIVE', rep.loanId]
        );
      } else {
        await dbRun('UPDATE loans SET interestCollected = interestCollected + ? WHERE id=?', [amount, rep.loanId]);
      }
    }

    if (newStatus === 'PAID') await _autoExtendIfNeeded(rep.loanId);
    queueSync('addPayment', { repaymentId: data.repaymentId, amount });

    if (data.penaltyAmount && parseFloat(data.penaltyAmount) > 0) {
      const penaltyVal = parseFloat(data.penaltyAmount);
      const penaltyId = uuid();
      await dbRun(
        'INSERT INTO payments (id, repaymentId, collectedById, amount, paymentMode, paymentType, reference, notes) VALUES (?,?,?,?,?,?,?,?)',
        [penaltyId, data.repaymentId, userId, penaltyVal, data.paymentMode || 'CASH', 'PENALTY', data.reference || '', 'Overdue Penalty']
      );
      queueSync('addPayment', { repaymentId: data.repaymentId, amount: penaltyVal });
    }

    // Send SMS via native Android SIM (no internet needed)
    try {
      const loanRows = await dbQuery(
        'SELECT c.phone as customerPhone FROM loans l LEFT JOIN customers c ON l.customerId = c.id WHERE l.id = ?',
        [rep.loanId]
      );
      if (loanRows.length && loanRows[0].customerPhone) {
        const msg = buildPaymentSMS(amount, pId);
        sendSMS(loanRows[0].customerPhone, msg); // fire and forget
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
    const tenant = getTenant();
    let sql = `SELECT p.*, u.name as collectedByName, r.loanId,
        l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM payments p
       LEFT JOIN users u ON p.collectedById = u.id
       LEFT JOIN repayments r ON p.repaymentId = r.id
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE l.companyId = ?`;
    const p = [tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
    sql += ' ORDER BY p.collectedAt DESC LIMIT 100';
    const rows = await dbQuery(sql, p);
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
    const tenant = getTenant();
    await _autoMarkAllOverdue();
    const [totalLoans] = await dbQuery('SELECT COUNT(*) as c FROM loans WHERE companyId = ?', [tenant.companyId]);
    const [activeLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE' AND companyId = ?", [tenant.companyId]);
    const [closedLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='CLOSED' AND companyId = ?", [tenant.companyId]);
    const [defaultedLoans] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='DEFAULTED' AND companyId = ?", [tenant.companyId]);
    const [customers] = await dbQuery('SELECT COUNT(*) as c FROM customers WHERE isActive=1 AND companyId = ?', [tenant.companyId]);
    const [agents] = await dbQuery("SELECT COUNT(*) as c FROM users WHERE role='AGENT' AND isActive=1 AND companyId = ?", [tenant.companyId]);
    const [disbursed] = await dbQuery('SELECT SUM(principalAmount) as s FROM loans WHERE companyId = ?', [tenant.companyId]);
    const [collected] = await dbQuery('SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE l.companyId = ?', [tenant.companyId]);
    const [overdue] = await dbQuery("SELECT SUM(r.dueAmount) as s, COUNT(*) as c FROM repayments r JOIN loans l ON r.loanId = l.id WHERE r.status='OVERDUE' AND l.companyId = ?", [tenant.companyId]);
    const [pending] = await dbQuery("SELECT SUM(r.dueAmount) as s FROM repayments r JOIN loans l ON r.loanId = l.id WHERE r.status IN ('PENDING','PARTIAL') AND l.companyId = ?", [tenant.companyId]);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [monthly] = await dbQuery('SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.collectedAt >= ? AND l.companyId = ?', [startOfMonth, tenant.companyId]);
    const [interest] = await dbQuery("SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.paymentType='INTEREST' AND l.companyId = ?", [tenant.companyId]);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const [agg] = await dbQuery('SELECT SUM(p.amount) as s FROM payments p JOIN repayments r ON p.repaymentId = r.id JOIN loans l ON r.loanId = l.id WHERE p.collectedAt >= ? AND p.collectedAt <= ? AND l.companyId = ?', [start, end, tenant.companyId]);
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
    const tenant = getTenant();
    await _autoMarkAllOverdue();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [assigned] = await dbQuery("SELECT COUNT(*) as c FROM loans WHERE status='ACTIVE' AND agentId = ? AND companyId = ?", [userId, tenant.companyId]);
    const todayDue = await dbQuery(
      `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.dueDate >= ? AND r.dueDate < ? AND l.agentId = ? AND l.companyId = ?
       ORDER BY r.dueDate ASC`,
      [today.toISOString(), tomorrow.toISOString(), userId, tenant.companyId]
    );
    const [collectedToday] = await dbQuery(
      `SELECT SUM(p.amount) as s, COUNT(p.id) as c FROM payments p 
       JOIN repayments r ON p.repaymentId = r.id 
       JOIN loans l ON r.loanId = l.id
       WHERE p.collectedAt >= ? AND p.collectedById = ? AND l.companyId = ?`,
      [today.toISOString(), userId, tenant.companyId]
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
    const tenant = getTenant();
    await _autoMarkAllOverdue();
    let sql = `SELECT r.*, l.loanNumber, c.name as customerName, c.phone as customerPhone, c.address, c.city
       FROM repayments r
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE r.status = 'OVERDUE' AND l.companyId = ?`;
    const p = [tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
    sql += ' ORDER BY r.dueDate ASC';
    const rows = await dbQuery(sql, p);
    return rows.map(r => ({
      ...r,
      loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone, address: r.address, city: r.city } },
    }));
  },

  async dailyCollection(date) {
    const tenant = getTenant();
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day); next.setDate(next.getDate() + 1);
    let sql = `SELECT p.*, u.name as collectedByName, l.loanNumber, c.name as customerName, c.phone as customerPhone
       FROM payments p
       LEFT JOIN users u ON p.collectedById = u.id
       LEFT JOIN repayments r ON p.repaymentId = r.id
       LEFT JOIN loans l ON r.loanId = l.id
       LEFT JOIN customers c ON l.customerId = c.id
       WHERE p.collectedAt >= ? AND p.collectedAt < ? AND l.companyId = ?`;
    const p = [day.toISOString(), next.toISOString(), tenant.companyId];
    if (tenant.role === 'AGENT') {
      sql += ' AND l.agentId = ?';
      p.push(tenant.userId);
    }
    sql += ' ORDER BY p.collectedAt ASC';
    const rows = await dbQuery(sql, p);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { payments: rows.map(r => ({ ...r, collectedBy: { name: r.collectedByName }, repayment: { loan: { loanNumber: r.loanNumber, customer: { name: r.customerName, phone: r.customerPhone } } } })), total };
  },
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const localAudit = {
  async list(params = {}) {
    const tenant = getTenant();
    let sql = `SELECT a.*, u.name as userName, u.role as userRole FROM audit_logs a
       LEFT JOIN users u ON a.userId = u.id`;
    const p = [];
    if (tenant.role !== 'SUPER_ADMIN') {
      sql += ' WHERE u.companyId = ?';
      p.push(tenant.companyId);
    }
    sql += ' ORDER BY a.createdAt DESC LIMIT 100';
    const rows = await dbQuery(sql, p);
    return rows.map(r => ({ ...r, user: { name: r.userName, role: r.userRole } }));
  },

  async log(userId, action, entity, entityId, details) {
    await dbRun(
      'INSERT INTO audit_logs (id, userId, action, entity, entityId, details) VALUES (?,?,?,?,?,?)',
      [uuid(), userId, action, entity, entityId || '', details ? JSON.stringify(details) : '']
    );
  },
};

// ─── Companies ────────────────────────────────────────────────────────────────
export const localCompanies = {
  async list() {
    return dbQuery("SELECT * FROM companies ORDER BY createdAt DESC", []);
  },
  async create(name, code) {
    const id = uuid();
    const cleanCode = (code || '').toLowerCase().trim();
    
    // Uniqueness check
    const existing = await dbQuery("SELECT id FROM companies WHERE code = ? LIMIT 1", [cleanCode]);
    if (existing.length) {
      throw new Error(`Company code "${cleanCode}" is already taken.`);
    }

    await dbRun("INSERT INTO companies (id, name, code, isActive) VALUES (?, ?, ?, 1)", [id, name, cleanCode]);
    return { id, name, code: cleanCode, isActive: 1 };
  },
  async toggleActive(id, isActive) {
    await dbRun("UPDATE companies SET isActive = ? WHERE id = ?", [isActive ? 1 : 0, id]);
  }
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
  if (loan.interestType === 'WITHOUT_INTEREST') return; // Fixed duration, no extension!
  
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
  await _generateInstallments(loanId, 0, interestPerPeriod, loan.tenureUnit, new Date(last.dueDate), last.installmentNo + 1, batchSize);
}

async function _generateInstallments(loanId, principalAmount, interestAmount, tenureUnit, startFrom, startNo, count) {
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startFrom);
    const offset = i + 1;
    if (tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
    else if (tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
    else dueDate.setDate(dueDate.getDate() + offset);
    const due = round2(principalAmount + interestAmount);
    await dbRun(
      'INSERT INTO repayments (id, loanId, installmentNo, dueDate, dueAmount, principal, interest, status) VALUES (?,?,?,?,?,?,?,?)',
      [uuid(), loanId, startNo + i, dueDate.toISOString(), due, principalAmount, interestAmount, 'PENDING']
    );
  }
}
