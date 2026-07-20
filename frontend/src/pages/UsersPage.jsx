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
  const [editUser, setEditUser] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      const res = await usersAPI.list({ role: filter || undefined, limit: 100 });
      setUsers(res);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const openAdd = () => {
    setForm({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
    setEditUser(null);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, phone: u.phone, password: '', role: u.role });
    setEditUser(u);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        await usersAPI.update(editUser.id, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
        });
        if (form.password.trim()) {
          await usersAPI.changePassword(editUser.id, { password: form.password });
        }
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(form);
        toast.success('User created successfully');
      }
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
      setEditUser(null);
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
          <button className="btn btn-primary" onClick={openAdd} style={{ whiteSpace: 'nowrap' }}><Plus size={18} />Add User</button>
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
                <td data-label="Phone"><Phone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /><a href={`tel:${u.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{u.phone}</a></td>
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ padding: '6px 8px' }} title="Edit User">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editUser ? 'Edit User' : 'Add New User'}</h3>
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
                    <label className="form-label">{editUser ? 'New Password (optional)' : 'Password *'}</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder={editUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                      required={!editUser}
                    />
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
                <button type="submit" className="btn btn-primary">{editUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
