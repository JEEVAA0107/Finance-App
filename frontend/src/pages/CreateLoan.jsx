import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loansAPI, customersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Landmark } from 'lucide-react';

export default function CreateLoan() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: '', principalAmount: '', interestRate: '',
    tenureUnit: 'WEEKS', startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    customersAPI.list({ limit: 200 }).then(r => setCustomers(r)).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = (() => {
    const p = parseFloat(form.principalAmount);
    const r = parseFloat(form.interestRate);
    if (!p || !r) return null;
    return { interest: (p * r / 100).toFixed(0), period: form.tenureUnit === 'MONTHS' ? 'month' : form.tenureUnit === 'WEEKS' ? 'week' : 'day' };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loansAPI.create({ ...form, principalAmount: parseFloat(form.principalAmount), interestRate: parseFloat(form.interestRate), interestType: 'FLAT', processingFee: 0 });
      toast.success(`Loan ${res.loanNumber} created!`);
      navigate(`/loans/${res.id}`);
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="animate-in">
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>New Loan</div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select className="form-select" value={form.customerId} onChange={e => set('customerId', e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Principal Amount (₹) *</label>
            <input className="form-input" type="number" min="1" placeholder="e.g. 50000" value={form.principalAmount} onChange={e => set('principalAmount', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Interest Rate (% per period) *</label>
            <input className="form-input" type="number" step="0.1" min="0" placeholder="e.g. 3" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Collection Frequency *</label>
            <select className="form-select" value={form.tenureUnit} onChange={e => set('tenureUnit', e.target.value)}>
              <option value="WEEKS">Weekly</option>
              <option value="MONTHS">Monthly</option>
              <option value="DAYS">Daily</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Start Date *</label>
            <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="card" style={{ marginTop: 12, background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>INTEREST PER {preview.period.toUpperCase()}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary-400)' }}>₹{parseInt(preview.interest).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Continuous loan · Principal paid separately to close</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/loans')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Landmark size={16} /> {loading ? 'Creating...' : 'Create Loan'}
          </button>
        </div>
      </form>
    </div>
  );
}
