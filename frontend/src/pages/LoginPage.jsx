import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, UserCheck, Lock, Eye, EyeOff, Phone, ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [step, setStep] = useState(1); // 1 = Role Selection, 2 = Form
  const [selectedRole, setSelectedRole] = useState(null); // 'ADMIN' or 'AGENT'
  const [form, setForm] = useState({ userId: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep(2);
    setError('');
  };

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
      <div className="login-card animate-in" style={{ maxWidth: '420px', width: '100%', padding: '32px' }}>
        
        {step === 1 && (
          <div className="role-selection animate-in">
            <div className="login-logo" style={{ textAlign: 'center', marginBottom: '32px' }}>
              <img src="/logo-icon.png" alt="Finova Logo" style={{ width: '80px', height: '80px', borderRadius: '18px', objectFit: 'contain', margin: '0 auto 16px auto', display: 'block', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }} />
              <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Finova</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '6px 0 0 0' }}>Select your account type to continue</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                type="button"
                onClick={() => handleRoleSelect('ADMIN')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', 
                  borderRadius: '16px', border: '1px solid var(--border-subtle)', 
                  background: 'var(--card-bg)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                className="role-card-hover"
              >
                <div style={{ background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '14px', borderRadius: '12px' }}>
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>Super Admin</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Full access to dashboard & reports</div>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => handleRoleSelect('AGENT')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', 
                  borderRadius: '16px', border: '1px solid var(--border-subtle)', 
                  background: 'var(--card-bg)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                className="role-card-hover"
              >
                <div style={{ background: 'var(--success-50)', color: 'var(--success-600)', padding: '14px', borderRadius: '12px' }}>
                  <UserCheck size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>Field Agent</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Access collections & customer data</div>
                </div>
              </button>
            </div>
            <style>{`
              .role-card-hover:hover {
                border-color: var(--primary-300) !important;
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(59, 130, 246, 0.1) !important;
              }
            `}</style>
          </div>
        )}

        {step === 2 && (
          <div className="login-form animate-in">
            <button 
              type="button" 
              onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '24px', padding: 0, fontSize: '14px', fontWeight: 600 }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            <div className="login-logo" style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {selectedRole === 'ADMIN' ? 'Admin Login' : 'Agent Login'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '6px 0 0 0' }}>Enter your credentials to access your account.</p>
            </div>

            {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  {selectedRole === 'ADMIN' ? 'Email or Phone Number' : 'Agent ID or Phone'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input input-with-icon-left"
                    type="text"
                    placeholder={selectedRole === 'ADMIN' ? 'admin@example.com' : 'AGT-8767'}
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    autoComplete="username"
                    required
                    style={{ padding: '12px 14px 12px 40px', borderRadius: '12px', width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Password</label>
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
                    style={{ padding: '12px 40px 12px 40px', borderRadius: '12px', width: '100%' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary login-submit" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
