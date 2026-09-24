/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { UserCog, Plus, Edit2, Trash2, X, Shield, Phone, Mail, UserCheck } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
  const [editUser, setEditUser] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      const res = await usersAPI.list({ role: filter || undefined, excludeCustomers: true, limit: 100 });
      // Strictly filter out any customers - this view is for agents and staff only
      const agentList = (Array.isArray(res) ? res : (res?.data || [])).filter(u => u.role !== 'CUSTOMER');
      setUsers(agentList);
    } catch { toast.error('Failed to load agents'); }
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
    const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      if (editUser) {
        await usersAPI.update(editUser.id, {
          name: form.name,
          email: form.email,
          phone: cleanPhone,
          role: form.role,
        });
        if (form.password.trim()) {
          await usersAPI.changePassword(editUser.id, { password: form.password });
        }
        toast.success('Agent updated successfully');
      } else {
        await usersAPI.create({ ...form, phone: cleanPhone });
        toast.success('Agent created successfully');
      }
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'AGENT' });
      setEditUser(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Operation failed'); }
  };

  const toggleActive = async (user) => {
    if (user.role === 'ADMIN') {
      toast.error('Admin account cannot be deactivated from Agent Management.');
      return;
    }
    try {
      await usersAPI.update(user.id, { isActive: !user.isActive });
      toast.success(`Agent ${user.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Update failed');
    }
  };

  const deleteUser = async (user) => {
    if (user.role === 'ADMIN') {
      toast.error('Admin users cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to completely delete the agent "${user.name}"? This action cannot be undone.`)) {
      try {
        await usersAPI.delete(user.id);
        toast.success('Agent deleted successfully');
        load();
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Delete failed');
      }
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading agents...</p></div>;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h2>Agent Management</h2>
          <p>Manage field agents, collectors & staff accounts</p>
        </div>
        <div className="flex-mobile-stack items-center gap-12">
          <button className="btn btn-primary" onClick={openAdd} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} />Add Agent
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Agent ID</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No agents found. Click "Add Agent" to register an agent.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td data-label="Agent">
                    <div className="flex items-center gap-12">
                      <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 13, background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="fw-600">{u.name}</div>
                    </div>
                  </td>
                  <td data-label="Agent ID">
                    <div className="fw-700" style={{ color: 'var(--primary-600)' }}>{u.agentId || '-'}</div>
                  </td>
                  <td data-label="Email">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={14} style={{ color: 'var(--text-muted)' }} />{u.email}
                    </span>
                  </td>
                  <td data-label="Phone">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                      <a href={`tel:${u.phone}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>{u.phone}</a>
                    </span>
                  </td>
                  <td data-label="Role">
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : 'badge-info'}`}>
                      <Shield size={10} />{u.role === 'ADMIN' ? 'ADMIN' : 'FIELD AGENT'}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td data-label="Joined" className="fs-12 color-muted">
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ padding: '6px 8px' }} title="Edit Agent Details">
                        <Edit2 size={14} />
                      </button>
                      {u.role !== 'ADMIN' ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          Primary Admin
                        </span>
                      )}
                      {u.role !== 'ADMIN' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u)} style={{ padding: '6px 8px', color: 'var(--danger-600)' }} title="Delete Agent">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Agent Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={20} color="var(--primary-500)" />
                {editUser ? 'Edit Agent' : 'Add New Agent'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" placeholder="agent@loanflow.local" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">10-Digit Mobile Phone *</label>
                    <input className="form-input" maxLength={10} placeholder="e.g. 9876543210" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} required />
                  </div>
                </div>
                <div className="form-row">
                  {editUser && (
                    <div className="form-group">
                      <label className="form-label">New Password (optional)</label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Leave blank to keep current"
                        value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <input className="form-input" value="Field Agent" disabled />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editUser ? 'Save Changes' : 'Create Agent'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
