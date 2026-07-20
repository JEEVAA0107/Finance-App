import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import { Landmark, Users, HandCoins, AlertTriangle, CheckCircle, Plus, TrendingUp, IndianRupee, Calendar, Clock, BarChart3, ChevronRight, PieChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Legend } from 'recharts';

function fmt(val) {
  if (!val) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
}

const StatCard = ({ icon: Icon, label, value, color, to }) => (
  <Link to={to} className={`stat-card ${color}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', padding: '16px', height: '100%' }}>
    <div className={`stat-icon ${color}`} style={{ marginBottom: '12px' }}><Icon size={18} /></div>
    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{value}</div>
    <div className="stat-label" style={{ marginTop: 'auto' }}>{label}</div>
  </Link>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading && !data) return <div className="loading-page"><div className="spinner" /></div>;

  const s = data?.summary;
  const a = data?.agent;
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

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
            <StatCard to="/loans?status=ACTIVE" icon={Landmark} label="Total Outstanding" value={fmt(s?.outstandingAmount)} color="blue" />
            <StatCard to="/loans" icon={IndianRupee} label="Total Disbursed" value={fmt(s?.totalDisbursed)} color="green" />
            <StatCard to="/collections" icon={HandCoins} label="Total Collected" value={fmt(s?.totalCollected)} color="purple" />
            <StatCard to="/reports" icon={TrendingUp} label="Total Profit" value={fmt(s?.totalInterestCollected)} color="yellow" />
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
          <div className="card" style={{ padding: '16px', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Monthly Analytics (Last 6 Months)</div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s?.monthlyTrend ? [...s.monthlyTrend].reverse() : []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={(value) => `₹${value.toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="disbursed" name="Disbursed" fill="var(--primary-500)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="collected" name="Collected" fill="var(--accent-500)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--warning-500)" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month Disbursed</div>
                <div style={{ fontWeight: 700 }}>{fmt(s?.monthly?.disbursed)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month Collected</div>
                <div style={{ fontWeight: 700 }}>{fmt(s?.monthly?.collection)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month Interest</div>
                <div style={{ fontWeight: 700 }}>{fmt(s?.monthly?.interestIncome)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month Profit</div>
                <div style={{ fontWeight: 700 }}>{fmt(s?.monthly?.profit)}</div>
              </div>
            </div>
          </div>

          {/* Upcoming Dues & Recent Collections Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12 }}>
                <div className="card-title">Recent Collections</div>
                <Link to="/collections" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-500)', textDecoration: 'none' }}>View All</Link>
              </div>
              {s?.recentCollections?.length > 0 ? (
                s.recentCollections.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="sidebar-avatar" style={{ width: 34, height: 34, fontSize: 13, background: 'var(--accent-50)', color: 'var(--accent-600)' }}>
                        <HandCoins size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.repayment?.loan?.customer?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>By {item.collectedBy?.name}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-600)' }}>+₹{item.amount?.toLocaleString('en-IN')}</div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No recent collections</div>
              )}
            </div>

            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12 }}>
                <div className="card-title">Upcoming Dues (7 Days)</div>
              </div>
              {s?.upcomingDues?.length > 0 ? (
                s.upcomingDues.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="sidebar-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{item.loan?.customer?.name?.charAt(0)}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.loan?.customer?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>₹{item.dueAmount?.toLocaleString('en-IN')}</div>
                      <span className="badge badge-info" style={{ fontSize: 9 }}>UPCOMING</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No upcoming dues in next 7 days</div>
              )}
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
    </div>
  );
}

