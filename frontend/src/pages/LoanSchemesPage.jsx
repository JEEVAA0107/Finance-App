import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, Info, X, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { schemesAPI } from '../services/api';

export default function LoanSchemesPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setLoading(true);
    try {
      const data = await schemesAPI.list();
      setSchemes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading schemes:', err);
      toast.error('Failed to load schemes: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
  }, []);

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
    setForm({
      name: s.name || '',
      calculationMethod: s.calculationMethod || 'METHOD_1_FIXED',
      interestRate: s.interestRate !== undefined ? s.interestRate : '',
      processingFee: s.processingFee !== undefined ? s.processingFee : '',
      penaltyName: s.penaltyName || 'Late Fee',
      penaltyRate: s.penaltyRate !== undefined ? s.penaltyRate : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Scheme name is required');
    
    setSaving(true);
    try {
      if (editScheme) {
        await schemesAPI.update(editScheme.id, form);
        toast.success('Scheme updated successfully');
      } else {
        await schemesAPI.create(form);
        toast.success('Scheme created successfully');
      }
      setShowModal(false);
      load();
    } catch (err) {
      console.error('Error saving scheme:', err);
      toast.error(err.response?.data?.message || err.message || 'Error saving scheme');
    } finally {
      setSaving(false);
    }
  };

  const deleteScheme = async (id, schemeName) => {
    if (!window.confirm(`Are you sure you want to delete the scheme "${schemeName}"?`)) return;
    try {
      await schemesAPI.delete(id);
      toast.success('Scheme deleted successfully');
      load();
    } catch (err) {
      console.error('Error deleting scheme:', err);
      toast.error(err.response?.data?.message || err.message || 'Error deleting scheme');
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
    <div className="animate-in" style={{ paddingBottom: 60 }}>
      <div className="page-header page-header-actions">
        <div>
          <h2>Loan Schemes & Calculation Plans</h2>
          <p>Define custom scheme names, rates, and calculation models</p>
        </div>
        <div className="flex-mobile-stack items-center gap-12">
          <button className="btn btn-ghost" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} /> Create Scheme
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
              <th>Processing Fee</th>
              <th>Late Fee Policy</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Loading loan schemes...</span>
                </td>
              </tr>
            ) : schemes.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <AlertCircle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px auto', display: 'block' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Loan Schemes Configured</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Click Create Scheme to set up your first template.</p>
                  <button className="btn btn-primary btn-sm" onClick={openAdd}>
                    <Plus size={16} /> Create Scheme Now
                  </button>
                </td>
              </tr>
            ) : (
              schemes.map(s => (
                <tr key={s.id}>
                  <td className="fw-600" style={{ color: 'var(--text-primary)' }}>
                    {s.name}
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: 12, 
                      padding: '3px 8px', 
                      borderRadius: 6, 
                      background: 'rgba(59, 130, 246, 0.08)',
                      color: 'var(--primary-600)',
                      fontWeight: 600
                    }}>
                      {getMethodName(s.calculationMethod)}
                    </span>
                  </td>
                  <td className="fw-700" style={{ color: 'var(--primary-500)' }}>
                    {s.interestRate}%
                  </td>
                  <td>
                    {s.processingFee ? `${s.processingFee}%` : '-'}
                  </td>
                  <td>
                    {s.penaltyName || 'Late Fee'} ({s.penaltyRate || 0}%)
                  </td>
                  <td>
                    <span className={`badge ${s.isActive !== false ? 'badge-success' : 'badge-neutral'}`}>
                      {s.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)} title="Edit Scheme">
                        <Edit2 size={15} />
                      </button>
                      <button className="btn btn-ghost btn-sm color-danger" onClick={() => deleteScheme(s.id, s.name)} title="Delete Scheme">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '92%' }}>
            <div className="modal-header">
              <h3>{editScheme ? 'Edit Loan Scheme' : 'Create New Loan Scheme'}</h3>
              <button className="modal-close" onClick={() => !saving && setShowModal(false)} disabled={saving}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.06)', 
                border: '1px solid rgba(59, 130, 246, 0.2)', 
                padding: '12px 14px', 
                borderRadius: 8, 
                marginBottom: 18, 
                fontSize: 13, 
                lineHeight: 1.5,
                color: 'var(--text-muted)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--primary-600)', marginBottom: 4 }}>
                  <Shield size={16} /> Compliance & Nomenclature Protection
                </div>
                You can assign customized commercial scheme names. The software engine operates strictly according to the selected calculation logic.
              </div>

              <div className="form-group">
                <label className="form-label">Scheme / Plan Name *</label>
                <input 
                  required 
                  className="form-input" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  placeholder="e.g. Daily Collection 2% or Festive Gold Scheme" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Calculation Engine Model *</label>
                <select 
                  className="form-select" 
                  value={form.calculationMethod} 
                  onChange={e => setForm({...form, calculationMethod: e.target.value})}
                >
                  <option value="METHOD_1_FIXED">Method 1: Fixed Rate (Standard Flat Model)</option>
                  <option value="METHOD_2_REDUCING">Method 2: Amortized (Diminishing EMI Model)</option>
                  <option value="METHOD_3_PRINCIPAL_ONLY">Method 3: Principal Recovery Only (0% Interest)</option>
                </select>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {form.calculationMethod === 'METHOD_1_FIXED' && 'Fixed Interest calculated across the full principal.'}
                    {form.calculationMethod === 'METHOD_2_REDUCING' && 'Amortized reducing balance where interest diminishes as principal is repaid.'}
                    {form.calculationMethod === 'METHOD_3_PRINCIPAL_ONLY' && 'Principal recovery schedule with upfront processing fee, without continuous interest.'}
                  </span>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Default Interest Rate (%)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="e.g. 2.0"
                    className="form-input" 
                    value={form.interestRate} 
                    onChange={e => setForm({...form, interestRate: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Processing Fee (%)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="e.g. 1.0"
                    className="form-input" 
                    value={form.processingFee} 
                    onChange={e => setForm({...form, processingFee: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Overdue Term Label</label>
                  <input 
                    className="form-input" 
                    value={form.penaltyName} 
                    onChange={e => setForm({...form, penaltyName: e.target.value})} 
                    placeholder="e.g. Late Fee / Overdue Charge" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Late Fee (%)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="e.g. 0.0"
                    className="form-input" 
                    value={form.penaltyRate} 
                    onChange={e => setForm({...form, penaltyRate: e.target.value})} 
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <CheckCircle size={18} /> {saving ? 'Saving...' : 'Save Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
