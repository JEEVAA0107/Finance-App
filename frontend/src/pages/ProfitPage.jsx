import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowLeft, Filter, IndianRupee, Users, Landmark, ChevronRight } from 'lucide-react';
import { dashboardAPI } from '../services/api';
import toast from 'react-hot-toast';

function fmt(val) {
  if (!val && val !== 0) return '₹0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '₹0';
  return `₹${Number.isInteger(num) ? num.toLocaleString('en-IN') : num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const LOAN_TYPE_LABELS = {
  ALL: 'All Types',
  FLAT: 'வட்டி கடன் (Regular Interest)',
  FIXED_FLAT: 'அசலோடு தவணை (Reducing)',
  WITHOUT_INTEREST: 'கழித்து தருவது (Deduction)',
};

const LOAN_TYPE_COLORS = {
  FLAT: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.18)', text: '#6366f1', badge: 'rgba(99,102,241,0.12)' },
  FIXED_FLAT: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', text: '#059669', badge: 'rgba(16,185,129,0.12)' },
  WITHOUT_INTEREST: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', text: '#d97706', badge: 'rgba(245,158,11,0.12)' },
};

const PERIODS = [
  { value: 'ALL', label: 'All Time' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'THIS_YEAR', label: 'This Year' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

export default function ProfitPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loanType, setLoanType] = useState('ALL');
  const [period, setPeriod] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (loanType !== 'ALL') params.loanType = loanType;
      if (period === 'CUSTOM' && dateFrom && dateTo) {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
      } else if (period !== 'ALL' && period !== 'CUSTOM') {
        params.period = period;
      }
      const result = await dashboardAPI.profit(params);
      setData(result);
    } catch (e) {
      toast.error(e.message || 'Failed to load profit data');
    } finally {
      setLoading(false);
    }
  }, [loanType, period, dateFrom, dateTo]);

  useEffect(() => {
    if (period !== 'CUSTOM') {
      load();
    } else if (period === 'CUSTOM' && dateFrom && dateTo) {
      load();
    }
  }, [load, period, dateFrom, dateTo]);

  const typeSummaryCards = [
    { key: 'FLAT', label: 'வட்டி கடன்', sublabel: 'Regular Interest' },
    { key: 'FIXED_FLAT', label: 'அசலோடு தவணை', sublabel: 'Reducing Principal' },
    { key: 'WITHOUT_INTEREST', label: 'கழித்து தருவது', sublabel: 'Deduction Based' },
  ];

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '6px 10px', borderRadius: 10 }}
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} style={{ color: '#d97706' }} /> Profit Analysis
          </div>
          <div className="color-muted" style={{ fontSize: 12 }}>லாப விவரக்கூற்று — Loan Type & Period Filters</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px', marginBottom: 18, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Filter size={14} style={{ color: 'var(--primary-400)' }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Filters</span>
        </div>

        {/* Loan Type Tabs */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Loan Type (கடன் வகை)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {Object.entries(LOAN_TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setLoanType(key)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: `1.5px solid ${loanType === key ? (LOAN_TYPE_COLORS[key]?.text || 'var(--primary-400)') : 'var(--border-subtle)'}`,
                background: loanType === key ? (LOAN_TYPE_COLORS[key]?.badge || 'rgba(99,102,241,0.1)') : 'transparent',
                color: loanType === key ? (LOAN_TYPE_COLORS[key]?.text || 'var(--primary-400)') : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: loanType === key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {key === 'ALL' ? 'All Types' : key === 'FLAT' ? 'வட்டி கடன்' : key === 'FIXED_FLAT' ? 'அசலோடு தவணை' : 'கழித்து தருவது'}
            </button>
          ))}
        </div>

        {/* Period Tabs */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Period (காலம்)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: period === 'CUSTOM' ? 12 : 0 }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: `1.5px solid ${period === p.value ? 'var(--primary-400)' : 'var(--border-subtle)'}`,
                background: period === p.value ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: period === p.value ? 'var(--primary-400)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: period === p.value ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'CUSTOM' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>From</label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ marginTop: 4, width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>To</label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ marginTop: 4, width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Total Profit Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.08))',
            border: '1.5px solid rgba(245,158,11,0.25)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Profit (மொத்த இலாபம்)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#d97706', marginTop: 4 }}>{fmt(data?.totalProfit)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {data?.entries?.length || 0} loan(s) • {LOAN_TYPE_LABELS[loanType]}
              </div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: 14, padding: 14 }}>
              <TrendingUp size={28} style={{ color: '#d97706' }} />
            </div>
          </div>

          {/* By Loan Type Summary */}
          {loanType === 'ALL' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
              {typeSummaryCards.map(({ key, label, sublabel }) => {
                const c = LOAN_TYPE_COLORS[key];
                const val = data?.byType?.[key] || 0;
                return (
                  <div
                    key={key}
                    onClick={() => setLoanType(key)}
                    style={{
                      background: c.bg,
                      border: `1.5px solid ${c.border}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 10, color: c.text, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{sublabel}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>{fmt(val)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-Loan Breakdown */}
          <div className="card" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Landmark size={15} style={{ color: 'var(--primary-400)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Per-Loan Profit Breakdown</span>
              <span style={{
                marginLeft: 'auto',
                background: 'rgba(99,102,241,0.1)',
                color: 'var(--primary-400)',
                borderRadius: 20,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
              }}>
                {data?.entries?.length || 0} loans
              </span>
            </div>

            {(!data?.entries || data.entries.length === 0) ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No profit data for the selected filters.
              </div>
            ) : (
              <div>
                {data.entries.map((entry, i) => {
                  const c = LOAN_TYPE_COLORS[entry.loanType] || LOAN_TYPE_COLORS.FLAT;
                  const typeLabel = entry.loanType === 'FLAT' ? 'வட்டி கடன்' : entry.loanType === 'FIXED_FLAT' ? 'அசலோடு தவணை' : 'கழித்து தருவது';
                  return (
                    <div
                      key={entry.loanId + i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 16px',
                        borderBottom: i < data.entries.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onClick={() => navigate(`/loans/${entry.loanId}`)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: c.badge,
                        border: `1.5px solid ${c.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 14,
                        fontWeight: 800,
                        color: c.text,
                      }}>
                        {entry.customerName?.[0]?.toUpperCase() || '?'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.customerName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                          <span>{entry.loanNumber}</span>
                          <span style={{ width: 3, height: 3, background: 'var(--text-muted)', borderRadius: '50%', flexShrink: 0 }} />
                          <span style={{ color: c.text, fontWeight: 600 }}>{typeLabel}</span>
                          <span style={{ width: 3, height: 3, background: 'var(--text-muted)', borderRadius: '50%', flexShrink: 0 }} />
                          <span>Principal: {fmt(entry.principalAmount)}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#059669' }}>{fmt(entry.collectedInterest)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          of {fmt(entry.totalExpectedInterest)} total
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
