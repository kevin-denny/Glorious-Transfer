const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    console.log('Attempting login for email:', email);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ token: string; user: any }>(response);
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  // Drivers
  async getDrivers() {
    const response = await fetch(`${API_BASE}/drivers`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  async createDriver(data: any) {
    const response = await fetch(`${API_BASE}/drivers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async updateDriver(id: string, data: any) {
    const response = await fetch(`${API_BASE}/drivers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async getDriverDetails(id: string) {
    const response = await fetch(`${API_BASE}/drivers/${id}/details`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  // Tours
  async getTours() {
    const response = await fetch(`${API_BASE}/tours`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  async createTour(data: any) {
    const response = await fetch(`${API_BASE}/tours`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async updateTour(id: string, data: any) {
    const response = await fetch(`${API_BASE}/tours/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async assignDriver(tourId: string, driverId: string) {
    const response = await fetch(`${API_BASE}/tours/${tourId}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ driver_id: driverId }),
    });
    return handleResponse<any>(response);
  },

  // Payments
  async getPayments() {
    const response = await fetch(`${API_BASE}/payments`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  async createPayment(data: any) {
    const response = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async markPaymentAsPaid(id: string) {
    const response = await fetch(`${API_BASE}/payments/${id}/mark-paid`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  // Activity Logs
  async getActivityLogs() {
    const response = await fetch(`${API_BASE}/logs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(response);
  },

  // Stats
  async getStats() {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },
};
