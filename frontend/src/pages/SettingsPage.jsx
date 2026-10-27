import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  User, Lock, Building2, Printer, LogOut, Save,
  AlertOctagon, CheckCircle2, Phone, MapPin, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI, dashboardAPI } from '../services/api';

const DEFAULT_SETTINGS = {
  companyName: 'Sri Murugan Finance',
  businessPhone: '',
  address: 'Main Road, Coimbatore, Tamil Nadu',
  receiptTitle: 'SRI MURUGAN FINANCE',
  receiptFooter: 'Thank you for your prompt payment!',
  printerSize: '58mm',
};

export default function SettingsPage() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'business' | 'danger'

  // Persistent business settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('finance_app_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (_) {}
    return {
      ...DEFAULT_SETTINGS,
      companyName: user?.company?.name || DEFAULT_SETTINGS.companyName,
      businessPhone: user?.company?.phone || user?.phone || '',
      address: user?.company?.address || DEFAULT_SETTINGS.address,
    };
  });

  // Profile update state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
      });
      if (user.company) {
        setSettings(prev => ({
          ...prev,
          companyName: user.company.name || prev.companyName,
          businessPhone: user.company.phone || prev.businessPhone,
          address: user.company.address || prev.address,
        }));
      }
    }
  }, [user]);

  const updateSetting = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('finance_app_settings', JSON.stringify(settings));
      toast.success('Details saved successfully!');
    } catch (err) {
      toast.error('Failed to save details: ' + err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return toast.error('Name is required');
    if (!profileForm.phone.trim()) return toast.error('Phone number is required');

    setUpdatingProfile(true);
    try {
      await usersAPI.update(user.id, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        u.name = profileForm.name.trim();
        u.phone = profileForm.phone.trim();
        localStorage.setItem('user', JSON.stringify(u));
      }
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setUpdatingPassword(true);
    try {
      await usersAPI.changePassword(user.id, { password: passwordForm.newPassword });
      toast.success('Password changed successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleResetData = async () => {
    setResetting(true);
    try {
      const res = await dashboardAPI.resetAllData();
      toast.success(res.message || 'All records have been reset.');
      setShowResetConfirm(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="animate-in" style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 60 }}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Settings (அமைப்புகள்)</h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
          Manage your account profile, password, and shop details
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 10,
        marginBottom: 20
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'profile' ? 'var(--primary-600, #4f46e5)' : 'var(--bg-subtle, #f1f5f9)',
            color: activeTab === 'profile' ? '#fff' : 'var(--text-secondary, #475569)',
            transition: 'all 0.2s',
          }}
        >
          <User size={15} /> Profile & Password (சுயவிவரம் & கடவுச்சொல்)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('business')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'business' ? 'var(--primary-600, #4f46e5)' : 'var(--bg-subtle, #f1f5f9)',
            color: activeTab === 'business' ? '#fff' : 'var(--text-secondary, #475569)',
            transition: 'all 0.2s',
          }}
        >
          <Building2 size={15} /> Business & Receipt (நிறுவனம் & ரசீது)
        </button>

        {(isAdmin || isSuperAdmin) && (
          <button
            type="button"
            onClick={() => setActiveTab('danger')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'danger' ? '#ef4444' : 'var(--bg-subtle, #f1f5f9)',
              color: activeTab === 'danger' ? '#fff' : '#ef4444',
              transition: 'all 0.2s',
              marginLeft: 'auto',
            }}
          >
            <AlertOctagon size={15} /> Reset Records
          </button>
        )}
      </div>

      {/* TAB 1: PROFILE & PASSWORD */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* User Profile Card */}
          <div className="card" style={{ padding: 20, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800
              }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{user?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 8px', fontWeight: 700 }}>
                    Role: {user?.role}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Phone: {user?.phone || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Your Name (பெயர்) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Mobile Number (அலைபேசி எண்) *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={updatingProfile}>
                  {updatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="card" style={{ padding: 20, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
              <Lock size={16} style={{ color: '#d97706' }} />
              Change Password (கடவுச்சொல் மாற்றம்)
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Confirm New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Re-type new password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, textAlign: 'right' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={updatingPassword}
                  style={{ background: '#d97706', borderColor: '#b45309' }}
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Sign Out Card */}
          <div className="card" style={{ padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Sign Out from this Device</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log out from current login session safely</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn btn-ghost btn-sm"
              style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', gap: 6, fontWeight: 700 }}
            >
              <LogOut size={14} /> Sign Out (வெளியேறு)
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESS & RECEIPT */}
      {activeTab === 'business' && (
        <div className="card" style={{ padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
            Shop & Receipt Details (நிறுவனம் & ரசீது விவரங்கள்)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Finance / Shop Name *</label>
              <input
                type="text"
                className="form-input"
                value={settings.companyName}
                onChange={e => updateSetting('companyName', e.target.value)}
                placeholder="e.g. Sri Murugan Finance"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Office / Helpline Phone</label>
              <input
                type="tel"
                className="form-input"
                value={settings.businessPhone}
                onChange={e => updateSetting('businessPhone', e.target.value)}
                placeholder="Contact mobile number"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="form-label">Shop / Branch Address</label>
            <input
              type="text"
              className="form-input"
              value={settings.address}
              onChange={e => updateSetting('address', e.target.value)}
              placeholder="e.g. Main Road, Coimbatore"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '18px 0 14px' }} />

          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} style={{ color: 'var(--primary-600)' }} />
            Receipt Print Text (ரசீதில் அச்சிடப்படும் வாசகம்)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Receipt Header Title</label>
              <input
                type="text"
                className="form-input"
                value={settings.receiptTitle}
                onChange={e => updateSetting('receiptTitle', e.target.value)}
                placeholder="e.g. SRI MURUGAN FINANCE"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Receipt Footer Note</label>
              <input
                type="text"
                className="form-input"
                value={settings.receiptFooter}
                onChange={e => updateSetting('receiptFooter', e.target.value)}
                placeholder="e.g. Thank you for prompt payment!"
              />
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <button type="button" className="btn btn-primary" onClick={handleSaveSettings} style={{ gap: 6 }}>
              <Save size={15} /> Save Details
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DANGER / RESET DATA (ADMIN ONLY) */}
      {activeTab === 'danger' && (isAdmin || isSuperAdmin) && (
        <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
            <AlertOctagon size={20} />
            Reset Application Records (தரவு மீட்டமைப்பு)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            This will clear customer and loan records so you can start clean. User and Admin login accounts will not be affected.
          </div>

          {!showResetConfirm ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowResetConfirm(true)}
              style={{ background: '#dc2626', borderColor: '#b91c1c', gap: 6 }}
            >
              <AlertOctagon size={15} /> Reset Records
            </button>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #ef4444', borderRadius: 10, padding: 16, maxWidth: 440 }}>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 14, marginBottom: 6 }}>
                ⚠️ Are you sure you want to reset?
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                All existing customer entries and loan history will be deleted.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={resetting}
                  onClick={handleResetData}
                  style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                >
                  {resetting ? 'Resetting...' : 'Yes, Reset Now'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
