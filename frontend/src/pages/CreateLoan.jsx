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
    interestType: 'FLAT', tenure: '10', advanceDeduction: '',
    tenureUnit: 'WEEKS', startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    customersAPI.list({ limit: 200 }).then(r => setCustomers(r)).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = (() => {
    const isWithoutInterest = form.interestType === 'WITHOUT_INTEREST';
    const isEMI = form.interestType === 'EMI';
    const p = parseFloat(form.principalAmount);
    if (!p) return null;

    if (isWithoutInterest) {
      const deduction = parseFloat(form.advanceDeduction || 0);
      const tenureVal = parseInt(form.tenure || 10);
      const disbursed = p - deduction;
      const due = tenureVal > 0 ? (p / tenureVal) : 0;
      const isDaily = form.tenureUnit === 'DAYS';
      return {
        isWithoutInterest: true,
        disbursed: disbursed,
        due: due,
        tenure: tenureVal,
        totalRepayable: p,
        unitLabel: isDaily ? 'daily' : 'weekly',
        unitLabelPlural: isDaily ? 'days' : 'weeks'
      };
    } else if (form.interestType === 'FIXED_FLAT') {
      const r_flat = parseFloat(form.interestRate);
      const tenureVal = parseInt(form.tenure || 12);
      if (isNaN(r_flat)) return null;
      
      const totalInterest = p * (r_flat / 100);
      const totalPayable = p + totalInterest;
      const installmentDue = tenureVal > 0 ? totalPayable / tenureVal : 0;
      
      return {
        isFixedFlat: true,
        installmentDue: installmentDue,
        totalPayable: totalPayable,
        totalInterest: totalInterest,
        tenure: tenureVal,
        unitLabel: form.tenureUnit === 'MONTHS' ? 'monthly' : form.tenureUnit === 'WEEKS' ? 'weekly' : 'daily',
        unitLabelPlural: form.tenureUnit.toLowerCase()
      };
    } else {
      const r = parseFloat(form.interestRate);
      if (!r) return null;
      return {
        isWithoutInterest: false,
        isEMI: false,
        interest: (p * r / 100).toFixed(0),
        period: form.tenureUnit === 'MONTHS' ? 'month' : form.tenureUnit === 'WEEKS' ? 'week' : 'day'
      };
    }
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isWithoutInterest = form.interestType === 'WITHOUT_INTEREST';
      const isFixedFlat = form.interestType === 'FIXED_FLAT';
      const principal = parseFloat(form.principalAmount);
      const fee = isWithoutInterest ? parseFloat(form.advanceDeduction || 0) : 0;
      const rate = isWithoutInterest ? 0 : parseFloat(form.interestRate);
      const tenureVal = (isWithoutInterest || isFixedFlat) ? parseInt(form.tenure) : (form.tenureUnit === 'WEEKS' ? 52 : form.tenureUnit === 'MONTHS' ? 12 : 365);

      const res = await loansAPI.create({
        ...form,
        principalAmount: principal,
        interestRate: rate,
        processingFee: fee,
        tenure: tenureVal,
        tenureUnit: form.tenureUnit,
      });
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
            <label className="form-label">Loan Type *</label>
            <select className="form-select" value={form.interestType} onChange={e => {
              const val = e.target.value;
              setForm(f => {
                const next = { ...f, interestType: val };
                if (val === 'WITHOUT_INTEREST' && f.tenureUnit === 'MONTHS') {
                  next.tenureUnit = 'WEEKS';
                }
                if (val === 'FIXED_FLAT' && f.tenureUnit === 'DAYS') {
                  next.tenureUnit = 'MONTHS';
                }
                return next;
              });
            }}>
              <option value="FLAT">Regular Flat Interest</option>
              <option value="WITHOUT_INTEREST">Deduction Based (Without Interest)</option>
              <option value="FIXED_FLAT">Fixed Interest with Reducing Principal</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Loan Amount (₹) *</label>
            <input className="form-input" type="number" min="1" placeholder="e.g. 50000" value={form.principalAmount} onChange={e => set('principalAmount', e.target.value)} required />
          </div>

          {form.interestType === 'WITHOUT_INTEREST' ? (
            <>
              <div className="form-group">
                <label className="form-label">Advance Deduction (₹) *</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 2000" value={form.advanceDeduction} onChange={e => set('advanceDeduction', e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Collection Frequency *</label>
                <select className="form-select" value={form.tenureUnit} onChange={e => set('tenureUnit', e.target.value)}>
                  <option value="WEEKS">Weekly</option>
                  <option value="DAYS">Daily</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{form.tenureUnit === 'DAYS' ? 'Number of Days *' : 'Number of Weeks *'}</label>
                <input className="form-input" type="number" min="1" placeholder={form.tenureUnit === 'DAYS' ? 'e.g. 100' : 'e.g. 10'} value={form.tenure} onChange={e => set('tenure', e.target.value)} required />
              </div>
            </>
          ) : form.interestType === 'FIXED_FLAT' ? (
            <>
              <div className="form-group">
                <label className="form-label">Interest Rate (% flat total) *</label>
                <input className="form-input" type="number" step="0.1" min="0" placeholder="e.g. 10" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Collection Frequency *</label>
                <select className="form-select" value={form.tenureUnit} onChange={e => set('tenureUnit', e.target.value)}>
                  <option value="MONTHS">Monthly</option>
                  <option value="WEEKS">Weekly</option>
                  <option value="DAYS">Daily</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Number of {form.tenureUnit.charAt(0) + form.tenureUnit.slice(1).toLowerCase()} *</label>
                <input className="form-input" type="number" min="1" placeholder={form.tenureUnit === 'MONTHS' ? 'e.g. 12' : 'e.g. 52'} value={form.tenure} onChange={e => set('tenure', e.target.value)} required />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Start Date *</label>
            <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          preview.isWithoutInterest ? (
            <div className="card" style={{ marginTop: 12, background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>DISBURSED AMOUNT</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-400)' }}>₹{preview.disbursed.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{preview.unitLabel.toUpperCase()} DUE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning-400)' }}>₹{Math.round(preview.due).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                Customer repays total **₹{preview.totalRepayable.toLocaleString('en-IN')}** over **{preview.tenure} {preview.unitLabelPlural}**
              </div>
            </div>
          ) : preview.isFixedFlat ? (
            <div className="card" style={{ marginTop: 12, background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{preview.unitLabel.toUpperCase()} DUE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-400)' }}>₹{Math.round(preview.installmentDue).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>FIXED TOTAL INTEREST</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning-400)' }}>₹{Math.round(preview.totalInterest).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                Customer repays total **₹{Math.round(preview.totalPayable).toLocaleString('en-IN')}** over **{preview.tenure} {preview.unitLabelPlural}**
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 12, background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>INTEREST PER {preview.period.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary-400)' }}>₹{parseInt(preview.interest).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Continuous loan · Principal paid separately to close</div>
            </div>
          )
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
