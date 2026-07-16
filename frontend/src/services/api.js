/**
 * api.js — All calls now go to local SQLite on the device.
 * No network, no backend server needed. Works 100% offline.
 */
import {
  localAuth, localUsers, localCustomers, localLoans,
  localRepayments, localPayments, localDashboard, localReports, localAudit, localCompanies
} from './localDb';
import { getDb, dbQuery } from './db';

function getUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user'));
    if (u && u.id) return u;
  } catch (_) {}
  return null;
}

// Safe userId — waits for DB ready, then reads from localStorage or DB directly
async function getUserId() {
  await getDb(); // ensure DB is initialized and admin is seeded
  // Try localStorage first (fastest)
  const u = getUser();
  if (u && u.id) return u.id;
  // Fallback: query DB directly
  const rows = await dbQuery("SELECT id FROM users WHERE role='ADMIN' AND isActive=1 LIMIT 1", []);
  if (rows.length) {
    localStorage.setItem('user', JSON.stringify(rows[0]));
    return rows[0].id;
  }
  throw new Error('No admin user found. Please reinstall the app.');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => localAuth.login(data.email, data.password),
  logout: () => localAuth.logout(),
  me: () => localAuth.me(),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => localUsers.list(params),
  create: (data) => localUsers.create(data),
  update: (id, data) => localUsers.update(id, data),
  changePassword: (id, data) => localUsers.changePassword(id, data.password),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersAPI = {
  list: (params) => localCustomers.list(params),
  get: (id) => localCustomers.get(id),
  create: (data) => localCustomers.create(data),
  update: (id, data) => localCustomers.update(id, data),
  delete: (id) => localCustomers.delete(id),
};

// ─── Loans ────────────────────────────────────────────────────────────────────
export const loansAPI = {
  list: (params) => localLoans.list(params),
  get: (id) => localLoans.get(id),
  create: async (data) => localLoans.create(data, await getUserId()),
  updateStatus: (id, data) => localLoans.updateStatus(id, data.status),
  delete: (id) => localLoans.delete(id),
  downloadReport: () => Promise.resolve({ data: 'Report not available offline' }),
};

// ─── Repayments ───────────────────────────────────────────────────────────────
export const repaymentsAPI = {
  list: (params) => localRepayments.list(params),
  today: () => localRepayments.today(),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsAPI = {
  collect: async (data) => localPayments.collect(data, await getUserId()),
  collectPrincipal: async (data) => localPayments.collectPrincipal(data, await getUserId()),
  list: (params) => localPayments.list(params),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  summary: () => localDashboard.summary(),
  agent: () => localDashboard.agent(getUser()?.id),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsAPI = {
  defaulters: () => localReports.defaulters(),
  dailyCollection: (params) => localReports.dailyCollection(params?.date),
  customer: (id) => localCustomers.get(id),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => localAudit.list(params),
};

// ─── Companies ────────────────────────────────────────────────────────────────
export const companiesAPI = {
  list: () => localCompanies.list(),
  create: (data) => localCompanies.create(data.name, data.code),
  toggleActive: (id, isActive) => localCompanies.toggleActive(id, isActive),
};

export default {};

export const updateApiBaseUrl = () => {}; // no-op in offline mode
