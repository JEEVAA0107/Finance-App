import { useState, useEffect } from 'react';
import { companiesAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Landmark, Plus, Shield, ShieldCheck, ShieldAlert, Phone,
  Users, KeyRound, Search, CheckCircle2, XCircle, RefreshCw, Trash2, Power
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Register Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    code: '',
    ownerName: '',
    phone: '',
    password: '',
    address: ''
  });

  // Reset Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await companiesAPI.list();
      setCompanies(data || []);
    } catch (err) {
      toast.error('Failed to load registered finance companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  // Auto-suggest code from company name
  const handleNameChange = (e) => {
    const val = e.target.value;
    const suggestedCode = val
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('') || val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);

    setRegForm(prev => ({
      ...prev,
      name: val,
      code: prev.code ? prev.code : suggestedCode
    }));
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.code.trim() || !regForm.phone.trim() || !regForm.password.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const res = await companiesAPI.create({
        name: regForm.name.trim(),
        code: regForm.code.trim().toLowerCase(),
        ownerName: regForm.ownerName.trim() || regForm.name.trim(),
        phone: regForm.phone.trim(),
        password: regForm.password.trim(),
        address: regForm.address.trim()
      });

      toast.success(res?.message || 'Finance company created successfully!');
      setShowRegisterModal(false);
      setRegForm({ name: '', code: '', ownerName: '', phone: '', password: '', address: '' });
      loadCompanies();
    } catch (err) {
      toast.error(err.message || 'Failed to create finance company');
    }
  };

  const handleToggleStatus = async (company) => {
    const newStatus = !company.isActive;
    const actionText = newStatus ? 'Activate' : 'Suspend';
    if (!window.confirm(`Are you sure you want to ${actionText} '${company.name}'? ${newStatus ? 'Staff will be able to log in.' : 'Staff and Admin will be blocked from logging in.'}`)) {
      return;
    }

    try {
      await companiesAPI.toggleStatus(company.id, newStatus);
      toast.success(newStatus ? `'${company.name}' is now ACTIVE` : `'${company.name}' is now SUSPENDED`);
      // Update local state directly for instant feedback
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isActive: newStatus } : c));
    } catch (err) {
      toast.error(err.message || 'Failed to update company status');
      loadCompanies();
    }
  };

  const handleOpenPasswordModal = (company) => {
    setSelectedCompany(company);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    try {
      setSubmittingPassword(true);
      await companiesAPI.resetAdminPassword(selectedCompany.id, newPassword.trim());
      toast.success(`Password updated for ${selectedCompany.name} Admin!`);
      setShowPasswordModal(false);
      setSelectedCompany(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`Are you sure you want to delete '${company.name}'? This cannot be undone.`)) {
      return;
    }
    try {
      await companiesAPI.delete(company.id);
      toast.success(`Company '${company.name}' deleted.`);
      loadCompanies();
    } catch (err) {
      toast.error(err.message || 'Failed to delete company');
    }
  };

  // Filtered companies
  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.ownerName && c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = companies.filter(c => c.isActive).length;
  const suspendedCount = companies.filter(c => !c.isActive).length;
  const totalUsers = companies.reduce((sum, c) => sum + (c.stats?.users || 0), 0);

  return (
    <div className="page-container animate-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
              Super Admin Portal
            </h1>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>
              Master Authority
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Provision, manage, and authenticate all Finance companies in the platform
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={loadCompanies}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowRegisterModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700 }}
          >
            <Plus size={18} />
            Register New Finance
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card blue" style={{ padding: '20px', borderRadius: '16px' }}>
          <div className="stat-icon blue" style={{ background: '#dbeafe', color: '#1d4ed8', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={22} />
          </div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{companies.length}</div>
          <div className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total Registered Finances</div>
        </div>

        <div className="stat-card green" style={{ padding: '20px', borderRadius: '16px' }}>
          <div className="stat-icon green" style={{ background: '#dcfce7', color: '#15803d', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a', marginTop: '8px' }}>{activeCount}</div>
          <div className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Active & Authenticated</div>
        </div>

        <div className="stat-card yellow" style={{ padding: '20px', borderRadius: '16px' }}>
          <div className="stat-icon yellow" style={{ background: '#fee2e2', color: '#b91c1c', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626', marginTop: '8px' }}>{suspendedCount}</div>
          <div className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Suspended / Inactive</div>
        </div>

        <div className="stat-card purple" style={{ padding: '20px', borderRadius: '16px' }}>
          <div className="stat-icon purple" style={{ background: '#f3e8ff', color: '#7e22ce', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{totalUsers}</div>
          <div className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total System Users</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: '#ffffff', padding: '12px 18px', borderRadius: '14px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
        <Search size={18} style={{ color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Search by Finance Name, Code (e.g. SMF), or Owner Phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#0f172a' }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {/* Companies List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '18px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            Registered Finance Businesses ({filtered.length})
          </h3>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' }}>
                <th style={{ padding: '14px 20px' }}>Finance Name & Code</th>
                <th style={{ padding: '14px 20px' }}>Owner / Mobile</th>
                <th style={{ padding: '14px 20px' }}>Data Metrics</th>
                <th style={{ padding: '14px 20px' }}>Authentication Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(comp => (
                <tr key={comp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  
                  {/* Finance Name & Code */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: comp.isActive ? '#eff6ff' : '#f8fafc', color: comp.isActive ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        <Landmark size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{comp.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', letterSpacing: '0.5px' }}>
                            CODE: {comp.code.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Owner & Phone */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>
                      {comp.ownerName || 'Finance Admin'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                      <Phone size={13} /> {comp.phone || 'No phone'}
                    </div>
                  </td>

                  {/* Metrics */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{comp.stats?.loans || 0}</span>{' '}
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Loans</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{comp.stats?.customers || 0}</span>{' '}
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Cust</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{comp.stats?.users || 0}</span>{' '}
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Users</span>
                      </div>
                    </div>
                  </td>

                  {/* Active / Inactive Status with One-Click Toggle */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(comp)}
                        title={comp.isActive ? "Click to Suspend this Finance" : "Click to Activate this Finance"}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: comp.isActive ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          background: comp.isActive ? '#f0fdf4' : '#fef2f2',
                          color: comp.isActive ? '#166534' : '#991b1b',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Power size={14} />
                        {comp.isActive ? 'ACTIVE / AUTH' : 'SUSPENDED'}
                      </button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenPasswordModal(comp)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                        title="Set new password for this Finance Admin"
                      >
                        <KeyRound size={14} />
                        Password
                      </button>

                      {comp.stats?.loans === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(comp)}
                          className="btn btn-ghost"
                          style={{ color: '#ef4444', padding: '6px' }}
                          title="Delete Company"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    {searchTerm ? 'No finance companies match your search.' : 'No finance companies registered yet. Click "+ Register New Finance" to add your first client.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Register New Finance Company */}
      {showRegisterModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="modal animate-in" style={{ background: '#fff', borderRadius: '20px', maxWidth: '500px', width: '100%', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#dbeafe', color: '#2563eb', padding: '10px', borderRadius: '12px' }}>
                  <Landmark size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Register New Finance</h3>
                  <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>Create tenant & provision Admin account</p>
                </div>
              </div>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleCreateCompany}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Finance Business Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sri Murugan Finance"
                  value={regForm.name}
                  onChange={handleNameChange}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Unique Company Login Code *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. smf or srimurugan"
                  value={regForm.code}
                  onChange={(e) => setRegForm({ ...regForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
                <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                  This code will be typed by the Finance Owner and their agents on the Login screen.
                </small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    Owner Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Murugan S"
                    value={regForm.ownerName}
                    onChange={(e) => setRegForm({ ...regForm, ownerName: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Initial Login Password * (Set by Super Admin)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Murugan@2024"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
                <small style={{ color: '#2563eb', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                  You will share this password with the Finance owner so they can log in.
                </small>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}>
                  Create & Provision Finance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Admin Password */}
      {showPasswordModal && selectedCompany && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="modal animate-in" style={{ background: '#fff', borderRadius: '20px', maxWidth: '420px', width: '100%', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Reset Admin Password</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Setting a new password for <strong>{selectedCompany.name}</strong> ({selectedCompany.phone || 'Admin'}).
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingPassword} style={{ background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}>
                  {submittingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}