const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.accessToken = localStorage.getItem('bupo_access_token');
    this.refreshToken = localStorage.getItem('bupo_refresh_token');
  }

  get isAuthenticated() {
    return !!this.accessToken;
  }

  async register(email, username, password) {
    const res = await this.request('POST', '/auth/register', { email, username, password });
    this.setTokens(res.access_token, res.refresh_token);
    return res.user;
  }

  async login(email, password) {
    const res = await this.request('POST', '/auth/login', { email, password });
    this.setTokens(res.access_token, res.refresh_token);
    return res.user;
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('bupo_access_token');
    localStorage.removeItem('bupo_refresh_token');
  }

  async getMyChecklists() {
    return (await this.request('GET', '/checklists')).checklists;
  }

  async getChecklist(id) {
    return (await this.request('GET', `/checklists/${id}`)).checklist;
  }

  async getGames() {
    return (await this.request('GET', '/games')).games;
  }

  async getGameChecklists(slug) {
    return this.request('GET', `/games/${slug}/checklists`);
  }

  async forkChecklist(id) {
    return (await this.request('POST', `/checklists/${id}/fork`)).checklist;
  }

  async getProgress(since = null) {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request('GET', `/progress/sync${params}`);
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('bupo_access_token', access);
    localStorage.setItem('bupo_refresh_token', refresh);
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    let res = await fetch(`${API_URL}${path}`, options);

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        options.headers = headers;
        res = await fetch(`${API_URL}${path}`, options);
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async tryRefresh() {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!res.ok) { this.logout(); return false; }
      const data = await res.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }
}

export const api = new ApiService();
export default api;
