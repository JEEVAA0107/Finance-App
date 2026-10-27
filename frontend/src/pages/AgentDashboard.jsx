import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, paymentsAPI } from '../services/api';
import { 
  HandCoins, Users, Plus, TrendingUp, IndianRupee, 
  Calendar, CheckCircle2, Clock, RefreshCw, ArrowRight, 
  Phone, UserCheck, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function fmt(val) {
  if (!val && val !== 0) return '₹0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    collectedToday: { amount: 0, count: 0 },
    totalCollected: { amount: 0, count: 0 }
  });
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [agentStats, paymentsRes] = await Promise.all([
        dashboardAPI.agent(user?.id),
        paymentsAPI.list({ limit: 8 })
      ]);

      if (agentStats) {
        setStats({
          collectedToday: agentStats.collectedToday || { amount: 0, count: 0 },
          totalCollected: agentStats.totalCollected || { amount: 0, count: 0 }
        });
      }

      if (paymentsRes && Array.isArray(paymentsRes)) {
        setRecentPayments(paymentsRes);
      } else if (paymentsRes?.data && Array.isArray(paymentsRes.data)) {
        setRecentPayments(paymentsRes.data);
      }
    } catch (err) {
      console.error('Agent dashboard load error:', err);
      toast.error('Could not refresh dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh when a payment is logged elsewhere in the app
    const onPaymentRecorded = () => loadData(true);
    window.addEventListener('payment-recorded', onPaymentRecorded);
    return () => window.removeEventListener('payment-recorded', onPaymentRecorded);
  }, [user?.id]);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="animate-in" style={{ paddingBottom: 60 }}>
      {/* ─── Agent Welcome Banner ─────────────────────────────────── */}
      <div 
        className="card" 
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: 16,
          padding: '24px 20px',
          marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span 
                style={{
                  background: 'rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Shield size={12} /> Field Executive
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                {user?.company?.name || 'Finova Financials'}
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Welcome, {user?.name || 'Agent'} 👋
            </h1>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Here is your daily collection summary and field activity for today.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div 
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                background: 'rgba(255,255,255,0.08)',
                padding: '6px 12px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Calendar size={13} /> {todayStr}
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn btn-ghost btn-sm"
              style={{
                color: '#ffffff',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '6px 10px'
              }}
              title="Refresh Stats"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Link
            to="/collections"
            className="btn btn-primary"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              gap: 8,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
            }}
          >
            <HandCoins size={16} /> Start Daily Collections <ArrowRight size={14} />
          </Link>
          <Link
            to="/customers"
            className="btn"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              gap: 8,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.18)'
            }}
          >
            <Users size={15} /> Customer Directory
          </Link>
        </div>
      </div>

      {/* ─── 4 Primary Performance Stat Cards ───────────────────────── */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        {/* 1. Today's Collected Amount */}
        <div 
          className="card" 
          style={{
            padding: '18px',
            borderLeft: '4px solid #10b981',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Collection
            </span>
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IndianRupee size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
            {fmt(stats.collectedToday.amount)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Amount collected by you today
          </div>
        </div>

        {/* 2. Today's Collections Count */}
        <div 
          className="card" 
          style={{
            padding: '18px',
            borderLeft: '4px solid #3b82f6',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Receipts
            </span>
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
            {stats.collectedToday.count} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>payments</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Total collections logged today
          </div>
        </div>

        {/* 3. All-Time Collected Amount */}
        <div 
          className="card" 
          style={{
            padding: '18px',
            borderLeft: '4px solid #8b5cf6',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Collected
            </span>
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(139, 92, 246, 0.12)',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', letterSpacing: '-0.02em' }}>
            {fmt(stats.totalCollected.amount)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Your lifetime collection total
          </div>
        </div>

        {/* 4. All-Time Collections Count */}
        <div 
          className="card" 
          style={{
            padding: '18px',
            borderLeft: '4px solid #f59e0b',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Receipts
            </span>
            <div 
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', letterSpacing: '-0.02em' }}>
            {stats.totalCollected.count} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>receipts</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            All-time completed collections
          </div>
        </div>
      </div>

      {/* ─── Recent Collections Feed ─────────────────────────────── */}
      <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              Recent Collections Logged By You
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Latest payment receipts processed under your agent account
            </div>
          </div>
          <Link to="/collections" className="btn btn-ghost btn-sm" style={{ gap: 4, fontSize: 12, color: 'var(--primary-600)' }}>
            Go to Collections <ArrowRight size={13} />
          </Link>
        </div>

        {recentPayments.length === 0 ? (
          <div 
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: 'var(--surface-sunken)',
              borderRadius: 12,
              border: '1px dashed var(--border-subtle)'
            }}
          >
            <HandCoins size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              No Collections Logged Yet Today
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, margin: '6px auto 16px auto' }}>
              Your collection receipts will appear here as you collect and record dues on your field route.
            </p>
            <Link to="/collections" className="btn btn-primary btn-sm">
              <HandCoins size={14} /> Open Collection Sheet
            </Link>
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Loan No.</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(p => {
                  const custName = p.repayment?.loan?.customer?.name || 'Customer';
                  const custPhone = p.repayment?.loan?.customer?.phone;
                  const loanNum = p.repayment?.loan?.loanNumber || '-';
                  const dateFormatted = p.collectedAt ? new Date(p.collectedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-';
                  const isToday = p.collectedAt && new Date(p.collectedAt).toDateString() === new Date().toDateString();

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{custName}</div>
                        {custPhone && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {custPhone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11, padding: '2px 8px' }}>
                          {loanNum}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>
                        {fmt(p.amount)}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, textTransform: 'capitalize' }}>
                          {p.paymentType ? p.paymentType.toLowerCase() : 'Installment'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 6px' }}>
                          {p.paymentMode || 'CASH'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {isToday ? `Today, ${dateFormatted}` : new Date(p.collectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
