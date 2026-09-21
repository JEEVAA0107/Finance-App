import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Landmark, Shield, Lock, Eye, EyeOff, Phone, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  // Mode: 'FINANCE' (Finance Owner / Agent) vs 'SUPER_ADMIN' (Platform Owner)
  const [loginMode, setLoginMode] = useState('FINANCE');

  // Form states
  const [financeCode, setFinanceCode] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isInactiveError, setIsInactiveError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Restore remembered finance code
  useEffect(() => {
    const savedCode = localStorage.getItem('finova_last_finance_code');
    if (savedCode) {
      setFinanceCode(savedCode);
    }
  }, []);

  const handleModeChange = (mode) => {
    setLoginMode(mode);
    setError('');
    setIsInactiveError(false);
    setPassword('');
    if (mode === 'SUPER_ADMIN') {
      setPhone('6380372501');
    } else {
      setPhone('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsInactiveError(false);
    setLoading(true);

    try {
      if (loginMode === 'FINANCE') {
        if (!financeCode.trim()) {
          setError('Please enter your Finance Name or Unique Code.');
          setLoading(false);
          return;
        }
        await login(phone.trim(), password.trim(), financeCode.trim());
        // Remember finance code for next time
        localStorage.setItem('finova_last_finance_code', financeCode.trim());
      } else {
        // Super Admin Login
        await login(phone.trim(), password.trim());
      }
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Login failed. Please verify credentials.';
      setError(msg);
      if (err.response?.data?.code === 'COMPANY_INACTIVE' || msg.toLowerCase().includes('deactivated')) {
        setIsInactiveError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '20px' }}>
      <div className="login-card animate-in" style={{ maxWidth: '440px', width: '100%', padding: '36px', background: 'rgba(255, 255, 255, 0.98)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255,255,255,0.2)' }}>
        
        {/* Header with Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, var(--primary-600, #3b82f6) 0%, var(--primary-800, #1d4ed8) 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.35)' }}>
            <Landmark size={32} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Finova
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            Multi-Tenant Finance & Loan Management
          </p>
        </div>

        {/* Tab Switcher: Finance Login vs Super Admin */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '14px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => handleModeChange('FINANCE')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: loginMode === 'FINANCE' ? '#ffffff' : 'transparent',
              color: loginMode === 'FINANCE' ? '#0f172a' : '#64748b',
              boxShadow: loginMode === 'FINANCE' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Landmark size={16} />
            Finance Login
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('SUPER_ADMIN')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              background: loginMode === 'SUPER_ADMIN' ? '#ffffff' : 'transparent',
              color: loginMode === 'SUPER_ADMIN' ? '#0f172a' : '#64748b',
              boxShadow: loginMode === 'SUPER_ADMIN' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Shield size={16} />
            Super Admin
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '13px',
            lineHeight: '1.4',
            background: isInactiveError ? '#fffbeb' : '#fef2f2',
            color: isInactiveError ? '#b45309' : '#b91c1c',
            border: isInactiveError ? '1px solid #fde68a' : '1px solid #fecaca'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>{isInactiveError ? 'Account Deactivated' : 'Authentication Failed'}</strong>
              <div style={{ marginTop: '2px' }}>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 1. Finance Name / Code (Only in Finance mode) */}
          {loginMode === 'FINANCE' && (
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Finance Name or Code
              </label>
              <div style={{ position: 'relative' }}>
                <Landmark size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. SMF or Sri Murugan Finance"
                  value={financeCode}
                  onChange={(e) => setFinanceCode(e.target.value)}
                  required
                  style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', width: '100%', fontSize: '14px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <small style={{ color: '#94a3b8', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                Enter the unique code or finance name provided by Super Admin
              </small>
            </div>
          )}

          {/* 2. Phone / User ID */}
          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', marginBottom: '6px', display: 'block' }}>
              {loginMode === 'FINANCE' ? 'Registered Mobile Number or Agent ID' : 'Super Admin Mobile / Email'}
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="form-input"
                type="text"
                placeholder={loginMode === 'FINANCE' ? 'e.g. 9876543210' : '9999999999 or email'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="username"
                required
                style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', width: '100%', fontSize: '14px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          {/* 3. Password */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', margin: 0 }}>
                {loginMode === 'FINANCE' ? 'Password (Given by Super Admin)' : 'Master Password'}
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ padding: '12px 42px 12px 42px', borderRadius: '12px', width: '100%', fontSize: '14px', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{loginMode === 'FINANCE' ? 'Sign In to Finance' : 'Sign In as Super Admin'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div style={{ marginTop: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          {loginMode === 'FINANCE' ? (
            <span>Don't have credentials? Contact Super Admin to register your Finance.</span>
          ) : (
            <span>Super Admin Portal gives master authority over all finance tenants.</span>
          )}
        </div>

      </div>
    </div>
  );
}