import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('resin_token');
    if (!token) { setLoading(false); return; }
    try {
      const data = await authApi.me();
      setUser(data);
    } catch {
      localStorage.removeItem('resin_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (username, password) => {
    const data = await authApi.login(username, password);
    localStorage.setItem('resin_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('resin_token');
    setUser(null);
  };

  const hasPermission = (module, action = 'can_view') => {
    if (!user) return false;
    if (user.role_name === 'admin') return true;
    const perm = user.permissions?.[module];
    return perm ? !!perm[action] : false;
  };

  const isAdmin = user?.role_name === 'admin';
  const isManager = user?.role_name === 'manager';
  const isEmployee = user?.role_name === 'employee';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isAdmin, isManager, isEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
