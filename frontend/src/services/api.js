import axios from 'axios';

// Hardcoding the production URL directly to avoid any environment variable issues
const API_URL = 'https://finance-app-awae.onrender.com/api';

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

// Response interceptor to handle 401s silently using the refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't retried yet, and it's not the refresh or login endpoint itself
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh') && !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
          // Send request directly via axios to avoid interceptor loop
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          
          if (res.data?.success && res.data?.data?.accessToken) {
            localStorage.setItem('token', res.data.data.accessToken);
            if (res.data.data.refreshToken) {
              localStorage.setItem('refreshToken', res.data.data.refreshToken);
            }
            
            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          // If refresh fails, tokens are fully dead. 
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          // In a real app we might force reload, but Context will pick it up or require manual login next time
          window.location.reload(); 
        }
      }
    }
    // Map backend error message directly to error.message so toasts show actual API errors
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    
    return Promise.reject(error);
  }
);

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
    const refreshToken = localStorage.getItem('refreshToken');
    const promise = refreshToken ? api.post('/auth/logout', { refreshToken }) : Promise.resolve();
    
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    return promise;
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
  collect: (data) => api.post('/payments', data).then(extractData),
  collectPrincipal: (data) => api.post('/payments/principal', data).then(extractData),
  list: (params) => api.get('/payments', { params }).then(extractData),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary').then(extractData),
  agent: (id) => api.get('/dashboard/agent', { params: { agentId: id } }).then(extractData),
  resetAllData: () => api.post('/dashboard/reset-all-data').then(extractData),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsAPI = {
  defaulters: () => api.get('/reports/defaulters').then(extractData),
  dailyCollection: (params) => api.get('/reports/daily-collection', { params }).then(extractData),
  customer: (id) => api.get(`/customers/${id}`).then(extractData),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit', { params }).then(res => res.data.data),
};

export const notificationsAPI = {
  getDashboard: () => api.get('/notifications/dashboard').then(res => res.data.data),
  getSettings: () => api.get('/notifications/settings').then(res => res.data.data),
  updateSettings: (data) => api.put('/notifications/settings', data).then(res => res.data.data),
  getHistory: (limit) => api.get('/notifications/history', { params: { limit } }).then(res => res.data.data),
  triggerCron: () => api.post('/notifications/trigger').then(res => res.data),
  getInApp: () => api.get('/notifications/in-app').then(res => res.data.data),
  markRead: (id) => api.put(`/notifications/${id}/read`).then(res => res.data)
};

export default api;
export const updateApiBaseUrl = (url) => {
  api.defaults.baseURL = url;
};
