import { create } from 'zustand';
import api from '../services/api';

const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem('bupo_user') || 'null'),
  isAuthenticated: api.isAuthenticated,
  error: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await api.login(email, password);
      localStorage.setItem('bupo_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  register: async (email, username, password) => {
    set({ loading: true, error: null });
    try {
      const user = await api.register(email, username, password);
      localStorage.setItem('bupo_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: () => {
    api.logout();
    localStorage.removeItem('bupo_user');
    set({ user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));

export default useAuth;
