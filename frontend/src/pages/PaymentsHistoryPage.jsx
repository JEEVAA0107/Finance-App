import { useState, useEffect } from 'react';
import { paymentsAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FileText, Calendar, User, Search, HandCoins, ArrowDownToLine, Clock, Phone, Banknote, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentsHistoryPage() {
  const { user: currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    from: new Date().toISOString().split('T')[0], // Default today
    to: new Date().toISOString().split('T')[0],
    collectedById: ''
  });
  
  const [search, setSearch] = useState('');

  // Load agents (for admin to filter)
  useEffect(() => {
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') {
      usersAPI.list().then(res => {
        // Filter out customers, keep only agents and admins
        const staffOnly = (res || []).filter(u => u.role !== 'CUSTOMER');
        setAgents(staffOnly);
      }).catch(() => {});
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = { limit: 500 };
      if (filters.from) params.from = `${filters.from}T00:00:00.000Z`;
      if (filters.to) params.to = `${filters.to}T23:59:59.999Z`;
      if (filters.collectedById) params.collectedById = filters.collectedById;

      const res = await paymentsAPI.list(params);
      setPayments(res || []);
    } catch (err) {
      toast.error('Failed to load collection history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const filteredPayments = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const custName = p.repayment?.loan?.customer?.name?.toLowerCase() || '';
    const agentName = p.collectedBy?.name?.toLowerCase() || '';
    const loanNo = p.repayment?.loan?.loanNumber?.toLowerCase() || '';
    return custName.includes(q) || agentName.includes(q) || loanNo.includes(q);
  });

  const totalCollected = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  // Group by date for a timeline view
  const groupedPayments = filteredPayments.reduce((acc, p) => {
    const date = new Date(p.collectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(p);
    return acc;
  }, {});

  return (
    <div className="animate-in" style={{ paddingBottom: 40, maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Premium Header Profile Style */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            Collection History
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-500)' }} />
            Live tracking of agent activities & payments
          </div>
        </div>
        <div style={{ 
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', 
          color: 'white', 
          padding: '12px 20px', 
          borderRadius: 16, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 }}>
            <Banknote size={24} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', opacity: 0.9, letterSpacing: 0.5 }}>Total Collected</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>₹{totalCollected.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Modern Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-bar mobile-full-width" style={{ flex: 1, minWidth: 250, margin: 0, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search by customer, agent, or loan ID..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 14 }}
          />
        </div>
        <button 
          className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'} mobile-full-width`} 
          onClick={() => setShowFilters(!showFilters)}
          style={{ background: showFilters ? 'var(--primary-600)' : 'var(--card-bg)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}
        >
          <Filter size={18} /> Filters
        </button>
      </div>

      {/* Expandable Filter Card */}
      {showFilters && (
        <div className="card animate-in" style={{ marginBottom: 24, padding: 20, borderRadius: 16, border: '1px solid var(--primary-100)', background: 'var(--bg-subtle)' }}>
          <div className="responsive-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Start Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={filters.from} 
                onChange={e => setFilters({ ...filters, from: e.target.value })}
                style={{ background: 'var(--card-bg)' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>End Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={filters.to} 
                onChange={e => setFilters({ ...filters, to: e.target.value })}
                style={{ background: 'var(--card-bg)' }}
              />
            </div>
            
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Field Agent</label>
                <select 
                  className="form-select"
                  value={filters.collectedById}
                  onChange={e => setFilters({ ...filters, collectedById: e.target.value })}
                  style={{ background: 'var(--card-bg)' }}
                >
                  <option value="">All Agents</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Premium Activity Timeline View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Fetching latest collections...</div>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state card" style={{ padding: '60px 20px', borderRadius: 20 }}>
          <div style={{ background: 'var(--bg-subtle)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FileText size={40} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Collections Found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>No payments match your current search or date filters. Try adjusting the dates.</p>
        </div>
      ) : (
        <div className="timeline-container" style={{ position: 'relative', marginLeft: 8 }}>
          {/* Vertical Timeline Line */}
          <div style={{ position: 'absolute', left: 15, top: 20, bottom: 0, width: 2, background: 'var(--border-subtle)', borderRadius: 2 }} />
          
          {Object.entries(groupedPayments).map(([date, dayPayments]) => (
            <div key={date} style={{ marginBottom: 32, position: 'relative' }}>
              
              {/* Date Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, border: '4px solid var(--bg-body)' }}>
                  <Calendar size={14} strokeWidth={3} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', letterSpacing: 0.2 }}>{date}</div>
              </div>

              {/* Cards for the day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 44 }}>
                {dayPayments.map((p) => {
                  const isPrincipal = p.paymentType === 'PRINCIPAL';
                  return (
                    <div 
                      key={p.id} 
                      className="card" 
                      style={{ 
                        padding: 12, 
                        borderRadius: 12, 
                        borderLeft: `4px solid ${isPrincipal ? 'var(--warning-500)' : 'var(--success-500)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'default',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
                    >
                      {/* Top Row: Time & Amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          <Clock size={12} /> {new Date(p.collectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>₹{p.amount?.toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      {/* Middle Row: Customer Info */}
                      <div style={{ background: 'var(--bg-subtle)', padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 14, background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)' }}>
                            {p.repayment?.loan?.customer?.name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{p.repayment?.loan?.customer?.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-600)' }}>{p.repayment?.loan?.loanNumber}</span>
                              {p.repayment?.loan?.customer?.phone && (
                                <>
                                  <span>•</span>
                                  <a 
                                    href={`tel:${p.repayment?.loan?.customer?.phone}`} 
                                    style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Phone size={10} /> {p.repayment?.loan?.customer?.phone}
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                           <span className={`badge ${isPrincipal ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8 }}>
                             {p.paymentType}
                           </span>
                           <div style={{ marginTop: 6 }}>
                             <span className="badge badge-info" style={{ fontSize: 9, opacity: 0.8 }}>{p.paymentMode}</span>
                           </div>
                        </div>
                      </div>

                      {/* Bottom Row: Agent & Notes */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: 8, marginTop: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Collected by:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', padding: '2px 8px 2px 2px', borderRadius: 20 }}>
                            <div className="sidebar-avatar" style={{ width: 18, height: 18, fontSize: 9, background: 'var(--primary-500)', color: 'white' }}>
                              {p.collectedBy?.name?.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 11 }}>{p.collectedBy?.name || 'Unknown'}</span>
                          </div>
                        </div>
                        {p.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '40%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            "{p.notes}"
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
