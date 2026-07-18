import axios from 'axios';

// Using localtunnel for temporary testing
const API_URL = 'https://salty-moments-visit.loca.lt/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor to add JWT token and tunnel bypass header
api.interceptors.request.use((config) => {
  config.headers['Bypass-Tunnel-Reminder'] = 'true'; // Bypass localtunnel splash screen
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Generic response data extractor
const extractData = (res) => {
  if (res.data && res.data.success && res.data.data !== undefined) {
    return res.data.data;
  }
  return res.data;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data).then(extractData),
  me: () => api.get('/auth/me').then(extractData),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users', { params }).then(extractData),
  create: (data) => api.post('/users', data).then(extractData),
  update: (id, data) => api.patch(`/users/${id}`, data).then(extractData),
  changePassword: (id, data) => api.patch(`/users/${id}/password`, data).then(extractData),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersAPI = {
  list: (params) => api.get('/customers', { params }).then(extractData),
  get: (id) => api.get(`/customers/${id}`).then(extractData),
  create: (data) => api.post('/customers', data).then(extractData),
  update: (id, data) => api.put(`/customers/${id}`, data).then(extractData),
  delete: (id) => api.delete(`/customers/${id}`).then(extractData),
};

// ─── Loans ────────────────────────────────────────────────────────────────────
export const loansAPI = {
  list: (params) => api.get('/loans', { params }).then(extractData),
  get: (id) => api.get(`/loans/${id}`).then(extractData),
  create: (data) => api.post('/loans', data).then(extractData),
  updateStatus: (id, data) => api.patch(`/loans/${id}/status`, data).then(extractData),
  delete: (id) => api.delete(`/loans/${id}`).then(extractData),
  downloadReport: () => Promise.resolve({ data: 'Report available via backend only' }),
};

// ─── Repayments ───────────────────────────────────────────────────────────────
export const repaymentsAPI = {
  list: (params) => api.get('/repayments', { params }).then(extractData),
  today: () => api.get('/repayments/today').then(extractData),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsAPI = {
  collect: (data) => api.post('/payments/collect', data).then(extractData),
  collectPrincipal: (data) => api.post('/payments/collect-principal', data).then(extractData),
  list: (params) => api.get('/payments', { params }).then(extractData),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary').then(extractData),
  agent: (id) => api.get(`/dashboard/agent/${id || ''}`).then(extractData),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsAPI = {
  defaulters: () => api.get('/reports/defaulters').then(extractData),
  dailyCollection: (params) => api.get('/reports/daily-collection', { params }).then(extractData),
  customer: (id) => api.get(`/customers/${id}`).then(extractData),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit', { params }).then(extractData),
};

export default api;
export const updateApiBaseUrl = (url) => {
  api.defaults.baseURL = url;
};
