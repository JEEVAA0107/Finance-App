import { useState, useEffect } from 'react';
import { companiesAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Landmark, Plus, ShieldCheck, ShieldAlert, Phone,
  Users, KeyRound, Search, RefreshCw, Trash2, Power, Edit2
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

  // Edit Finance & Credentials Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    code: '',
    ownerName: '',
    phone: '',
    password: '',
    address: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

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

  // Helper to normalize Indian phone number (+91, spaces, dashes supported)
  const cleanPhone = (val) => {
    if (!val) return '';
    let cleaned = String(val).replace(/[\s\-\(\)\.\,\+]/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    return cleaned;
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.code.trim() || !regForm.phone.trim() || !regForm.password.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    const normPhone = cleanPhone(regForm.phone);
    if (normPhone.length !== 10 || !/^\d{10}$/.test(normPhone)) {
      toast.error('Please enter a valid 10-digit mobile number (+91 is optional)');
      return;
    }

    try {
      const res = await companiesAPI.create({
        name: regForm.name.trim(),
        code: regForm.code.trim().toLowerCase(),
        ownerName: regForm.ownerName.trim() || regForm.name.trim(),
        phone: normPhone,
        password: regForm.password.trim(),
        address: regForm.address.trim()
      });

      toast.success(res?.message || 'Finance company created successfully!');
      setShowRegisterModal(false);
      setRegForm({ name: '', code: '', ownerName: '', phone: '', password: '', address: '' });
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create finance company');
    }
  };

  const handleOpenEditModal = (comp) => {
    setEditForm({
      id: comp.id,
      name: comp.name || '',
      code: comp.code || '',
      ownerName: comp.ownerName || '',
      phone: comp.phone || comp.admin?.phone || '',
      password: '',
      address: comp.address || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.code.trim() || !editForm.phone.trim()) {
      toast.error('Finance Name, Code, and Mobile Number are required');
      return;
    }

    const normPhone = cleanPhone(editForm.phone);
    if (normPhone.length !== 10 || !/^\d{10}$/.test(normPhone)) {
      toast.error('Please enter a valid 10-digit mobile number (+91 is optional)');
      return;
    }

    if (editForm.password && editForm.password.trim().length > 0 && editForm.password.trim().length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    try {
      setSubmittingEdit(true);
      const payload = {
        name: editForm.name.trim(),
        code: editForm.code.trim().toLowerCase(),
        ownerName: editForm.ownerName.trim() || editForm.name.trim(),
        phone: normPhone,
        address: editForm.address.trim()
      };
      if (editForm.password && editForm.password.trim().length >= 4) {
        payload.password = editForm.password.trim();
      }

      const res = await companiesAPI.update(editForm.id, payload);
      toast.success(res?.message || 'Finance company updated successfully!');
      setShowEditModal(false);
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update company');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleStatus = async (company) => {
    const newStatus = !company.isActive;
    const actionText = newStatus ? 'Activate' : 'Suspend';
    if (!window.confirm(`Are you sure you want to ${actionText} '${company.name}'?`)) {
      return;
    }

    try {
      await companiesAPI.toggleStatus(company.id, newStatus);
      toast.success(newStatus ? `'${company.name}' is now ACTIVE` : `'${company.name}' is now SUSPENDED`);
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isActive: newStatus } : c));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update company status');
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
      toast.error(err.response?.data?.message || err.message || 'Failed to reset password');
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
      toast.error(err.response?.data?.message || err.message || 'Failed to delete company');
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
    <div className="page-container animate-in" style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
              Super Admin Portal
            </h1>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
              Master Control
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Register, authenticate, and manage Finance businesses
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', width: 'auto' }}>
          <button
            className="btn btn-secondary"
            onClick={loadCompanies}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowRegisterModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontWeight: 700, fontSize: '13px' }}
          >
            <Plus size={16} />
            Register Finance
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="stat-card blue" style={{ padding: '14px', borderRadius: '14px' }}>
          <div className="stat-icon blue" style={{ width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={18} />
          </div>
          <div className="stat-value" style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{companies.length}</div>
          <div className="stat-label" style={{ fontSize: '12px' }}>Total Finances</div>
        </div>

        <div className="stat-card green" style={{ padding: '14px', borderRadius: '14px' }}>
          <div className="stat-icon green" style={{ width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} />
          </div>
          <div className="stat-value" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-500)', marginTop: '6px' }}>{activeCount}</div>
          <div className="stat-label" style={{ fontSize: '12px' }}>Active / Auth</div>
        </div>

        <div className="stat-card yellow" style={{ padding: '14px', borderRadius: '14px' }}>
          <div className="stat-icon yellow" style={{ width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={18} />
          </div>
          <div className="stat-value" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger-500)', marginTop: '6px' }}>{suspendedCount}</div>
          <div className="stat-label" style={{ fontSize: '12px' }}>Suspended</div>
        </div>

        <div className="stat-card purple" style={{ padding: '14px', borderRadius: '14px' }}>
          <div className="stat-icon purple" style={{ width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
          <div className="stat-value" style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{totalUsers}</div>
          <div className="stat-label" style={{ fontSize: '12px' }}>Staff & Admins</div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by Finance Name, Code (e.g. SMF), or Mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)' }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>✕</button>
        )}
      </div>

      {/* Companies List Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
            Finance Companies ({filtered.length})
          </h3>
        </div>

        {/* 1. Desktop Table View (>= 850px) */}
        <div className="superadmin-desktop-table table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px' }}>Finance Name</th>
                <th style={{ padding: '12px 16px' }}>Owner & Phone</th>
                <th style={{ padding: '12px 16px' }}>Metrics</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(comp => (
                <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  
                  {/* Finance Name & Code */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: comp.isActive ? 'var(--primary-50)' : 'var(--bg-tertiary)', color: comp.isActive ? 'var(--primary-600)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Landmark size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{comp.name}</div>
                        <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          CODE: {comp.code.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Owner & Phone */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>
                      {comp.ownerName || 'Finance Admin'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      <Phone size={12} /> {comp.phone || '-'}
                    </div>
                  </td>

                  {/* Metrics */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                      <div><strong>{comp.stats?.loans || 0}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Loans</span></div>
                      <div><strong>{comp.stats?.customers || 0}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Cust</span></div>
                      <div><strong>{comp.stats?.users || 0}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Staff</span></div>
                    </div>
                  </td>

                  {/* Active / Inactive Status with One-Click Toggle */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(comp)}
                      title={comp.isActive ? "Click to Suspend" : "Click to Activate"}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: comp.isActive ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        background: comp.isActive ? '#f0fdf4' : '#fef2f2',
                        color: comp.isActive ? '#166534' : '#991b1b',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Power size={12} />
                      {comp.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(comp)}
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                        title="Edit Finance Details & Phone"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPasswordModal(comp)}
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                        title="Reset Admin Password"
                      >
                        <KeyRound size={12} />
                        Password
                      </button>

                      {comp.stats?.loans === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(comp)}
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger-500)', padding: '5px' }}
                          title="Delete Company"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {searchTerm ? 'No matching finance companies.' : 'No finance companies registered yet. Click "+ Register Finance" to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile & Tablet Card View (<= 850px) */}
        <div className="superadmin-mobile-cards">
          {filtered.map(comp => (
            <div key={comp.id} className="superadmin-company-card">
              {/* Header: Landmark Icon, Company Name, Code & Status Toggle */}
              <div className="card-top-row">
                <div className="company-info-group">
                  <div className="company-icon-box" style={{ background: comp.isActive ? 'var(--primary-50)' : 'var(--bg-tertiary)', color: comp.isActive ? 'var(--primary-600)' : 'var(--text-muted)' }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h4 className="company-name">{comp.name}</h4>
                    <span className="company-code-badge">CODE: {comp.code.toUpperCase()}</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleToggleStatus(comp)}
                  className={`status-toggle-pill ${comp.isActive ? 'active' : 'suspended'}`}
                  title={comp.isActive ? "Click to Suspend" : "Click to Activate"}
                >
                  <Power size={12} />
                  <span>{comp.isActive ? 'ACTIVE' : 'SUSPENDED'}</span>
                </button>
              </div>

              {/* Owner & Direct Phone Call */}
              <div className="card-contact-row">
                <div className="contact-item">
                  <span className="contact-label">Owner:</span>
                  <span className="contact-val">{comp.ownerName || 'Finance Admin'}</span>
                </div>
                {comp.phone && (
                  <a href={`tel:${comp.phone}`} className="phone-chip" title="Call Owner">
                    <Phone size={13} />
                    <span>{comp.phone}</span>
                  </a>
                )}
              </div>

              {/* Metrics Grid (3 equal pills) */}
              <div className="card-metrics-grid">
                <div className="metric-pill">
                  <span className="metric-num">{comp.stats?.loans || 0}</span>
                  <span className="metric-name">Loans</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-num">{comp.stats?.customers || 0}</span>
                  <span className="metric-name">Customers</span>
                </div>
                <div className="metric-pill">
                  <span className="metric-num">{comp.stats?.users || 0}</span>
                  <span className="metric-name">Staff</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="card-actions-row">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(comp)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPasswordModal(comp)}
                  className="btn btn-secondary password-btn"
                >
                  <KeyRound size={14} />
                  <span>Reset Password</span>
                </button>
                {comp.stats?.loans === 0 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCompany(comp)}
                    className="btn btn-ghost delete-btn"
                    title="Delete Company"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              {searchTerm ? 'No matching finance companies.' : 'No finance companies registered yet. Click "+ Register Finance" to create one.'}
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Register New Finance */}
      {showRegisterModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal animate-in" style={{ background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '8px', borderRadius: '10px' }}>
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Register New Finance</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '11px' }}>Provision business & admin account</p>
                </div>
              </div>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateCompany}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Finance Business Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sri Murugan Finance"
                  value={regForm.name}
                  onChange={handleNameChange}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Company Login Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. smf"
                  value={regForm.code}
                  onChange={(e) => setRegForm({ ...regForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Murugan"
                    value={regForm.ownerName}
                    onChange={(e) => setRegForm({ ...regForm, ownerName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Initial Login Password * (Set by Super Admin)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Murugan@2024"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Finance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Admin Password */}
      {showPasswordModal && selectedCompany && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal animate-in" style={{ background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '380px', width: '100%', padding: '24px', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={18} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Reset Password</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 14px 0' }}>
              Setting a new password for <strong>{selectedCompany.name}</strong> ({selectedCompany.phone}).
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label">New Password</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingPassword}>
                  {submittingPassword ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal 3: Edit Finance & Admin Credentials */}
      {showEditModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal animate-in" style={{ background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '460px', width: '100%', padding: '24px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '8px', borderRadius: '10px' }}>
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Edit Finance & Credentials</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '11px' }}>Update company profile & login details</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateCompany}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Finance Business Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sri Murugan Finance"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Company Login Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. smf"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Murugan"
                    value={editForm.ownerName}
                    onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Login Phone Number *</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>+91 & spaces optional</span>
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 9876543210 or +91 98765 43210"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Must be a 10-digit number. Any formatting (+91, spaces) will be accepted automatically.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Leave blank to keep existing password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Only enter if you wish to reset this Finance Admin's password.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label">Business Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 12, Main Road, Madurai"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
