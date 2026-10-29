import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Phone, Lock, Eye, EyeOff, AlertTriangle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('admin'); // 'admin' | 'agent'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanInput = userId.trim();
    if (loginMode === 'agent') {
      if (cleanInput.replace(/\D/g, '').length !== 10) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
    }

    setLoading(true);

    try {
      await login(cleanInput, password.trim());
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUserIdChange = (e) => {
    const val = e.target.value;
    if (loginMode === 'agent') {
      setUserId(val.replace(/\D/g, '').slice(0, 10));
    } else {
      if (/^\d+$/.test(val)) {
        setUserId(val.slice(0, 10));
      } else {
        setUserId(val);
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in" style={{ width: '100%', maxWidth: '420px', boxSizing: 'border-box' }}>
        
        {/* Logo Section */}
        <div className="login-logo">
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '14px' }}>
            <img
              src="/logo-icon.png"
              alt="Finova Logo"
              style={{
                width: 68,
                height: 68,
                borderRadius: '18px',
                objectFit: 'cover',
                display: 'block',
                boxShadow: '0 10px 25px -4px rgba(37, 99, 235, 0.35), 0 4px 10px rgba(0, 0, 0, 0.08)',
                margin: '0 auto',
              }}
            />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>
            Finova
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Daily & Weekly Finance Management
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="login-error animate-in" style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', marginBottom: '16px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ wordBreak: 'break-word', fontSize: '13px', lineHeight: '1.4' }}>{error}</div>
          </div>
        )}

        {/* Login Type Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', background: 'var(--bg-secondary)', padding: '5px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setLoginMode('admin')}
            style={{
              flex: 1, padding: '9px 4px', border: 'none', borderRadius: '8px',
              background: loginMode === 'admin' ? 'var(--bg-card)' : 'transparent',
              color: loginMode === 'admin' ? 'var(--primary-600)' : 'var(--text-muted)',
              fontWeight: loginMode === 'admin' ? 700 : 600,
              fontSize: '13px',
              boxShadow: loginMode === 'admin' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Admin Portal
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('agent')}
            style={{
              flex: 1, padding: '9px 4px', border: 'none', borderRadius: '8px',
              background: loginMode === 'agent' ? 'var(--bg-card)' : 'transparent',
              color: loginMode === 'agent' ? 'var(--primary-600)' : 'var(--text-muted)',
              fontWeight: loginMode === 'agent' ? 700 : 600,
              fontSize: '13px',
              boxShadow: loginMode === 'agent' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Field Executive
          </button>
        </div>

        {/* Unified Login Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          
          {/* Mobile / User ID */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                {loginMode === 'agent' ? 'Field Executive Mobile Number' : 'Admin Email or Mobile'}
              </label>
              {loginMode === 'agent' && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: userId.length === 10 ? '#10b981' : '#f59e0b' }}>
                  {userId.length}/10 digits
                </span>
              )}
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
              <Phone
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />
              <input
                className="form-input input-with-icon-left"
                type={loginMode === 'agent' ? 'tel' : 'text'}
                inputMode={loginMode === 'agent' ? 'numeric' : 'text'}
                maxLength={loginMode === 'agent' ? 10 : 80}
                placeholder={loginMode === 'agent' ? '10-digit mobile number' : 'e.g. 9876543210 or admin@loanflow.com'}
                value={userId}
                onChange={handleUserIdChange}
                autoComplete="username"
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Password or Agent ID */}
          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              {loginMode === 'agent' ? 'Executive ID' : 'Password'}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />
              <input
                className={loginMode === 'agent' ? "form-input input-with-icon-left" : "form-input input-with-icon-both"}
                type={loginMode === 'agent' ? 'text' : (showPass ? 'text' : 'password')}
                placeholder={loginMode === 'agent' ? "e.g. AGT123" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {loginMode !== 'agent' && (
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 2
                  }}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
            style={{
              width: '100%',
              minHeight: '46px',
              fontSize: '15px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Signing in...' : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
