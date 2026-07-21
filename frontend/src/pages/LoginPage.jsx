import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Landmark, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ userId: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);



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
        <div className="login-logo" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo-icon.png" alt="Finova Logo" style={{ width: '72px', height: '72px', borderRadius: '16px', objectFit: 'contain', margin: '0 auto 12px auto', display: 'block' }} />
          <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Finova</h2>
          <p style={{ color: 'var(--accent-500)', fontSize: '13px', fontWeight: '600', margin: '4px 0 0 0', letterSpacing: '0.3px' }}>Smart Money. Better Future.</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Phone Number / Email</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input input-with-icon-left"
                type="text"
                placeholder="Enter Phone Number or Email"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
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
                className="form-input input-with-icon-both"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
