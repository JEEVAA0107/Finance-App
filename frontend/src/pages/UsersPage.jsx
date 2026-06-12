/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { UserCog, Plus, Edit2, X, Shield, Phone, Mail } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      const res = await usersAPI.list({ role: filter || undefined, limit: 100 });
      setUsers(res);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.create(form);
      toast.success('User created successfully');
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const toggleActive = async (user) => {
    try {
      await usersAPI.update(user.id, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch { toast.error('Update failed'); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h2>User Management</h2>
          <p>Manage system users and roles</p>
        </div>
        <div className="flex-mobile-stack items-center gap-12">
          <div className="tabs" style={{ marginBottom: 0, width: '100%' }}>
            <button className={`tab ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
            <button className={`tab ${filter === 'ADMIN' ? 'active' : ''}`} onClick={() => setFilter('ADMIN')}>Admin</button>
            <button className={`tab ${filter === 'AGENT' ? 'active' : ''}`} onClick={() => setFilter('AGENT')}>Agent</button>
            <button className={`tab ${filter === 'CUSTOMER' ? 'active' : ''}`} onClick={() => setFilter('CUSTOMER')}>Customer</button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ whiteSpace: 'nowrap' }}><Plus size={18} />Add User</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td data-label="User">
                  <div className="flex items-center gap-12">
                    <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{u.name?.charAt(0)}</div>
                    <div className="fw-600">{u.name}</div>
                  </div>
                </td>
                <td data-label="Email"><Mail size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{u.email}</td>
                <td data-label="Phone"><Phone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{u.phone}</td>
                <td data-label="Role">
                  <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'AGENT' ? 'badge-info' : 'badge-success'}`}>
                    <Shield size={10} />{u.role}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={`badge ${u.isActive ? 'badge-success' : 'badge-muted'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                </td>
                <td data-label="Joined" className="fs-12 color-muted">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                <td data-label="Actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input className="form-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                      <option value="AGENT">Field Agent</option>
                      <option value="ADMIN">Admin</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
