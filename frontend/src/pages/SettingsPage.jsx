import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2, Percent, Lock, Save, Download,
  CheckCircle2, Shield, Phone, MapPin, Receipt,
  Check, RefreshCw, KeyRound, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { companiesAPI, usersAPI } from '../services/api';

export default function SettingsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'loans' | 'security'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 1. Business Profile
  const [companyName, setCompanyName] = useState('Sri Murugan Finance');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [receiptHeader, setReceiptHeader] = useState('SRI MURUGAN FINANCE');
  const [receiptFooter, setReceiptFooter] = useState('நன்றி! கடன் தவணையை குறித்த நாளில் செலுத்தவும்.');

  // 2. Loan Defaults
  const [defaultLoanModel, setDefaultLoanModel] = useState('WITHOUT_INTEREST');
  const [defaultFrequency, setDefaultFrequency] = useState('DAILY');
  const [defaultDailyTenure, setDefaultDailyTenure] = useState(100);
  const [defaultDeductionPercent, setDefaultDeductionPercent] = useState(10);
  const [defaultPenaltyAmount, setDefaultPenaltyAmount] = useState(50);

  // 3. Password Form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Load current settings from backend & local storage
  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await companiesAPI.getMySettings();
        if (mounted && res) {
          if (res.company) {
            setCompanyName(res.company.name || '');
            setOwnerName(res.company.ownerName || '');
            setPhone(res.company.phone || '');
            setAddress(res.company.address || '');
          }
          if (res.settings) {
            const s = res.settings;
            if (s.company?.receiptHeader) setReceiptHeader(s.company.receiptHeader);
            if (s.company?.receiptFooter) setReceiptFooter(s.company.receiptFooter);
            if (s.loanPolicy?.defaultLoanModel) setDefaultLoanModel(s.loanPolicy.defaultLoanModel);
            if (s.loanPolicy?.defaultFrequency) setDefaultFrequency(s.loanPolicy.defaultFrequency);
            if (s.loanPolicy?.defaultDailyTenure) setDefaultDailyTenure(s.loanPolicy.defaultDailyTenure);
            if (s.loanPolicy?.defaultProcessingFee) setDefaultDeductionPercent(s.loanPolicy.defaultProcessingFee);
            if (s.penaltyPolicy?.penaltyAmount) setDefaultPenaltyAmount(s.penaltyPolicy.penaltyAmount);
          }
        }
      } catch (err) {
        // Fallback to localStorage
        try {
          const cached = localStorage.getItem('finova_financial_settings');
          if (cached) {
            const s = JSON.parse(cached);
            if (s.company?.name) setCompanyName(s.company.name);
            if (s.company?.phone) setPhone(s.company.phone);
            if (s.company?.address) setAddress(s.company.address);
            if (s.loanPolicy?.defaultDailyTenure) setDefaultDailyTenure(s.loanPolicy.defaultDailyTenure);
          }
        } catch (_) {}
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchSettings();
    return () => { mounted = false; };
  }, []);

  // Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (!companyName.trim()) {
      return toast.error('Finance Company Name is required');
    }

    setSaving(true);
    const payload = {
      companyName: companyName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      settings: {
        company: {
          name: companyName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          receiptHeader: receiptHeader.trim(),
          receiptFooter: receiptFooter.trim(),
        },
        loanPolicy: {
          defaultLoanModel,
          defaultFrequency,
          defaultDailyTenure: parseInt(defaultDailyTenure, 10) || 100,
          defaultProcessingFee: parseFloat(defaultDeductionPercent) || 10,
        },
        penaltyPolicy: {
          penaltyAmount: parseFloat(defaultPenaltyAmount) || 50,
        }
      }
    };

    try {
      await companiesAPI.updateMySettings(payload);
      localStorage.setItem('finova_financial_settings', JSON.stringify(payload.settings));
      toast.success('Settings saved successfully!');
    } catch (err) {
      // Still update local storage
      localStorage.setItem('finova_financial_settings', JSON.stringify(payload.settings));
      toast.success('Settings saved locally!');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setChangingPass(true);
    try {
      await usersAPI.changePassword(user.id, { password: newPassword });
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update password');
    } finally {
      setChangingPass(false);
    }
  };

  // Export Backup
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const data = await companiesAPI.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance_backup_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup file downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export backup: ' + (err.message || 'Error'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ paddingBottom: 60 }}>
      {/* Top Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Settings</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Manage finance business profile, loan rules & security
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleExportBackup}
            disabled={exporting}
            style={{ gap: 6, fontWeight: 600 }}
          >
            <Download size={15} /> {exporting ? 'Exporting...' : 'Export Backup'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ gap: 6, fontWeight: 700 }}
          >
            <Save size={15} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* 3 Simple Tab Buttons */}
      <div className="settings-tab-bar" style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`tab-pill ${activeTab === 'profile' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'profile' ? 700 : 600,
            cursor: 'pointer',
            background: activeTab === 'profile' ? 'var(--primary-600)' : 'var(--bg-card)',
            color: activeTab === 'profile' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <Building2 size={16} /> 1. Business Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('loans')}
          className={`tab-pill ${activeTab === 'loans' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'loans' ? 700 : 600,
            cursor: 'pointer',
            background: activeTab === 'loans' ? 'var(--primary-600)' : 'var(--bg-card)',
            color: activeTab === 'loans' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <Percent size={16} /> 2. Loan Defaults
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`tab-pill ${activeTab === 'security' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'security' ? 700 : 600,
            cursor: 'pointer',
            background: activeTab === 'security' ? 'var(--primary-600)' : 'var(--bg-card)',
            color: activeTab === 'security' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <Lock size={16} /> 3. Account & Password
        </button>
      </div>

      {/* TAB 1: Business Profile */}
      {activeTab === 'profile' && (
        <div className="card animate-in" style={{ padding: '24px', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Finance Business Details</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Printed on customer receipts & reports</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Finance Company Name (நிறுவன பெயர்) *</label>
              <input
                type="text"
                className="form-input"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Sri Murugan Finance"
                required
              />
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Contact Person / Owner Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Jeevaa"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Contact Phone / Mobile (மொபைல் எண்)</label>
                <input
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Office Address (அலுவலக முகவரி)</label>
              <input
                type="text"
                className="form-input"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. 12, Main Bazaar, Coimbatore, Tamil Nadu"
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 20, paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 14 }}>
                <Receipt size={17} style={{ color: 'var(--primary-600)' }} /> Thermal Receipt Customization (ரசீது தலைப்பு & குறிப்பு)
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Receipt Header Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={receiptHeader}
                  onChange={e => setReceiptHeader(e.target.value)}
                  placeholder="e.g. SRI MURUGAN FINANCE"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Receipt Footer Note (நன்றி குறிப்பு)</label>
                <input
                  type="text"
                  className="form-input"
                  value={receiptFooter}
                  onChange={e => setReceiptFooter(e.target.value)}
                  placeholder="e.g. நன்றி! தவணையை குறித்த நாளில் செலுத்தவும்."
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6, width: '100%', justifyContent: 'center' }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Business Profile'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Loan Defaults */}
      {activeTab === 'loans' && (
        <div className="card animate-in" style={{ padding: '24px', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Percent size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Default Loan & Payment Policies</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Automatically applied when creating new loans</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Default Loan Calculation Model (இயல்புநிலை கடன் முறை)</label>
              <select
                className="form-select"
                value={defaultLoanModel}
                onChange={e => setDefaultLoanModel(e.target.value)}
              >
                <option value="WITHOUT_INTEREST">Deduction Based (கந்து வட்டி / முன்பணம் பிடித்தம் - 100 Days Daily/Weekly)</option>
                <option value="FLAT">Flat Interest Rate (வட்டி கடன் - மாத/வார வட்டி முறை)</option>
                <option value="EMI">EMI (அசலோடு சம தவணை முறை)</option>
              </select>
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Default Daily Repayment Period (நாட்கள்)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={defaultDailyTenure}
                  onChange={e => setDefaultDailyTenure(e.target.value)}
                  placeholder="e.g. 100"
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Universal standard is 100 days (100 நாள் தவணை)</span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Default Advance Deduction % (பிடித்தம் %)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="100"
                  value={defaultDeductionPercent}
                  onChange={e => setDefaultDeductionPercent(e.target.value)}
                  placeholder="e.g. 10"
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Upfront deduction percentage (e.g. 10%)</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 22 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Overdue Late Fee (அபராத கட்டணம் - ₹ per missed collection)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                value={defaultPenaltyAmount}
                onChange={e => setDefaultPenaltyAmount(e.target.value)}
                placeholder="e.g. 50"
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Flat penalty added when installment is overdue</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6, width: '100%', justifyContent: 'center' }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Loan Defaults'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Account & Password */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '720px' }}>
          {/* User Profile Card */}
          <div className="card animate-in" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{user?.name || 'Administrator'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email || user?.phone || 'admin@loanflow.com'}</div>
                </div>
              </div>
              <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                {user?.role || 'ADMIN'}
              </span>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="card animate-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Change Account Password</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Set a new secure password for your login</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>New Password (புதிய பாஸ்வேர்ட்)</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={changingPass} style={{ gap: 6, width: '100%', justifyContent: 'center' }}>
                <Lock size={16} /> {changingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
