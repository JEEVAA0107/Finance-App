import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loansAPI, customersAPI } from '../services/api';
import AddCustomerModal from '../components/AddCustomerModal';
import toast from 'react-hot-toast';
import { Landmark, UserPlus, User, ShieldCheck, Phone, CheckCircle2, Edit2 } from 'lucide-react';

export default function CreateLoan() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    customerId: '', principalAmount: '', interestRate: '',
    interestType: 'WITHOUT_INTEREST', tenure: '10', advanceDeduction: '', alreadyCollectedAmount: '',
    tenureUnit: 'WEEKS', repaymentFrequency: 'DAILY', startDate: new Date().toISOString().split('T')[0],
  });

  const loadCustomers = () => {
    customersAPI.list({ limit: 200 }).then(r => setCustomers(r)).catch(() => {});
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerCreated = (newCust) => {
    setCustomers(prev => {
      const exists = prev.some(c => c.id === newCust.id);
      return exists ? prev.map(c => c.id === newCust.id ? newCust : c) : [newCust, ...prev];
    });
    set('customerId', newCust.id);
    toast.success(`Selected customer: ${newCust.name}`);
  };

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  const preview = (() => {
    const isWithoutInterest = form.interestType === 'WITHOUT_INTEREST';
    const isEMI = form.interestType === 'EMI';
    const p = parseFloat(form.principalAmount);
    if (!p) return null;

    if (isWithoutInterest) {
      const deduction = parseFloat(form.advanceDeduction || 0);
      const weeksVal = parseInt(form.tenure || 10);
      const disbursed = p - deduction;
      const isDaily = form.repaymentFrequency === 'DAILY';
      const totalInstallments = isDaily ? (weeksVal * 7) : weeksVal;
      const due = totalInstallments > 0 ? (p / totalInstallments) : 0;
      return {
        isWithoutInterest: true,
        disbursed: disbursed,
        deduction: deduction,
        due: due,
        tenure: weeksVal,
        totalInstallments: totalInstallments,
        totalRepayable: p,
        isDaily: isDaily,
        unitLabel: isDaily ? 'daily' : 'weekly',
        unitLabelPlural: 'weeks',
        frequencyLabel: isDaily ? 'Daily (7 days/week)' : 'Weekly (1 payment/week)',
      };
    } else if (form.interestType === 'EMI') {
      const r = parseFloat(form.interestRate);
      const tenureVal = parseInt(form.tenure || 12);
      if (isNaN(r)) return null;
      
      const interestPerPeriod = p * (r / 100);
      const principalPerPeriod = tenureVal > 0 ? p / tenureVal : 0;
      const installmentDue = interestPerPeriod + principalPerPeriod;
      const totalInterest = interestPerPeriod * tenureVal;
      const totalPayable = p + totalInterest;
      
      return {
        isEMI: true,
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
      const isEMI = form.interestType === 'EMI';
      const principal = parseFloat(form.principalAmount);
      const fee = isWithoutInterest ? parseFloat(form.advanceDeduction || 0) : 0;
      const rate = isWithoutInterest ? 0 : parseFloat(form.interestRate || 0);
      const tenureVal = (isWithoutInterest || isEMI) ? parseInt(form.tenure) : (form.tenureUnit === 'WEEKS' ? 52 : form.tenureUnit === 'MONTHS' ? 12 : 365);

      const res = await loansAPI.create({
        ...form,
        principalAmount: principal,
        interestRate: rate,
        processingFee: fee,
        advanceDeduction: fee,
        repaymentFrequency: form.repaymentFrequency || (isWithoutInterest ? 'DAILY' : (form.tenureUnit === 'DAYS' ? 'DAILY' : form.tenureUnit === 'WEEKS' ? 'WEEKLY' : 'MONTHLY')),
        tenure: tenureVal,
        tenureUnit: form.tenureUnit,
        alreadyCollectedAmount: parseFloat(form.alreadyCollectedAmount || 0),
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>Customer *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {selectedCustomer && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setEditingCustomer(selectedCustomer); setShowAddCustomer(true); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#059669',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '4px 8px',
                      borderRadius: 8,
                    }}
                  >
                    <Edit2 size={13} /> Edit Details & Jamin
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditingCustomer(null); setShowAddCustomer(true); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--primary-600, #4f46e5)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}
                >
                  <UserPlus size={14} /> + New Customer
                </button>
              </div>
            </div>
            <select className="form-select" value={form.customerId} onChange={e => set('customerId', e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone} {c.jaminName ? `(Jamin: ${c.jaminName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Customer & Jamin preview card */}
          {selectedCustomer && (
            <div style={{
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedCustomer.photoUrl ? (
                    <img
                      src={selectedCustomer.photoUrl}
                      alt={selectedCustomer.name}
                      style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-400)' }}
                    />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {selectedCustomer.name?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCustomer.phone} · {selectedCustomer.city}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selectedCustomer.idProofUrl && (
                    <span className="badge badge-info" style={{ fontSize: 10 }}>ID Verified</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAddCustomer(true)}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Jamin summary row if present */}
              {selectedCustomer.jaminName ? (
                <div style={{
                  borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                  paddingTop: 8,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedCustomer.jaminPhotoUrl ? (
                      <img
                        src={selectedCustomer.jaminPhotoUrl}
                        alt={selectedCustomer.jaminName}
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #10b981' }}
                      />
                    ) : (
                      <ShieldCheck size={18} style={{ color: '#10b981' }} />
                    )}
                    <div>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Jamin: {selectedCustomer.jaminName}</span>
                      <span style={{ color: '#64748b', marginLeft: 6 }}>({selectedCustomer.jaminRelationship || 'Guarantor'})</span>
                    </div>
                  </div>
                  {selectedCustomer.jaminPhone && (
                    <span style={{ color: '#64748b' }}>{selectedCustomer.jaminPhone}</span>
                  )}
                </div>
              ) : (
                <div style={{ borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: 6, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⚠️ No Jamin (Guarantor) added yet for this customer.</span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Loan Type *</label>
            <select className="form-select" value={form.interestType} onChange={e => {
              const val = e.target.value;
              setForm(f => {
                const next = { ...f, interestType: val };
                if (val === 'EMI' && f.tenureUnit === 'DAYS') {
                  next.tenureUnit = 'MONTHS';
                }
                return next;
              });
            }}>
              <option value="FLAT">Regular Flat Interest (வட்டி கடன்)</option>
              <option value="WITHOUT_INTEREST">Deduction Based (கந்து வட்டி)</option>
              <option value="EMI">EMI (அசலோடு தவணை)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Loan Amount (₹) *</label>
            <input className="form-input" type="number" min="1" placeholder="e.g. 50000" value={form.principalAmount} onChange={e => set('principalAmount', e.target.value)} required />
          </div>

          {form.interestType === 'WITHOUT_INTEREST' ? (
            <>
              <div className="form-group">
                <label className="form-label">Initial Advance Deduction (₹) *</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 2000" value={form.advanceDeduction} onChange={e => set('advanceDeduction', e.target.value)} required />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount subtracted upfront before disbursing to the borrower</span>
              </div>

              <div className="form-group">
                <label className="form-label">Repayment Period (Weeks) *</label>
                <input className="form-input" type="number" min="1" placeholder="e.g. 10" value={form.tenure} onChange={e => set('tenure', e.target.value)} required />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total schedule length in weeks (e.g. 10 weeks)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Repayment Frequency *</label>
                <select className="form-select" value={form.repaymentFrequency} onChange={e => set('repaymentFrequency', e.target.value)}>
                  <option value="DAILY">Daily Repayment (7 days/week organized by Week 1 to 10)</option>
                  <option value="WEEKLY">Weekly Repayment (1 collection/week)</option>
                </select>
              </div>
            </>
          ) : form.interestType === 'EMI' ? (
            <>
              <div className="form-group">
                <label className="form-label">Interest Rate (% per period) *</label>
                <input className="form-input" type="number" step="0.1" min="0" placeholder="e.g. 3" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} required />
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Already Collected Amount (₹) [Optional]</label>
            <input className="form-input" type="number" min="0" placeholder="e.g. 2000" value={form.alreadyCollectedAmount} onChange={e => set('alreadyCollectedAmount', e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          preview.isWithoutInterest ? (
            <div className="card" style={{ marginTop: 12, background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>LOAN AMOUNT</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>₹{preview.totalRepayable.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#ef4444' }}>DEDUCTED UPFRONT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>- ₹{preview.deduction.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ACTUAL DISBURSED</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-400)' }}>₹{preview.disbursed.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{preview.frequencyLabel}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{preview.totalInstallments} installments across {preview.tenure} weeks</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PER {preview.unitLabel.toUpperCase()} DUE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>₹{Math.round(preview.due).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          ) : preview.isEMI ? (
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

      {/* Add / Edit Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        onClose={() => { setShowAddCustomer(false); setEditingCustomer(null); }}
        onSuccess={handleCustomerCreated}
        editCustomer={editingCustomer}
      />
    </div>
  );
}
