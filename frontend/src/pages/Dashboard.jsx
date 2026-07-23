import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, loansAPI } from '../services/api';
import { Landmark, Users, HandCoins, AlertTriangle, CheckCircle, Plus, TrendingUp, IndianRupee, Calendar, Clock, BarChart3, ChevronRight, PieChart, X, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Legend } from 'recharts';

function fmt(val) {
  if (!val && val !== 0) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
}

const StatCard = ({ icon: Icon, label, value, color, to, onClick }) => {
  const content = (
    <>
      <div className={`stat-icon ${color}`} style={{ marginBottom: '12px' }}><Icon size={18} /></div>
      <div className="stat-value" style={{ fontSize: '1.25rem' }}>{value}</div>
      <div className="stat-label" style={{ marginTop: 'auto' }}>{label}</div>
    </>
  );

  if (onClick) {
    return (
      <div 
        onClick={onClick} 
        className={`stat-card ${color}`} 
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px', height: '100%' }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={`stat-card ${color}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', padding: '16px', height: '100%' }}>
      {content}
    </Link>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState('BAR'); // 'BAR' | 'AREA'

  // Breakdown modal states
  const [activeModal, setActiveModal] = useState(null); // 'DISBURSED' | 'OUTSTANDING' | null
  const [modalLoanType, setModalLoanType] = useState('ALL'); // 'ALL' | 'FLAT' | 'WITHOUT_INTEREST' | 'FIXED_FLAT'
  const [breakdownLoans, setBreakdownLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    Promise.all([dashboardAPI.summary(), dashboardAPI.agent()])
      .then(([s, a]) => setData({ summary: s, agent: a }))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const openBreakdownModal = (type, loanType = 'ALL') => {
    setActiveModal(type);
    setModalLoanType(loanType);
    setSearchQuery('');
    setLoadingLoans(true);
    
    // Fetch all relevant loans for breakdown
    const params = type === 'OUTSTANDING' ? { status: 'ACTIVE', limit: 200 } : { limit: 200 };
    loansAPI.list(params)
      .then(res => {
        setBreakdownLoans(res || []);
      })
      .catch(console.error)
      .finally(() => setLoadingLoans(false));
  };

  if (loading && !data) return <div className="loading-page"><div className="spinner" /></div>;

  const s = data?.summary;
  const a = data?.agent;
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  // Filter breakdown loans by search and loan type
  const filteredLoans = breakdownLoans.filter(l => {
    if (modalLoanType !== 'ALL' && l.interestType !== modalLoanType) return false;
    const q = searchQuery.toLowerCase();
    const name = l.customer?.name?.toLowerCase() || '';
    const phone = l.customer?.phone || '';
    const num = l.loanNumber?.toLowerCase() || '';
    return name.includes(q) || phone.includes(q) || num.includes(q);
  });

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Hi, {user?.name?.split(' ')[0]} 👋</div>
          <div className="color-muted" style={{ fontSize: 13 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/loans/create" className="btn btn-primary btn-sm"><Plus size={15}/> New Loan</Link>
          <Link to="/collections" className="btn btn-success btn-sm"><HandCoins size={15}/> Collect</Link>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Overdue alert */}
          {s?.overdueLoansCount > 0 && (
            <Link to="/loans?status=ACTIVE" style={{ textDecoration: 'none' }}>
              <div className="alert-card" style={{ background: 'var(--danger-50)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertTriangle size={18} style={{ color: 'var(--danger-600)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger-600)' }}>{s.overdueLoansCount} Overdue Loans</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(s.totalOverdueAmount)} pending → Tap to view</div>
                </div>
              </div>
            </Link>
          )}

          {/* Section 1: Overall Financials */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, marginTop: 24, color: 'var(--text-primary)' }}>Overall Financials</div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard onClick={() => openBreakdownModal('OUTSTANDING')} icon={Landmark} label="Total Outstanding" value={fmt(s?.outstandingAmount)} color="blue" />
            <StatCard onClick={() => openBreakdownModal('DISBURSED')} icon={IndianRupee} label="Total Disbursed" value={fmt(s?.totalDisbursed)} color="green" />
            <StatCard to="/collections" icon={HandCoins} label="Total Collected" value={fmt(s?.totalCollected)} color="purple" />
            <StatCard to="/reports" icon={TrendingUp} label="Total Profit" value={fmt(s?.totalInterestCollected)} color="yellow" />
          </div>
          {/* Outstanding Breakdown by Loan Types */}
          <div className="card" style={{ padding: '16px', marginBottom: 20, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PieChart size={16} style={{ color: 'var(--primary-500)' }} /> Outstanding Dues by Loan Type (வகை வாரியாக நிலுவை)
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tap card to view list</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div 
                onClick={() => openBreakdownModal('OUTSTANDING', 'FLAT')}
                style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.18)', padding: '12px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Regular Interest (வார வட்டி)</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#2563EB', marginTop: 4 }}>
                  {fmt(s?.outstandingByLoanType?.FLAT?.amount)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s?.outstandingByLoanType?.FLAT?.count || 0} active loans
                </div>
              </div>

              <div 
                onClick={() => openBreakdownModal('OUTSTANDING', 'WITHOUT_INTEREST')}
                style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.18)', padding: '12px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Deduction Based (கழித்து தருவது)</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#059669', marginTop: 4 }}>
                  {fmt(s?.outstandingByLoanType?.WITHOUT_INTEREST?.amount)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s?.outstandingByLoanType?.WITHOUT_INTEREST?.count || 0} active loans
                </div>
              </div>

              <div 
                onClick={() => openBreakdownModal('OUTSTANDING', 'FIXED_FLAT')}
                style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.18)', padding: '12px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Reducing Principal (அசலோடு தவணை)</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#7C3AED', marginTop: 4 }}>
                  {fmt(s?.outstandingByLoanType?.FIXED_FLAT?.amount)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s?.outstandingByLoanType?.FIXED_FLAT?.count || 0} active loans
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Today's Metrics */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, marginTop: 24, color: 'var(--text-primary)' }}>Today's Performance</div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard to="/collections" icon={Calendar} label="Today's Collection" value={fmt(s?.todayCollection)} color="green" />
            <StatCard to="/collections" icon={Clock} label="Today's Due" value={fmt(s?.todayDueAmount)} color="blue" />
            <StatCard to="/collections" icon={AlertTriangle} label="Remaining Due" value={fmt(s?.remainingToday)} color="yellow" />
            <StatCard to="/collections" icon={PieChart} label="Pending (All)" value={fmt(s?.pendingCollections)} color="purple" />
          </div>

          {/* Section 3: Entities */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <StatCard to="/customers" icon={Users} label="Active Customers" value={s?.activeCustomers} color="blue" />
            <StatCard to="/loans?status=ACTIVE" icon={Landmark} label="Active Loans" value={s?.activeLoans} color="green" />
          </div>

          {/* Monthly Analytics Chart */}
          <div className="card" style={{ padding: '20px', marginBottom: 24, borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={18} style={{ color: 'var(--primary-400)' }} /> Monthly Business Analytics
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Last 6 Months performance (மாதாந்திர வளர்ச்சி)</div>
              </div>
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg-subtle, rgba(0,0,0,0.04))', padding: 4, borderRadius: 10 }}>
                <button 
                  type="button"
                  className={`btn btn-sm ${chartView === 'BAR' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8 }}
                  onClick={() => setChartView('BAR')}
                >
                  <BarChart3 size={13} style={{ marginRight: 4 }} /> Bar
                </button>
                <button 
                  type="button"
                  className={`btn btn-sm ${chartView === 'AREA' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8 }}
                  onClick={() => setChartView('AREA')}
                >
                  <TrendingUp size={13} style={{ marginRight: 4 }} /> Trend
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s?.monthlyTrend ? [...s.monthlyTrend] : []} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorDisbursed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }} 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', fontSize: '12px' }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>🗓️ {label}</div>
                            {payload.map((entry, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
                                <span style={{ color: entry.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
                                  {entry.name}:
                                </span>
                                <span style={{ fontWeight: 700 }}>₹{entry.value?.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  
                  {chartView === 'BAR' ? (
                    <>
                      <Bar dataKey="disbursed" name="Disbursed (வழங்கியது)" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="collected" name="Collected (வசூலானது)" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="disbursed" name="Disbursed (வழங்கியது)" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorDisbursed)" />
                      <Area type="monotone" dataKey="collected" name="Collected (வசூலானது)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
                    </>
                  )}
                  <Line type="monotone" dataKey="profit" name="Profit (லாபம்)" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: '#F59E0B' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            {/* KPI Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 18, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>This Month Disbursed</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#2563EB', marginTop: 2 }}>{fmt(s?.monthly?.disbursed)}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.12)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>This Month Collected</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#059669', marginTop: 2 }}>{fmt(s?.monthly?.collection)}</div>
              </div>
              <div style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.12)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>This Month Interest</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#7C3AED', marginTop: 2 }}>{fmt(s?.monthly?.interestIncome)}</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.12)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>This Month Profit</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#D97706', marginTop: 2 }}>{fmt(s?.monthly?.profit)}</div>
              </div>
            </div>
          </div>

        </>
      ) : (
        <>
          {/* Default Agent View */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Link to="/loans" className="stat-card blue" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon blue"><Landmark size={18} /></div>
              <div className="stat-value">{a?.assignedLoans || 0}</div>
              <div className="stat-label">Assigned Loans</div>
            </Link>
            <Link to="/collections" className="stat-card green" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon green"><IndianRupee size={18} /></div>
              <div className="stat-value">{fmt(a?.collectedToday?.amount || 0)}</div>
              <div className="stat-label">Collected Today</div>
            </Link>
          </div>

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
            </div>
          )}

          {a?.todayDue?.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <CheckCircle size={36} style={{ color: 'var(--accent-400)', opacity: 0.6, marginBottom: 8 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>All clear today!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections due</div>
            </div>
          )}
        </>
      )}

      {/* Breakdown Modal (Disbursed & Outstanding) */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal modal-lg animate-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  {activeModal === 'DISBURSED' ? 'Total Disbursed Breakdown (விநியோக விவரங்கள்)' : 'Total Outstanding Dues (நிலுவைத் தொகை விவரங்கள்)'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {activeModal === 'DISBURSED' 
                    ? `Total: ${fmt(s?.totalDisbursed)} (யார் யாருக்கு எவ்வளவு கடன் கொடுக்கப்பட்டது)` 
                    : `Total: ${fmt(s?.outstandingAmount)} (யார் யாருக்கு எவ்வளவு நிலுவை உள்ளது)`}
                </div>
              </div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Loan Type Filter Tabs */}
              <div className="tabs" style={{ marginBottom: 14 }}>
                {[
                  ['ALL', 'All Types'],
                  ['FLAT', 'Regular Interest (வார வட்டி)'],
                  ['WITHOUT_INTEREST', 'Deduction Based (கழித்து)'],
                  ['FIXED_FLAT', 'Reducing Principal (அசலோடு)']
                ].map(([val, label]) => (
                  <button 
                    key={val} 
                    className={`tab ${modalLoanType === val ? 'active' : ''}`}
                    onClick={() => setModalLoanType(val)}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="search-bar" style={{ marginBottom: 16, maxWidth: '100%' }}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search customer name, phone, or loan number..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {loadingLoans ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading breakdown data...</div>
                </div>
              ) : filteredLoans.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <h3>No records found</h3>
                  <p style={{ fontSize: 12 }}>No matching customer loans for this breakdown.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Loan No</th>
                        <th>Date</th>
                        {activeModal === 'DISBURSED' ? (
                          <th>Disbursed Principal</th>
                        ) : (
                          <>
                            <th>Disbursed</th>
                            <th>Collected</th>
                            <th>Outstanding Balance</th>
                          </>
                        )}
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoans.map(loan => {
                        const totalCollected = (loan.repayments || []).reduce((acc, r) => acc + (r.paidAmount || 0), 0);
                        const outstandingAmt = Math.max(0, (loan.totalPayable || loan.principalAmount) - totalCollected);

                        return (
                          <tr key={loan.id}>
                            <td data-label="Customer">
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loan.customer?.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.customer?.phone}</div>
                            </td>
                            <td data-label="Loan No">
                              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{loan.loanNumber}</span>
                            </td>
                            <td data-label="Date">
                              {new Date(loan.startDate || loan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            {activeModal === 'DISBURSED' ? (
                              <td data-label="Disbursed Principal">
                                <span style={{ fontWeight: 800, color: 'var(--accent-600)', fontSize: 15 }}>
                                  ₹{loan.principalAmount?.toLocaleString('en-IN')}
                                </span>
                              </td>
                            ) : (
                              <>
                                <td data-label="Disbursed">
                                  ₹{loan.principalAmount?.toLocaleString('en-IN')}
                                </td>
                                <td data-label="Collected">
                                  ₹{totalCollected?.toLocaleString('en-IN')}
                                </td>
                                <td data-label="Outstanding Balance">
                                  <span style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: 15 }}>
                                    ₹{outstandingAmt?.toLocaleString('en-IN')}
                                  </span>
                                </td>
                              </>
                            )}
                            <td data-label="Status">
                              <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-info' : loan.status === 'CLOSED' ? 'badge-success' : 'badge-danger'}`}>
                                {loan.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


