import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Landmark, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ userId: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const users = JSON.parse(localStorage.getItem('db_users') || '[]');
      console.log('Available Login Accounts (Phone/Email & Password):', users.map(u => ({ name: u.name, phone: u.phone, email: u.email, password: u.passwordHash, role: u.role, isActive: u.isActive })));
    } catch (e) {
      console.error('Error reading users from storage:', e);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.userId, form.password);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in">
        <div className="login-logo">
          <div className="login-logo-icon"><Landmark size={28} /></div>
          <h2>LoanFlow Pro</h2>
          <p>Sign in to continue</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Phone Number / Email</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                type="text"
                placeholder="Enter Phone Number or Email"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                style={{ paddingLeft: 42 }}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ paddingLeft: 42, paddingRight: 42 }}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
