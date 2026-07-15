import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loansAPI, paymentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, HandCoins, X, Banknote } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'CASH', reference: '' });
  const [paying, setPaying] = useState(false);
  const [principalModal, setPrincipalModal] = useState(false);
  const [principalForm, setPrincipalForm] = useState({ amount: '', paymentMode: 'CASH' });
  const [payingPrincipal, setPayingPrincipal] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = () => {
    setLoading(true);
    loansAPI.get(id).then(r => setLoan(r)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await paymentsAPI.collect({ repaymentId: payModal.id, ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('✓ Payment collected!');
      setPayModal(null);
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setPaying(false); }
  };

  const handlePrincipalPay = async (e) => {
    e.preventDefault();
    setPayingPrincipal(true);
    try {
      const res = await paymentsAPI.collectPrincipal({ loanId: id, ...principalForm, amount: parseFloat(principalForm.amount) });
      toast.success(res.loanStatus === 'CLOSED' ? '✓ Loan CLOSED!' : `✓ Principal paid! Remaining: ₹${res.outstandingPrincipal?.toLocaleString('en-IN')}`);
      setPrincipalModal(false);
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setPayingPrincipal(false); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!loan) return <div className="card" style={{ textAlign: 'center', padding: 32 }}>Loan not found</div>;

  const outstanding = loan.outstandingPrincipal ?? loan.principalAmount;
  const isWithoutInt = loan.interestType === 'WITHOUT_INTEREST';
  const paidCount = loan.repayments?.filter(r => r.status === 'PAID').length || 0;
  const totalCount = loan.repayments?.length || 1;
  const progress = Math.round((paidCount / totalCount) * 100);

  // Show unpaid first, then recent paid — limit to 20 unless showAll
  const unpaid = loan.repayments?.filter(r => r.status !== 'PAID') || [];
  const paid = loan.repayments?.filter(r => r.status === 'PAID').slice(-5) || [];
  const displayList = showAll ? loan.repayments : [...unpaid, ...paid].slice(0, 20);

  return (
    <div className="animate-in">
      {/* Back */}
      <Link to="/loans" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, marginBottom: 14, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Loans
      </Link>

      {/* Loan summary card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{loan.loanNumber}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loan.customer?.name} · {loan.tenureUnit === 'WEEKS' ? 'Weekly' : loan.tenureUnit === 'MONTHS' ? 'Monthly' : 'Daily'}</div>
          </div>
          <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-success' : loan.status === 'CLOSED' ? 'badge-info' : 'badge-danger'}`}>{loan.status}</span>
        </div>

        {/* Key numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isWithoutInt ? 'Total Payable' : 'Principal'}</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>₹{(loan.principalAmount / 1000).toFixed(0)}K</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isWithoutInt ? 'Weekly Due' : 'Per Period'}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent-400)' }}>₹{loan.installmentAmount?.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: outstanding > 0 ? 'var(--warning-400)' : 'var(--accent-400)' }}>₹{(outstanding / 1000).toFixed(0)}K</div>
          </div>
        </div>

        {/* Interest collected or WITHOUT_INTEREST details */}
        {isWithoutInt ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Disbursed Amount</span>
              <span style={{ fontWeight: 700 }}>₹{(loan.principalAmount - (loan.processingFee || 0)).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Advance Deduction</span>
              <span style={{ fontWeight: 700, color: 'var(--danger-400)' }}>₹{(loan.processingFee || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Paid So Far</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-400)' }}>₹{(loan.principalAmount - outstanding).toLocaleString('en-IN')}</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>Interest Collected</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-400)' }}>₹{(loan.interestCollected || 0).toLocaleString('en-IN')}</span>
          </div>
        )}

        {/* Progress */}
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary-500)', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{paidCount}/{totalCount} paid</div>

        {/* Pay Principal button */}
        {loan.status === 'ACTIVE' && outstanding > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12, borderColor: 'rgba(245,158,11,0.3)', color: 'var(--warning-400)' }}
            onClick={() => { setPrincipalModal(true); setPrincipalForm({ amount: String(outstanding), paymentMode: 'CASH' }); }}>
            <Banknote size={15} /> Pay Principal ₹{outstanding.toLocaleString('en-IN')}
          </button>
        )}
      </div>

      {/* Installments */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Installments</div>
          <span className="badge badge-muted">{unpaid.length} pending</span>
        </div>

        {displayList.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.status === 'PAID' ? 'rgba(16,185,129,0.15)' : r.status === 'OVERDUE' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)' }}>
                {r.status === 'PAID' ? <CheckCircle size={14} style={{ color: 'var(--accent-400)' }} /> : r.status === 'OVERDUE' ? <AlertTriangle size={14} style={{ color: 'var(--danger-400)' }} /> : <Clock size={14} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>#{r.installmentNo} · {fmtShort(r.dueDate)}</div>
                {r.paidAmount > 0 && r.status !== 'PAID' && <div style={{ fontSize: 11, color: 'var(--accent-400)' }}>Partial: ₹{r.paidAmount?.toLocaleString('en-IN')}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>₹{r.dueAmount?.toLocaleString('en-IN')}</div>
              </div>
              {r.status !== 'PAID' && loan.status !== 'CLOSED' && (
                <button className="btn btn-success btn-sm" style={{ padding: '6px 10px' }}
                  onClick={() => { setPayModal(r); setPayForm({ amount: String(r.dueAmount - r.paidAmount), paymentMode: 'CASH', reference: '' }); }}>
                  <HandCoins size={13} />
                </button>
              )}
            </div>
          </div>
        ))}

        {!showAll && loan.repayments?.length > 20 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setShowAll(true)}>
            Show all {loan.repayments.length} installments
          </button>
        )}
      </div>

      {/* Interest payment modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700 }}>{isWithoutInt ? 'Collect Installment' : 'Collect Interest'} #{payModal.installmentNo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loan.customer?.name} · {fmtDate(payModal.dueDate)}</div>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePay}>
              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>DUE</div><div style={{ fontWeight: 700 }}>₹{payModal.dueAmount?.toLocaleString('en-IN')}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PAID</div><div style={{ fontWeight: 700, color: 'var(--accent-400)' }}>₹{payModal.paidAmount?.toLocaleString('en-IN')}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BALANCE</div><div style={{ fontWeight: 700, color: 'var(--warning-400)' }}>₹{(payModal.dueAmount - payModal.paidAmount)?.toLocaleString('en-IN')}</div></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paying}>{paying ? 'Processing...' : `Collect ₹${payForm.amount || '0'}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Principal payment modal */}
      {principalModal && (
        <div className="modal-overlay" onClick={() => setPrincipalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700 }}>Pay Principal</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Outstanding: ₹{outstanding?.toLocaleString('en-IN')}</div>
              </div>
              <button className="modal-close" onClick={() => setPrincipalModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePrincipalPay}>
              <div className="modal-body">
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', marginBottom: 14, fontSize: 12, color: 'var(--warning-400)' }}>
                  ⚠️ Full payment will CLOSE the loan automatically.
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" step="0.01" max={outstanding} value={principalForm.amount} onChange={e => setPrincipalForm({ ...principalForm, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={principalForm.paymentMode} onChange={e => setPrincipalForm({ ...principalForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPrincipalModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg,var(--warning-500),var(--warning-600))' }} disabled={payingPrincipal}>
                  {payingPrincipal ? 'Processing...' : `Pay ₹${principalForm.amount || '0'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
