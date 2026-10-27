import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { paymentsAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  FileText, Calendar, Search, HandCoins, Phone, 
  Filter, Download, RefreshCw, IndianRupee, Wallet, 
  CreditCard, CheckCircle2, MessageCircle, Eye, 
  LayoutList, LayoutGrid, Clock, User, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function fmt(val) {
  if (!val && val !== 0) return '₹0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export default function PaymentsHistoryPage() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');

  const getStartOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Quick Preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'
  const [preset, setPreset] = useState(filterParam === 'this_month' ? 'this_month' : 'today');

  // Filter States
  const [dateFrom, setDateFrom] = useState(filterParam === 'this_month' ? getStartOfMonth() : todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [search, setSearch] = useState('');

  // Handle Preset Changes
  const applyPreset = (type) => {
    setPreset(type);
    const now = new Date();
    if (type === 'today') {
      const t = now.toISOString().split('T')[0];
      setDateFrom(t);
      setDateTo(t);
    } else if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (type === 'this_week') {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      setDateFrom(start.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (type === 'this_month') {
      setDateFrom(getStartOfMonth());
      setDateTo(todayStr);
    } else if (type === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Load staff list
  useEffect(() => {
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') {
      usersAPI.list().then(res => {
        const staff = (res || []).filter(u => u.role !== 'CUSTOMER');
        setAgents(staff);
      }).catch(() => {});
    }
  }, [currentUser]);

  // Fetch payments
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params = { limit: 1000 };
      if (dateFrom) params.from = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) params.to = `${dateTo}T23:59:59.999Z`;
      if (selectedAgent) params.collectedById = selectedAgent;

      const res = await paymentsAPI.list(params);
      setPayments(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      toast.error('Failed to load collection records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo, selectedAgent]);

  // Client-side filtering
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const custName = p.repayment?.loan?.customer?.name?.toLowerCase() || '';
        const custPhone = p.repayment?.loan?.customer?.phone || '';
        const agentName = p.collectedBy?.name?.toLowerCase() || '';
        const loanNo = p.repayment?.loan?.loanNumber?.toLowerCase() || '';
        if (!custName.includes(q) && !custPhone.includes(q) && !agentName.includes(q) && !loanNo.includes(q)) {
          return false;
        }
      }

      // Mode filter
      if (selectedMode !== 'ALL' && (p.paymentMode || 'CASH').toUpperCase() !== selectedMode) {
        return false;
      }

      // Type filter
      if (selectedType !== 'ALL' && (p.paymentType || 'INTEREST').toUpperCase() !== selectedType) {
        return false;
      }

      return true;
    });
  }, [payments, search, selectedMode, selectedType]);

  // Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let online = 0;
    let principal = 0;
    let interest = 0;
    let penalty = 0;

    filteredPayments.forEach(p => {
      const amt = p.amount || 0;
      total += amt;
      const mode = (p.paymentMode || 'CASH').toUpperCase();
      if (mode === 'CASH') cash += amt;
      else online += amt;

      const type = (p.paymentType || 'INTEREST').toUpperCase();
      if (type === 'PRINCIPAL') principal += amt;
      else if (type === 'PENALTY') penalty += amt;
      else interest += amt;
    });

    return { total, cash, online, principal, interest, penalty, count: filteredPayments.length };
  }, [filteredPayments]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredPayments.length === 0) {
      toast.error('No collection data to export');
      return;
    }

    const headers = ['Receipt No', 'Date', 'Time', 'Customer Name', 'Phone', 'Loan Number', 'Amount (INR)', 'Payment Type', 'Payment Mode', 'Collected By', 'Notes'];
    const rows = filteredPayments.map((p, idx) => {
      const date = new Date(p.collectedAt).toLocaleDateString('en-IN');
      const time = new Date(p.collectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const customer = (p.repayment?.loan?.customer?.name || 'Customer').replace(/,/g, '');
      const phone = p.repayment?.loan?.customer?.phone || '';
      const loanNo = p.repayment?.loan?.loanNumber || '-';
      const amount = p.amount || 0;
      const type = p.paymentType || 'Installment';
      const mode = p.paymentMode || 'CASH';
      const agent = (p.collectedBy?.name || 'Agent').replace(/,/g, '');
      const notes = (p.notes || '').replace(/,/g, ' ');

      return [`RCP-${idx + 1}`, date, time, customer, phone, loanNo, amount, type, mode, agent, notes].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Collection_History_${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Collection Report Exported!');
  };

  // Group by date for card/timeline view
  const groupedByDate = useMemo(() => {
    return filteredPayments.reduce((acc, p) => {
      const dateKey = new Date(p.collectedAt).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(p);
      return acc;
    }, {});
  }, [filteredPayments]);

  return (
    <div className="animate-in" style={{ paddingBottom: 60 }}>
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Collection History
            </h1>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
              {metrics.count} Receipts
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time audit log of all repayments and agent collection receipts
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-sunken)', borderRadius: 10, padding: 3, border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, gap: 4 }}
              title="Table View"
            >
              <LayoutList size={14} /> Ledger Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, gap: 4 }}
              title="Cards View"
            >
              <LayoutGrid size={14} /> Daily Cards
            </button>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border-subtle)' }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={exportToCSV}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 10, padding: '8px 14px', border: '1px solid var(--border-subtle)', gap: 6, fontWeight: 600 }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ─── Executive Summary KPI Strip ───────────────────────────── */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 20
        }}
      >
        {/* Total Collected */}
        <div 
          className="card" 
          style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
            color: '#ffffff',
            borderRadius: 14,
            boxShadow: '0 8px 20px -4px rgba(5, 150, 105, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Collected
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={16} color="#fff" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>
            {fmt(metrics.total)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            Across {metrics.count} total transaction receipts
          </div>
        </div>

        {/* Cash vs Digital Ratio */}
        <div 
          className="card" 
          style={{
            padding: '18px 20px',
            background: 'var(--surface)',
            borderRadius: 14,
            borderLeft: '4px solid #10b981',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Cash Collections
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 8 }}>
            {fmt(metrics.cash)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.total > 0 ? Math.round((metrics.cash / metrics.total) * 100) : 0}% of collections
          </div>
        </div>

        {/* Online / UPI Collections */}
        <div 
          className="card" 
          style={{
            padding: '18px 20px',
            background: 'var(--surface)',
            borderRadius: 14,
            borderLeft: '4px solid #3b82f6',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              UPI & Bank Online
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', marginTop: 8 }}>
            {fmt(metrics.online)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.total > 0 ? Math.round((metrics.online / metrics.total) * 100) : 0}% via digital channels
          </div>
        </div>

        {/* Breakdown Card */}
        <div 
          className="card" 
          style={{
            padding: '18px 20px',
            background: 'var(--surface)',
            borderRadius: 14,
            borderLeft: '4px solid #8b5cf6',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Inflow Breakdown
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HandCoins size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Interest:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(metrics.interest)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Principal:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(metrics.principal)}</span>
            </div>
            {metrics.penalty > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Penalty:</span>
                <span style={{ fontWeight: 700, color: '#d97706' }}>{fmt(metrics.penalty)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modern Filters & Quick Presets Strip ───────────────────── */}
      <div 
        className="card" 
        style={{
          padding: '16px 20px',
          borderRadius: 14,
          marginBottom: 20,
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Quick Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>
              Period:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'all', label: 'All History' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: preset === p.id ? 'var(--primary-600)' : 'var(--border-subtle)',
                  background: preset === p.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface-sunken)',
                  color: preset === p.id ? 'var(--primary-600)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', gap: 4 }}
          >
            <Filter size={13} /> {showAdvancedFilters ? 'Hide Advanced Filters' : 'More Filters'}
          </button>
        </div>

        {/* Expanded Filters Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div className="search-bar" style={{ flex: 1, minWidth: 260, margin: 0, height: 40 }}>
            <Search size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Search by customer name, phone, loan number..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Payment Mode Filter */}
          <select 
            value={selectedMode} 
            onChange={e => setSelectedMode(e.target.value)}
            className="form-select"
            style={{ width: 'auto', minWidth: 130, height: 40, fontSize: 13 }}
          >
            <option value="ALL">All Modes</option>
            <option value="CASH">Cash Only</option>
            <option value="UPI">UPI / Online</option>
            <option value="BANK">Bank Transfer</option>
          </select>

          {/* Payment Type Filter */}
          <select 
            value={selectedType} 
            onChange={e => setSelectedType(e.target.value)}
            className="form-select"
            style={{ width: 'auto', minWidth: 140, height: 40, fontSize: 13 }}
          >
            <option value="ALL">All Types</option>
            <option value="INTEREST">Installment / Interest</option>
            <option value="PRINCIPAL">Principal Payment</option>
            <option value="PENALTY">Penalty Fee</option>
          </select>

          {/* Staff Filter (Admin/Super Admin only) */}
          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && agents.length > 0 && (
            <select 
              value={selectedAgent} 
              onChange={e => setSelectedAgent(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: 150, height: 40, fontSize: 13 }}
            >
              <option value="">All Staff / Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Custom Date Range (when toggled) */}
        {showAdvancedFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => { setDateFrom(e.target.value); setPreset('custom'); }} 
                className="form-input" 
                style={{ height: 36, width: 150, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => { setDateTo(e.target.value); setPreset('custom'); }} 
                className="form-input" 
                style={{ height: 36, width: 150, fontSize: 13 }}
              />
            </div>
            {(dateFrom || dateTo || selectedAgent || selectedMode !== 'ALL' || selectedType !== 'ALL' || search) && (
              <button
                onClick={() => {
                  applyPreset('today');
                  setSelectedAgent('');
                  setSelectedMode('ALL');
                  setSelectedType('ALL');
                  setSearch('');
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: 'var(--danger-500)', marginLeft: 'auto' }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Main Content Display: Table or Cards ──────────────────── */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 14 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading collection history records...</div>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FileText size={32} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            No Collections Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 360, margin: '0 auto 16px auto' }}>
            No payment receipts match your current date range and filter criteria.
          </p>
          <button onClick={() => applyPreset('all')} className="btn btn-primary btn-sm">
            Show All History
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ─── View 1: Professional Financial Ledger Table ───────────── */
        <div className="card" style={{ padding: 0, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
          <div className="table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Date & Time</th>
                  <th>Customer Profile</th>
                  <th>Loan ID</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Collected By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const custName = p.repayment?.loan?.customer?.name || 'Customer';
                  const custPhone = p.repayment?.loan?.customer?.phone;
                  const loanNo = p.repayment?.loan?.loanNumber || '-';
                  const loanId = p.repayment?.loan?.id;
                  const isPrincipal = (p.paymentType || '').toUpperCase() === 'PRINCIPAL';
                  const isPenalty = (p.paymentType || '').toUpperCase() === 'PENALTY';
                  const isCash = (p.paymentMode || 'CASH').toUpperCase() === 'CASH';
                  const date = new Date(p.collectedAt);
                  const isToday = date.toDateString() === new Date().toDateString();

                  return (
                    <tr key={p.id}>
                      {/* Date & Time */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {isToday ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>Today</span>
                          ) : (
                            date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Clock size={11} /> {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div 
                            style={{ 
                              width: 34, 
                              height: 34, 
                              borderRadius: '50%', 
                              background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))', 
                              color: 'var(--primary-700)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontWeight: 700, 
                              fontSize: 13,
                              flexShrink: 0
                            }}
                          >
                            {custName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                              {custName}
                            </div>
                            {custPhone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12 }}>
                                <a 
                                  href={`tel:${custPhone}`} 
                                  style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                  <Phone size={11} /> {custPhone}
                                </a>
                                <a
                                  href={`https://wa.me/91${custPhone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Chat on WhatsApp"
                                  style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}
                                >
                                  <MessageCircle size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Loan Number */}
                      <td>
                        {loanId ? (
                          <Link 
                            to={`/loans/${loanId}`}
                            className="badge badge-info" 
                            style={{ 
                              fontSize: 11, 
                              padding: '3px 8px', 
                              textDecoration: 'none',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {loanNo}
                          </Link>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: 11, padding: '3px 8px' }}>
                            {loanNo}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#059669', letterSpacing: '-0.02em' }}>
                          {fmt(p.amount)}
                        </div>
                      </td>

                      {/* Payment Type */}
                      <td>
                        <span 
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isPrincipal ? 'rgba(245, 158, 11, 0.1)' : isPenalty ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: isPrincipal ? '#d97706' : isPenalty ? '#dc2626' : '#2563eb',
                            display: 'inline-block'
                          }}
                        >
                          {isPrincipal ? 'Principal Lump-sum' : isPenalty ? 'Penalty Late Fee' : 'Installment Due'}
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td>
                        <span 
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isCash ? 'rgba(16, 185, 129, 0.08)' : 'rgba(139, 92, 246, 0.08)',
                            color: isCash ? '#059669' : '#7c3aed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isCash ? <Wallet size={11} /> : <CreditCard size={11} />}
                          {p.paymentMode || 'CASH'}
                        </span>
                      </td>

                      {/* Collected By */}
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-sunken)', padding: '3px 8px', borderRadius: 20 }}>
                          <div 
                            style={{ 
                              width: 18, 
                              height: 18, 
                              borderRadius: '50%', 
                              background: 'var(--primary-500)', 
                              color: '#fff', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: 9, 
                              fontWeight: 700 
                            }}
                          >
                            {(p.collectedBy?.name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.collectedBy?.name || 'Agent'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        {loanId && (
                          <Link
                            to={`/loans/${loanId}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', borderRadius: 6, color: 'var(--primary-600)' }}
                            title="View Loan Details"
                          >
                            <Eye size={14} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── View 2: Modern Daily Grouped Card View ────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groupedByDate).map(([dateLabel, dayList]) => {
            const dayTotal = dayList.reduce((acc, p) => acc + (p.amount || 0), 0);
            return (
              <div key={dateLabel}>
                {/* Date Header Pill */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={14} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                      {dateLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 10px', borderRadius: 12 }}>
                    Day Total: {fmt(dayTotal)}
                  </span>
                </div>

                {/* Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {dayList.map(p => {
                    const custName = p.repayment?.loan?.customer?.name || 'Customer';
                    const custPhone = p.repayment?.loan?.customer?.phone;
                    const loanNo = p.repayment?.loan?.loanNumber || '-';
                    const loanId = p.repayment?.loan?.id;
                    const isPrincipal = (p.paymentType || '').toUpperCase() === 'PRINCIPAL';
                    const isCash = (p.paymentMode || 'CASH').toUpperCase() === 'CASH';

                    return (
                      <div 
                        key={p.id} 
                        className="card" 
                        style={{
                          padding: '16px',
                          borderRadius: 14,
                          borderLeft: `4px solid ${isPrincipal ? '#f59e0b' : '#10b981'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          boxShadow: 'var(--card-shadow)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div 
                              style={{ 
                                width: 36, 
                                height: 36, 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))', 
                                color: 'var(--primary-700)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 700, 
                                fontSize: 14 
                              }}
                            >
                              {custName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                {custName}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span>{loanNo}</span>
                                {custPhone && <span>• {custPhone}</span>}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
                              {fmt(p.amount)}
                            </div>
                            <span 
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: isPrincipal ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: isPrincipal ? '#d97706' : '#059669',
                                display: 'inline-block',
                                marginTop: 4
                              }}
                            >
                              {p.paymentType || 'Installment'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px dashed var(--border-subtle)', fontSize: 11 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                            <Clock size={11} /> {new Date(p.collectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: isCash ? '#059669' : '#7c3aed' }}>{p.paymentMode || 'CASH'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>By:</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.collectedBy?.name || 'Agent'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
