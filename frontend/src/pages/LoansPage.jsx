import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loansAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Eye, Landmark } from 'lucide-react';

const fmtAmt = (v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v?.toLocaleString('en-IN')}`;

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ACTIVE');

  useEffect(() => {
    setLoading(true);
    loansAPI.list({ status: filter || undefined, limit: 100 })
      .then(r => setLoans(r))
      .catch(() => toast.error('Failed to load loans'))
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Loans <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>({loans.length})</span></div>
        <Link to="/loans/create" className="btn btn-primary btn-sm"><Plus size={15} /> New</Link>
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {[['ACTIVE', 'Active'], ['', 'All'], ['CLOSED', 'Closed'], ['DEFAULTED', 'Defaulted']].map(([val, label]) => (
          <button key={val} className={`tab ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      {loans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Landmark size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>No loans found</div>
        </div>
      ) : (
        loans.map(loan => {
          const paid = loan.repayments?.filter(r => r.status === 'PAID').length || 0;
          const total = loan.repayments?.length || 1;
          const progress = Math.round((paid / total) * 100);
          const outstanding = loan.outstandingPrincipal ?? loan.principalAmount;
          return (
            <div key={loan.id} className="collection-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{loan.customer?.name?.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{loan.customer?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.loanNumber} · {loan.tenureUnit === 'WEEKS' ? 'Weekly' : loan.tenureUnit === 'MONTHS' ? 'Monthly' : 'Daily'}</div>
                  </div>
                </div>
                <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-success' : loan.status === 'CLOSED' ? 'badge-info' : 'badge-danger'}`}>{loan.status}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loan.interestType === 'WITHOUT_INTEREST' ? 'TOTAL REPAYABLE' : 'PRINCIPAL'}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtAmt(loan.principalAmount)}</div>
                  {loan.interestType === 'WITHOUT_INTEREST' && (
                    <div style={{ fontSize: 10, color: 'var(--accent-400)', marginTop: 2 }}>
                      Disbursed: {fmtAmt(loan.principalAmount - (loan.processingFee || 0))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loan.interestType === 'WITHOUT_INTEREST' ? 'WEEKLY DUE' : 'INTEREST/PERIOD'}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-400)' }}>₹{loan.installmentAmount?.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>OUTSTANDING</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: outstanding > 0 ? 'var(--warning-400)' : 'var(--accent-400)' }}>{fmtAmt(outstanding)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? 'var(--accent-500)' : 'var(--primary-500)', borderRadius: 2 }} />
              </div>

              <Link to={`/loans/${loan.id}`} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                <Eye size={13} /> View Details
              </Link>
            </div>
          );
        })
      )}
    </div>
  );
}
