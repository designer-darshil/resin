// API client — centralized fetch wrapper
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '/api';

function getToken() {
  return localStorage.getItem('resin_token');
}

async function request(method, path, body, signal) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: (path, signal) => request('GET', path, null, signal),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

// Auth
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

// Customers
export const customersApi = {
  list: (params = {}) => api.get('/customers?' + new URLSearchParams(params)),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// Purchases
export const purchasesApi = {
  list: (params = {}) => api.get('/purchases?' + new URLSearchParams(params)),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  receive: (id, data) => api.post(`/purchases/${id}/receive`, data),
  delete: (id) => api.delete(`/purchases/${id}`),
};

// Stock
export const stockApi = {
  list: (params = {}) => api.get('/stock?' + new URLSearchParams(params)),
  movements: (params = {}) => api.get('/stock/movements?' + new URLSearchParams(params)),
  adjust: (data) => api.post('/stock/adjust', data),
};

// Coating Jobs
export const jobsApi = {
  list: (params = {}) => api.get('/coating-jobs?' + new URLSearchParams(params)),
  get: (id) => api.get(`/coating-jobs/${id}`),
  create: (data) => api.post('/coating-jobs', data),
  update: (id, data) => api.put(`/coating-jobs/${id}`, data),
  assign: (id, data) => api.post(`/coating-jobs/${id}/assign`, data),
  complete: (id, data) => api.post(`/coating-jobs/${id}/complete`, data),
  delete: (id) => api.delete(`/coating-jobs/${id}`),
};

// Employees
export const employeesApi = {
  list: (params = {}) => api.get('/employees?' + new URLSearchParams(params)),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
};

// Overtime
export const overtimeApi = {
  list: (params = {}) => api.get('/overtime?' + new URLSearchParams(params)),
  create: (data) => api.post('/overtime', data),
  update: (id, data) => api.put(`/overtime/${id}`, data),
  approve: (id, data) => api.post(`/overtime/${id}/approve`, data),
};

// Salary
export const salaryApi = {
  list: (params = {}) => api.get('/salary?' + new URLSearchParams(params)),
  create: (data) => api.post('/salary', data),
  update: (id, data) => api.put(`/salary/${id}`, data),
};

// Advances
export const advancesApi = {
  list: (params = {}) => api.get('/advances?' + new URLSearchParams(params)),
  create: (data) => api.post('/advances', data),
  update: (id, data) => api.put(`/advances/${id}`, data),
};

// Dispatch
export const dispatchApi = {
  list: (params = {}) => api.get('/dispatch?' + new URLSearchParams(params)),
  get: (id) => api.get(`/dispatch/${id}`),
  create: (data) => api.post('/dispatch', data),
  update: (id, data) => api.put(`/dispatch/${id}`, data),
};

// Payments
export const paymentsApi = {
  list: (params = {}) => api.get('/payments?' + new URLSearchParams(params)),
  create: (data) => api.post('/payments', data),
};

// WhatsApp
export const whatsappApi = {
  templates: () => api.get('/whatsapp/templates'),
  createTemplate: (data) => api.post('/whatsapp/templates', data),
  updateTemplate: (id, data) => api.put(`/whatsapp/templates/${id}`, data),
  log: (data) => api.post('/whatsapp/log', data),
  logs: (params = {}) => api.get('/whatsapp/logs?' + new URLSearchParams(params)),
};

// Reports
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  production: (params = {}) => api.get('/reports/production?' + new URLSearchParams(params)),
  stock: () => api.get('/reports/stock'),
  employee: (params = {}) => api.get('/reports/employee?' + new URLSearchParams(params)),
  financial: (params = {}) => api.get('/reports/financial?' + new URLSearchParams(params)),
};

// Admin
export const adminApi = {
  users: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  roles: () => api.get('/admin/roles'),
  updatePermission: (role_id, module, data) => api.put(`/admin/permissions/${role_id}/${module}`, data),
  settings: () => api.get('/admin/settings'),
  saveSettings: (updates) => api.put('/admin/settings', { updates }),
  auditLogs: (params = {}) => api.get('/admin/audit-logs?' + new URLSearchParams(params)),
};
