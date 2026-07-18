import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.me()
        .then(data => {
          setUser(data.user || data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (emailOrPhone, password) => {
    // Note: old localDb login expected 3 args (companyCode, emailOrPhone, password).
    // Express API expects { email: emailOrPhone, password }
    const response = await authAPI.login({ email: emailOrPhone, password });
    if (response.accessToken) {
      localStorage.setItem('token', response.accessToken);
    }
    if (response.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    }
    return response.user;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isAgent = user?.role === 'AGENT';
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin, isAdmin, isAgent, isCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
