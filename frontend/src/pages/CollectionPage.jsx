import { useState, useEffect } from 'react';
import { repaymentsAPI, paymentsAPI } from '../services/api';
import { getDb } from '../services/db';
import toast from 'react-hot-toast';
import { HandCoins, CheckCircle, AlertTriangle, Clock, X, Phone } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

export default function CollectionPage() {
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'CASH', reference: '' });
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await getDb();
      const data = tab === 'today'
        ? await repaymentsAPI.today()
        : await repaymentsAPI.list({ status: tab === 'overdue' ? 'OVERDUE' : tab === 'pending' ? 'PENDING' : undefined, limit: 100 });
      setRepayments(data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

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

  const openPay = (r) => {
    setPayModal(r);
    setPayForm({ amount: String(r.dueAmount - r.paidAmount), paymentMode: 'CASH', reference: '' });
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Collections</div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['today', "Today"], ['overdue', 'Overdue'], ['pending', 'Upcoming'], ['all', 'All']].map(([val, label]) => (
          <button key={val} className={`tab ${tab === val ? 'active' : ''}`} onClick={() => setTab(val)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : repayments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <CheckCircle size={40} style={{ color: 'var(--accent-400)', opacity: 0.5, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>All clear!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections {tab === 'today' ? 'for today' : 'found'}</div>
        </div>
      ) : (
        repayments.map((r) => (
          <div key={r.id} className="collection-card">
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
                  ₹{(r.dueAmount - r.paidAmount).toLocaleString('en-IN')}
                </div>
                {r.loan?.customer?.phone && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Phone size={10} />{r.loan.customer.phone}
                  </div>
                )}
              </div>
              {r.status !== 'PAID' && (
                <button className="btn btn-success" style={{ minWidth: 90 }} onClick={() => openPay(r)}>
                  <HandCoins size={15} /> Collect
                </button>
              )}
            </div>
          </div>
        ))
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
                <div className="form-group">
                  <label className="form-label">Reference (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID" value={payForm.reference}
                    onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paying}>
                  {paying ? 'Processing...' : `Collect ₹${payForm.amount || '0'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
