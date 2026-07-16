import { createContext, useContext, useState, useEffect } from 'react';
import { getDb, dbQuery } from '../services/db';
import { localAuth } from '../services/localDb';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDb().then(async () => {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            const rows = await dbQuery(
              "SELECT id, name, email, phone, role, companyId FROM users WHERE id = ? AND isActive = 1 LIMIT 1",
              [parsed.id]
            );
            if (rows.length) {
              setUser(rows[0]);
              return;
            }
          }
        } catch (e) {}
      }

      // Default fallback: auto-login the first active company Admin
      const rows = await dbQuery(
        "SELECT id, name, email, phone, role, companyId FROM users WHERE role='ADMIN' AND isActive=1 LIMIT 1",
        []
      );
      if (rows.length) {
        setUser(rows[0]);
        try { localStorage.setItem('user', JSON.stringify(rows[0])); } catch (e) {}
      } else {
        setUser(null);
        try { localStorage.removeItem('user'); } catch (e) {}
      }
    }).finally(() => setLoading(false));
  }, []);

  const login = async (companyCode, emailOrPhone, password) => {
    const u = await localAuth.login(companyCode, emailOrPhone, password);
    setUser(u);
    return u;
  };

  const logout = () => {
    try { localStorage.removeItem('user'); } catch (e) {}
    localAuth.logout();
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
