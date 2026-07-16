import { useState, useEffect } from 'react';
import { companiesAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Landmark, Plus, Shield, ShieldCheck, ShieldAlert, Phone, Mail, ToggleLeft, ToggleRight, Settings } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('companies');
  
  // Modals / forms state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', code: '' });
  
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', phone: '', password: '', companyId: '', role: 'ADMIN' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [compList, userList] = await Promise.all([
        companiesAPI.list(),
        usersAPI.list() // Super Admin sees all users across companies
      ]);
      setCompanies(compList);
      // Filter only Finance Admins
      setAdmins(userList.filter(u => u.role === 'ADMIN'));
    } catch (err) {
      toast.error('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!companyForm.name.trim() || !companyForm.code.trim()) {
      toast.error('All fields are required');
      return;
    }
    const normalizedCode = companyForm.code.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!normalizedCode) {
      toast.error('Invalid company code. Use letters and numbers only.');
      return;
    }
    try {
      await companiesAPI.create({ name: companyForm.name.trim(), code: normalizedCode });
      toast.success('Company registered successfully!');
      setShowCompanyModal(false);
      setCompanyForm({ name: '', code: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to create company');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.phone.trim() || !adminForm.password.trim() || !adminForm.companyId) {
      toast.error('All fields are required');
      return;
    }
    try {
      await usersAPI.create(adminForm);
      toast.success('Finance Admin created successfully!');
      setShowAdminModal(false);
      setAdminForm({ name: '', email: '', phone: '', password: '', companyId: '', role: 'ADMIN' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to create admin');
    }
  };

  const toggleCompanyStatus = async (comp) => {
    const newStatus = parseInt(comp.isActive) === 1 ? 0 : 1;
    try {
      await companiesAPI.toggleActive(comp.id, newStatus);
      toast.success(`Subscription ${newStatus ? 'activated' : 'deactivated'} for ${comp.name}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update company subscription');
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading System details...</p></div>;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h2>Super Admin Dashboard</h2>
          <p>Global control of companies, subscriptions, and security credentials</p>
        </div>
        
        <div className="flex-mobile-stack items-center gap-12">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}>Companies</button>
            <button className={`tab ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>Finance Admins</button>
          </div>
          {activeTab === 'companies' ? (
            <button className="btn btn-primary" onClick={() => setShowCompanyModal(true)} style={{ whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Register Company
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowAdminModal(true)} style={{ whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Create Admin
            </button>
          )}
        </div>
      </div>

      {/* Overview stats cards */}
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <h3>Total Registered Companies</h3>
          <div className="metric-value">{companies.length}</div>
        </div>
        <div className="metric-card">
          <h3>Active Subscriptions</h3>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {companies.filter(c => parseInt(c.isActive) === 1).length}
          </div>
        </div>
        <div className="metric-card">
          <h3>Suspended Companies</h3>
          <div className="metric-value" style={{ color: 'var(--danger)' }}>
            {companies.filter(c => parseInt(c.isActive) === 0).length}
          </div>
        </div>
      </div>

      {/* Main Tables */}
      {activeTab === 'companies' ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Unique Code</th>
                <th>Status</th>
                <th>Subscription Controls</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(comp => (
                <tr key={comp.id}>
                  <td data-label="Company Name">
                    <div className="flex items-center gap-12">
                      <div className="sidebar-avatar" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', width: 36, height: 36 }}>
                        <Landmark size={18} />
                      </div>
                      <div>
                        <strong>{comp.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td data-label="Unique Code">
                    <code style={{ background: 'var(--border-color)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                      {comp.code}
                    </code>
                  </td>
                  <td data-label="Status">
                    {parseInt(comp.isActive) === 1 ? (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={14} /> Active
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldAlert size={14} /> Suspended
                      </span>
                    )}
                  </td>
                  <td data-label="Subscription Controls">
                    <button 
                      className={`btn ${parseInt(comp.isActive) === 1 ? 'btn-danger' : 'btn-primary'}`} 
                      onClick={() => toggleCompanyStatus(comp)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {parseInt(comp.isActive) === 1 ? 'Suspend Subscription' : 'Activate Subscription'}
                    </button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No companies registered yet. Click 'Register Company' to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Admin Name</th>
                <th>Login Email</th>
                <th>Mobile Number</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => {
                const comp = companies.find(c => c.id === admin.companyId);
                return (
                  <tr key={admin.id}>
                    <td data-label="Admin Name">
                      <div className="flex items-center gap-12">
                        <div className="sidebar-avatar" style={{ width: 36, height: 36 }}>{admin.name?.charAt(0)}</div>
                        <strong>{admin.name}</strong>
                      </div>
                    </td>
                    <td data-label="Login Email">
                      <div className="flex items-center gap-6" style={{ color: 'var(--text-muted)' }}>
                        <Mail size={14} /> {admin.email}
                      </div>
                    </td>
                    <td data-label="Mobile Number">
                      <div className="flex items-center gap-6" style={{ color: 'var(--text-muted)' }}>
                        <Phone size={14} /> {admin.phone}
                      </div>
                    </td>
                    <td data-label="Company">
                      <span className="badge badge-success" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                        {comp ? comp.name : 'Unknown Company'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No company administrator accounts created yet. Click 'Create Admin' to assign one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Company Modal */}
      {showCompanyModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-in" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Register New Company</h3>
              <button className="btn-close" onClick={() => setShowCompanyModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCompany}>
              <div className="form-group">
                <label className="form-label">Company Legal Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Finance Ltd"
                  value={companyForm.name}
                  onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unique Company Login Code (Letters/numbers only)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. apex"
                  value={companyForm.code}
                  onChange={e => setCompanyForm({ ...companyForm, code: e.target.value })}
                  required
                />
                <small className="form-help" style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                  This code will be entered by agents and admins to log into this company.
                </small>
              </div>
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompanyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Finance Admin Modal */}
      {showAdminModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-in" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Create Company Administrator</h3>
              <button className="btn-close" onClick={() => setShowAdminModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Robert Downey"
                  value={adminForm.name}
                  onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. robert@company.com"
                  value={adminForm.email}
                  onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 9876543210"
                  value={adminForm.phone}
                  onChange={e => setAdminForm({ ...adminForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Company</label>
                <select
                  className="form-select"
                  value={adminForm.companyId}
                  onChange={e => setAdminForm({ ...adminForm, companyId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                  required
                >
                  <option value="">-- Choose Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Login Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter temporary password"
                  value={adminForm.password}
                  onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Provision Admin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
