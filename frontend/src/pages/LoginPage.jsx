import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Landmark, Phone, Lock, Eye, EyeOff, AlertTriangle, ArrowRight } from 'lucide-react';

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
    setLoading(true);

    try {
      await login(userId.trim(), password.trim());
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in" style={{ width: '100%', maxWidth: '420px', boxSizing: 'border-box' }}>
        
        {/* Logo Section */}
        <div className="login-logo">
          <div className="login-logo-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={26} color="#ffffff" />
          </div>
          <h2>Finova</h2>
          <p>Daily & Weekly Finance Management</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="login-error animate-in" style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', marginBottom: '16px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ wordBreak: 'break-word', fontSize: '13px', lineHeight: '1.4' }}>{error}</div>
          </div>
        )}

        {/* Login Type Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setLoginMode('admin')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px',
              background: loginMode === 'admin' ? 'var(--bg-glass)' : 'transparent',
              color: loginMode === 'admin' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: loginMode === 'admin' ? 700 : 600,
              boxShadow: loginMode === 'admin' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Admin Login
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('agent')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px',
              background: loginMode === 'agent' ? 'var(--bg-glass)' : 'transparent',
              color: loginMode === 'agent' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: loginMode === 'agent' ? 700 : 600,
              boxShadow: loginMode === 'agent' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Field Agent Login
          </button>
        </div>

        {/* Unified Login Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          
          {/* Mobile / User ID */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              {loginMode === 'agent' ? 'Field Agent Mobile Number' : 'Admin Email or Mobile'}
            </label>
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
                type="text"
                placeholder="e.g. 9876543210"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Password or Agent ID */}
          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              {loginMode === 'agent' ? 'Agent ID' : 'Password'}
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
