import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import { Landmark, Users, HandCoins, AlertTriangle, CheckCircle, Plus, TrendingUp, IndianRupee, Cloud, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fullSync, getLastSync, getScriptUrl } from '../services/sheetsSync';
import toast from 'react-hot-toast';

function fmt(val) {
  if (!val) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(getLastSync());
  const scriptUrl = getScriptUrl();

  const handleManualSync = async () => {
    if (!scriptUrl) {
      toast.error('Google Sheets Script URL not set. Please go to Settings to configure.');
      return;
    }
    setSyncing(true);
    try {
      const payload = await fullSync();
      setLastSync(getLastSync());
      toast.success('Successfully synced to Google Sheets!');
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    Promise.all([dashboardAPI.summary(), dashboardAPI.agent()])
      .then(([s, a]) => setData({ summary: s, agent: a }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  const s = data?.summary;
  const a = data?.agent;

  return (
    <div className="animate-in">
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Hi, {user?.name?.split(' ')[0]} 👋</div>
        <div className="color-muted" style={{ fontSize: 13 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>

      {/* Overdue alert */}
      {s?.financials?.overdueCount > 0 && (
        <Link to="/reports" style={{ textDecoration: 'none' }}>
          <div className="alert-card" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger-400)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger-400)' }}>{s.financials.overdueCount} Overdue Payments</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(s.financials.overdueAmount)} pending → Tap to view</div>
            </div>
          </div>
        </Link>
      )}

      {/* Key stats - 2x2 grid */}
      {s && (
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="stat-card blue">
            <div className="stat-icon blue"><Landmark size={18} /></div>
            <div className="stat-value">{s.loans.active}</div>
            <div className="stat-label">Active Loans</div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><IndianRupee size={18} /></div>
            <div className="stat-value">{fmt(s.financials.monthlyCollected)}</div>
            <div className="stat-label">This Month</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple"><TrendingUp size={18} /></div>
            <div className="stat-value">{fmt(s.financials.totalInterest)}</div>
            <div className="stat-label">Total Profit</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-icon yellow"><Users size={18} /></div>
            <div className="stat-value">{s.customers}</div>
            <div className="stat-label">Customers</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <Link to="/loans/create" className="btn btn-primary" style={{ justifyContent: 'center' }}>
          <Plus size={16} /> New Loan
        </Link>
        <Link to="/collections" className="btn btn-success" style={{ justifyContent: 'center' }}>
          <HandCoins size={16} /> Collect
        </Link>
        <Link to="/customers" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
          <Users size={16} /> Customers
        </Link>
        <Link to="/loans" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
          <Landmark size={16} /> Loans
        </Link>
      </div>

      {/* Google Sheets Sync Card */}
      <div className="card text-card" style={{ marginBottom: 16, background: 'var(--bg-glass)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', background: scriptUrl ? 'rgba(52,168,83,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 8 }}>
              <Cloud size={20} style={{ color: scriptUrl ? '#34a853' : 'var(--text-muted)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Google Sheets Connection</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {scriptUrl ? (lastSync ? `Last synced: ${lastSync}` : 'Connected (Not synced)') : 'Not configured (go to Settings)'}
              </div>
            </div>
          </div>
          {scriptUrl && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleManualSync} 
              disabled={syncing}
              style={{ padding: '6px 12px', borderRadius: 8, height: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(255,255,255,0.03)' }}
            >
              <RefreshCw size={12} className={syncing ? 'spin-icon' : ''} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {/* Today's due */}
      {a?.todayDue?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Today's Due</div>
            <span className="badge badge-warning">{a.todayDue.length}</span>
          </div>
          {a.todayDue.slice(0, 5).map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="sidebar-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{item.loan?.customer?.name?.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.loan?.customer?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.loan?.loanNumber}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: item.status === 'PAID' ? 'var(--accent-400)' : 'var(--warning-400)' }}>₹{item.dueAmount?.toLocaleString('en-IN')}</div>
                <span className={`badge ${item.status === 'PAID' ? 'badge-success' : item.status === 'OVERDUE' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 9 }}>{item.status}</span>
              </div>
            </div>
          ))}
          {a.todayDue.length > 5 && (
            <Link to="/collections" style={{ display: 'block', textAlign: 'center', padding: '10px 0', fontSize: 13, color: 'var(--primary-400)' }}>
              View all {a.todayDue.length} →
            </Link>
          )}
        </div>
      )}

      {a?.todayDue?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <CheckCircle size={36} style={{ color: 'var(--accent-400)', opacity: 0.6, marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>All clear today!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections due</div>
        </div>
      )}
    </div>
  );
}
