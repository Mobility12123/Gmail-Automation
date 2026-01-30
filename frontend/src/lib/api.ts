import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const authAPI = {
  register: (data: { email: string; password: string; name?: string }) =>
    apiClient.post('/api/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    apiClient.post('/api/auth/login', data),
  
  verify: () => apiClient.get('/api/auth/verify'),
  
  getGmailAuthUrl: () => apiClient.get('/api/auth/gmail/url'),
};

export const emailAccountsAPI = {
  getAll: () => apiClient.get('/api/email-accounts'),
  
  getOne: (id: string) => apiClient.get(`/api/email-accounts/${id}`),
  
  create: (data: {
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }) => apiClient.post('/api/email-accounts', data),
  
  update: (id: string, data: { isActive?: boolean }) =>
    apiClient.patch(`/api/email-accounts/${id}`, data),
  
  delete: (id: string) => apiClient.delete(`/api/email-accounts/${id}`),
  
  test: (id: string) => apiClient.post(`/api/email-accounts/${id}/test`),
};

export const rulesAPI = {
  getAll: (emailAccountId?: string) =>
    apiClient.get('/api/rules', { params: { emailAccountId } }),
  
  getOne: (id: string) => apiClient.get(`/api/rules/${id}`),
  
  create: (data: any) => apiClient.post('/api/rules', data),
  
  update: (id: string, data: any) => apiClient.patch(`/api/rules/${id}`, data),
  
  delete: (id: string) => apiClient.delete(`/api/rules/${id}`),
  
  test: (id: string, sampleEmail: any) =>
    apiClient.post(`/api/rules/${id}/test`, { sampleEmail }),
  
  getStats: (id: string) => apiClient.get(`/api/rules/${id}/stats`),
};

export const activityAPI = {
  getAll: (params?: {
    emailAccountId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) => apiClient.get('/api/activity', { params }),
  
  getRecent: () => apiClient.get('/api/activity/recent'),
  
  getEmails: (params?: {
    emailAccountId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => apiClient.get('/api/activity/emails', { params }),
  
  getEmail: (id: string) => apiClient.get(`/api/activity/emails/${id}`),
};

export const statsAPI = {
  getDashboard: () => apiClient.get('/api/stats/dashboard'),
  
  getEmailAccount: (id: string) => apiClient.get(`/api/stats/email-accounts/${id}`),
};
