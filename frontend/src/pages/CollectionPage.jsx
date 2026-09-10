import { useState, useEffect } from 'react';
import { repaymentsAPI, paymentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HandCoins, CheckCircle, AlertTriangle, Clock, X, Phone, Lock, Route } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

export default function CollectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'today';
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const currentTabParam = searchParams.get('tab');
    if (currentTabParam && currentTabParam !== tab) {
      setTab(currentTabParam);
    }
  }, [searchParams]);

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'CASH', reference: '', penaltyAmount: '' });
  const [paying, setPaying] = useState(false);
  const [penaltyModal, setPenaltyModal] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({ amount: '100', paymentMode: 'CASH', reference: '', notes: '' });
  const [payingPenalty, setPayingPenalty] = useState(false);
  const [search, setSearch] = useState('');
  const [loanType, setLoanType] = useState('ALL');

  // Group repayments by loanId to detect blocked installments
  // An installment is blocked ONLY if an earlier installment is NOT PAID and NOT CARRIED_FORWARD
  const getBlockedMap = (list) => {
    const lowestUnpaid = {};
    list.forEach(r => {
      if (r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD') {
        if (lowestUnpaid[r.loan?.id] === undefined || r.installmentNo < lowestUnpaid[r.loan?.id]) {
          lowestUnpaid[r.loan?.id] = r.installmentNo;
        }
      }
    });
    const blocked = {};
    list.forEach(r => {
      const loanId = r.loan?.id;
      if (r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD' && lowestUnpaid[loanId] !== undefined && r.installmentNo > lowestUnpaid[loanId]) {
        blocked[r.id] = lowestUnpaid[loanId];
      }
    });
    return blocked;
  };

  const filteredRepayments = repayments.filter(r => {
    if (loanType !== 'ALL' && r.loan?.interestType !== loanType) return false;
    if (search && !r.loan?.customer?.name?.toLowerCase().includes(search.toLowerCase()) && !r.loan?.loanNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const blockedMap = getBlockedMap(repayments);

  const load = async () => {
    setLoading(true);
    try {
      const data = tab === 'today'
        ? await repaymentsAPI.today()
        : await repaymentsAPI.list({ status: 'OVERDUE', limit: 100 });
      setRepayments(data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await paymentsAPI.collect({ 
        repaymentId: payModal.id, 
        ...payForm, 
        amount: parseFloat(payForm.amount),
        penaltyAmount: parseFloat(payForm.penaltyAmount) || 0
      });
      toast.success('✓ Payment collected!');
      setPayModal(null);
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setPaying(false); }
  };

  const handleOpenPenaltyModal = (r) => {
    setPenaltyModal(r);
    setPenaltyForm({
      amount: String(r.penaltyAmount > 0 ? r.penaltyAmount : 100),
      paymentMode: 'CASH',
      reference: '',
      notes: ''
    });
  };

  const handlePayPenalty = async (e) => {
    e.preventDefault();
    setPayingPenalty(true);
    try {
      const res = await paymentsAPI.collectPenalty({
        repaymentId: penaltyModal.id,
        amount: parseFloat(penaltyForm.amount),
        paymentMode: penaltyForm.paymentMode,
        reference: penaltyForm.reference,
        notes: penaltyForm.notes,
      });
      toast.success(res.message || '✓ Penalty collected & Carried forward!');
      setPenaltyModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to collect penalty');
    } finally {
      setPayingPenalty(false);
    }
  };

  const openPay = (r) => {
    setPayModal(r);
    setPayForm({
      amount: String(r.dueAmount - r.paidAmount),
      paymentMode: 'CASH',
      reference: '',
      penaltyAmount: r.status === 'OVERDUE' ? String(r.penaltyAmount || 100) : ''
    });
  };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Collections</div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ gap: 6, fontSize: 12, borderColor: 'rgba(99,102,241,0.3)', color: 'var(--primary-400)' }}
          onClick={() => navigate('/collection-route')}
        >
          <Route size={14} /> Route Map
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['today', "Today"], ['overdue', 'Overdue']].map(([val, label]) => (
          <button key={val} className={`tab ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
        ))}
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <input 
          type="text" 
          placeholder="Search by name or loan number..." 
          className="form-input" 
          style={{ flex: 1 }}
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <select 
          className="form-select" 
          style={{ width: 'auto' }}
          value={loanType} 
          onChange={e => setLoanType(e.target.value)}
        >
          <option value="ALL">All Loan Types</option>
          <option value="FLAT">Regular Flat Interest (வட்டி கடன்)</option>
          <option value="WITHOUT_INTEREST">Deduction Based (கந்து வட்டி)</option>
          <option value="EMI">EMI (அசலோடு தவணை)</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredRepayments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <CheckCircle size={40} style={{ color: 'var(--accent-400)', opacity: 0.5, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>All clear!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections {tab === 'today' ? 'for today' : 'found'}</div>
        </div>
      ) : (
        filteredRepayments.map((r) => {
          const isBlocked = !!blockedMap[r.id];
          const blockingInstNo = blockedMap[r.id];
          return (
            <div
              key={r.id}
              className="collection-card"
              style={isBlocked ? { opacity: 0.6, background: 'var(--bg-glass, rgba(0,0,0,0.03))', border: '1.5px solid var(--border-subtle)' } : {}}
            >
              {/* Blocked banner */}
              {isBlocked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(244,63,94,0.07)',
                  border: '1px solid rgba(244,63,94,0.18)',
                  borderRadius: 8, padding: '6px 10px', marginBottom: 10,
                  fontSize: 11, color: '#e11d48', fontWeight: 600,
                }}>
                  <Lock size={11} />
                  முதலில் Installment #{blockingInstNo} collect செய்யுங்கள்
                </div>
              )}

              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                    {r.loan?.customer?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.loan?.customer?.name || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.loan?.loanNumber} · #{r.installmentNo}</div>
                  </div>
                </div>
                <span className={`badge ${r.status === 'PAID' ? 'badge-success' : r.status === 'OVERDUE' ? 'badge-danger' : r.status === 'PARTIAL' ? 'badge-warning' : 'badge-muted'}`}>
                  {r.status === 'PAID' ? <CheckCircle size={9} /> : r.status === 'OVERDUE' ? <AlertTriangle size={9} /> : <Clock size={9} />}
                  {r.status}
                </span>
              </div>

              {/* Amount row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due {fmtDate(r.dueDate)}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: r.status === 'PAID' ? 'var(--accent-400)' : 'var(--text-primary)' }}>
                    {r.status === 'PAID' || (r.dueAmount - r.paidAmount) <= 0 ? (
                      <span style={{ color: 'var(--success-500)' }}>₹{r.paidAmount.toLocaleString('en-IN')} <span style={{ fontSize: 12, fontWeight: 600 }}>Collected</span></span>
                    ) : (
                      `₹${(r.dueAmount - r.paidAmount).toLocaleString('en-IN')}`
                    )}
                  </div>
                  {r.loan?.customer?.phone && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Phone size={10} /><a href={`tel:${r.loan.customer.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.loan.customer.phone}</a>
                    </div>
                  )}
                </div>
                {r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD' && (
                  isBlocked ? (
                    // Locked button — cannot collect out of order
                    <button
                      className="btn btn-ghost"
                      style={{ minWidth: 90, cursor: 'not-allowed', opacity: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}
                      disabled
                      title={`முதலில் Installment #${blockingInstNo} collect செய்யுங்கள்`}
                    >
                      <Lock size={14} /> Locked
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="btn btn-success btn-sm" style={{ minWidth: 80 }} onClick={() => openPay(r)}>
                        <HandCoins size={14} /> Collect
                      </button>
                      {r.status === 'OVERDUE' && (
                        <button
                          type="button"
                          className="btn btn-warning btn-sm"
                          style={{
                            minWidth: 80,
                            background: 'rgba(245,158,11,0.15)',
                            color: '#d97706',
                            border: '1px solid rgba(245,158,11,0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Pay Penalty Only & Carry Forward"
                          onClick={() => handleOpenPenaltyModal(r)}
                        >
                          <Clock size={13} /> Carry Fwd
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{payModal.loan?.customer?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{payModal.loan?.loanNumber} · #{payModal.installmentNo}</div>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePay}>
              <div className="modal-body">
                {/* Balance summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Due</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>₹{payModal.dueAmount?.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-400)' }}>₹{payModal.paidAmount?.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning-400)' }}>₹{(payModal.dueAmount - payModal.paidAmount)?.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" step="0.01" value={payForm.amount}
                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                </div>
                {payModal.status === 'OVERDUE' && (
                  <div className="form-group">
                    <label className="form-label">Interest for Overdue (₹) - optional</label>
                    <input className="form-input" type="number" min="0" placeholder="e.g. 100" value={payForm.penaltyAmount}
                      onChange={e => setPayForm({ ...payForm, penaltyAmount: e.target.value })} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={payForm.paymentMode}
                    onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID" value={payForm.reference}
                    onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paying}>
                  {paying ? 'Processing...' : `Collect ₹${(parseFloat(payForm.amount || 0) + parseFloat(payForm.penaltyAmount || 0)).toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Penalty Only / Carry-Forward Modal */}
      {penaltyModal && (
        <div className="modal-overlay" onClick={() => setPenaltyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Pay Penalty & Carry Forward</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {penaltyModal.loan?.customer?.name} · {penaltyModal.loan?.loanNumber} #{penaltyModal.installmentNo}
                </div>
              </div>
              <button className="modal-close" onClick={() => setPenaltyModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePayPenalty}>
              <div className="modal-body">
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#6d28d9',
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> Penalty Carry-Forward System
                  </div>
                  <div>
                    Collecting penalty <b>₹{penaltyForm.amount}</b> marks this installment as <b>CARRIED FORWARD</b> and pushes the unpaid balance of <b>₹{(penaltyModal.dueAmount - penaltyModal.paidAmount).toLocaleString('en-IN')}</b> to a newly appended installment at the end of the loan schedule.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Penalty Amount (₹) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={penaltyForm.amount}
                    onChange={e => setPenaltyForm({ ...penaltyForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={penaltyForm.paymentMode}
                    onChange={e => setPenaltyForm({ ...penaltyForm, paymentMode: e.target.value })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference / Notes (optional)</label>
                  <input
                    className="form-input"
                    placeholder="UPI Ref ID or reason"
                    value={penaltyForm.notes}
                    onChange={e => setPenaltyForm({ ...penaltyForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPenaltyModal(null)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                  disabled={payingPenalty}
                >
                  {payingPenalty ? 'Processing...' : `Collect ₹${penaltyForm.amount} & Carry Forward`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
