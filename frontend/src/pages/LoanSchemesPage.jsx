import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, Info, Check, X, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function LoanSchemesPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editScheme, setEditScheme] = useState(null);
  const [form, setForm] = useState({
    name: '',
    calculationMethod: 'METHOD_1_FIXED',
    interestRate: '',
    processingFee: '',
    penaltyName: 'Late Fee',
    penaltyRate: ''
  });

  const load = async () => {
    try {
      const { data } = await api.get('/schemes');
      setSchemes(data.data || []);
    } catch (err) {
      toast.error('Failed to load schemes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditScheme(null);
    setForm({
      name: '',
      calculationMethod: 'METHOD_1_FIXED',
      interestRate: '',
      processingFee: '',
      penaltyName: 'Late Fee',
      penaltyRate: ''
    });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditScheme(s);
    setForm({ ...s });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Scheme name is required');
    try {
      if (editScheme) {
        await api.put(`/schemes/${editScheme.id}`, form);
        toast.success('Scheme updated');
      } else {
        await api.post('/schemes', form);
        toast.success('Scheme created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving scheme');
    }
  };

  const deleteScheme = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scheme?')) return;
    try {
      await api.delete(`/schemes/${id}`);
      toast.success('Scheme deleted');
      load();
    } catch (err) {
      toast.error('Error deleting scheme');
    }
  };

  const getMethodName = (m) => {
    switch (m) {
      case 'METHOD_1_FIXED': return 'Fixed (Flat Interest)';
      case 'METHOD_2_REDUCING': return 'Amortized (Diminishing EMI)';
      case 'METHOD_3_PRINCIPAL_ONLY': return 'Principal Recovery (0% Interest)';
      default: return m;
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h2>Loan Schemes</h2>
          <p>Create and manage loan calculation templates</p>
        </div>
        <div className="flex-mobile-stack items-center gap-12">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} />Create Scheme
          </button>
        </div>
      </div>

      <div className="card table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Scheme Name</th>
              <th>Calculation Logic</th>
              <th>Default Interest</th>
              <th>Late Fee Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
             schemes.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center' }}>No loan schemes created.</td></tr> :
             schemes.map(s => (
              <tr key={s.id}>
                <td className="fw-600">{s.name}</td>
                <td>{getMethodName(s.calculationMethod)}</td>
                <td className="fw-700 color-primary">{s.interestRate}%</td>
                <td>{s.penaltyName} ({s.penaltyRate}%)</td>
                <td>
                  <span className={`badge ${s.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}><Edit2 size={15} /></button>
                    <button className="btn btn-ghost btn-sm color-danger" onClick={() => deleteScheme(s.id)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{editScheme ? 'Edit Scheme' : 'Create New Loan Scheme'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <Shield size={16} color="var(--primary-500)" style={{ marginBottom: 4 }} /> 
                <br />
                By creating a scheme, you define the business terminology and calculation logic. This software engine will just execute the math based on your inputs.
              </div>

              <div className="form-group">
                <label className="form-label">Scheme Name (e.g. Daily Loan, Gold 2%) *</label>
                <input required className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Special Deepavali Loan" />
              </div>

              <div className="form-group">
                <label className="form-label">Internal Calculation Logic *</label>
                <select className="form-select" value={form.calculationMethod} onChange={e => setForm({...form, calculationMethod: e.target.value})}>
                  <option value="METHOD_1_FIXED">Method 1: Fixed Rate (Standard Flat)</option>
                  <option value="METHOD_2_REDUCING">Method 2: Amortized (Diminishing EMI)</option>
                  <option value="METHOD_3_PRINCIPAL_ONLY">Method 3: Principal Recovery Only (0%)</option>
                </select>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  <Info size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                  {form.calculationMethod === 'METHOD_1_FIXED' && 'Interest is calculated on total principal for the entire tenure.'}
                  {form.calculationMethod === 'METHOD_2_REDUCING' && 'Interest reduces as principal is paid off.'}
                  {form.calculationMethod === 'METHOD_3_PRINCIPAL_ONLY' && 'Only principal is recovered, no interest calculated.'}
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Default Interest Rate (%)</label>
                  <input type="number" step="0.01" className="form-input" value={form.interestRate} onChange={e => setForm({...form, interestRate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Processing Fee (%)</label>
                  <input type="number" step="0.01" className="form-input" value={form.processingFee} onChange={e => setForm({...form, processingFee: e.target.value})} />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Late Fee Label</label>
                  <input className="form-input" value={form.penaltyName} onChange={e => setForm({...form, penaltyName: e.target.value})} placeholder="e.g. Overdue Charge" />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Late Fee (%)</label>
                  <input type="number" step="0.01" className="form-input" value={form.penaltyRate} onChange={e => setForm({...form, penaltyRate: e.target.value})} />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><CheckCircle size={18} /> Save Scheme</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
