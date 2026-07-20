import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loansAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Eye, Landmark, Search, ChevronDown } from 'lucide-react';

const fmtAmt = (v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v?.toLocaleString('en-IN')}`;

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    loansAPI.list({ status: filter || undefined, search: debouncedSearch || undefined, tenureUnit: tenureFilter || undefined, limit: 100 })
      .then(r => setLoans(r))
      .catch(() => toast.error('Failed to load loans'))
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch, tenureFilter]);

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Loans <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>({loans.length})</span></div>
        <Link to="/loans/create" className="btn btn-primary btn-sm"><Plus size={15} /> New</Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <div className="search-bar" style={{ flex: 1, margin: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input placeholder="Search name, phone, loan ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        
        {/* Tenure Filter */}
        <div style={{ position: 'relative' }}>
          <select 
            style={{ 
              height: '42px', 
              padding: '0 36px 0 16px', 
              borderRadius: '12px', 
              border: '1px solid var(--border-subtle)', 
              background: 'var(--bg-card)', 
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              minWidth: '130px'
            }} 
            value={tenureFilter} 
            onChange={e => setTenureFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="DAYS">Daily Loans</option>
            <option value="WEEKS">Weekly Loans</option>
            <option value="MONTHS">Monthly Loans</option>
          </select>
          <ChevronDown 
            size={16} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {[['ACTIVE', 'Active'], ['', 'All'], ['CLOSED', 'Closed'], ['DEFAULTED', 'Defaulted']].map(([val, label]) => (
          <button key={val} className={`tab ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : loans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
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
                    <div style={{ fontSize: 10, color: 'var(--accent-600)', marginTop: 2 }}>
                      Disbursed: {fmtAmt(loan.principalAmount - (loan.processingFee || 0))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loan.interestType === 'WITHOUT_INTEREST' ? (loan.tenureUnit === 'DAYS' ? 'DAILY DUE' : 'WEEKLY DUE') : 'INTEREST/PERIOD'}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-600)' }}>₹{loan.installmentAmount?.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>OUTSTANDING</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: outstanding > 0 ? 'var(--warning-600)' : 'var(--accent-600)' }}>{fmtAmt(outstanding)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
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
