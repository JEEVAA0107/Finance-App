import { useState, useEffect } from 'react';
import { paymentsAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FileText, Calendar, User, Search, HandCoins, ArrowDownToLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentsHistoryPage() {
  const { user: currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  
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
      usersAPI.list().then(res => setAgents(res || [])).catch(() => {});
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

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Collection History</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Track agent collections & payments</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label className="form-label" style={{ fontSize: 11 }}>From Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={filters.from} 
              onChange={e => setFilters({ ...filters, from: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label className="form-label" style={{ fontSize: 11 }}>To Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={filters.to} 
              onChange={e => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
          
          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Filter by Agent</label>
              <select 
                className="form-select"
                value={filters.collectedById}
                onChange={e => setFilters({ ...filters, collectedById: e.target.value })}
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

      {/* Summary & Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)', padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <HandCoins style={{ color: 'var(--success-600)' }} size={24} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--success-700)', fontWeight: 600, textTransform: 'uppercase' }}>Total Collected</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>₹{totalCollected.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="search-bar" style={{ flex: 1, maxWidth: 300, margin: 0 }}>
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search customer, agent, or loan..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state card">
          <FileText size={40} />
          <h3>No Collections Found</h3>
          <p>No payments match your current filters.</p>
        </div>
      ) : (
        <div className="card table-container" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Agent</th>
                <th>Customer Details</th>
                <th>Amount</th>
                <th>Mode & Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id}>
                  <td data-label="Date & Time">
                    <div style={{ fontWeight: 600 }}>{new Date(p.collectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(p.collectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td data-label="Agent">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="sidebar-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{p.collectedBy?.name?.charAt(0)}</div>
                      <span style={{ fontWeight: 600 }}>{p.collectedBy?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td data-label="Customer">
                    <div style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{p.repayment?.loan?.customer?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.repayment?.loan?.loanNumber}</div>
                  </td>
                  <td data-label="Amount">
                    <span style={{ fontWeight: 800, color: 'var(--success-600)', fontSize: 15 }}>₹{p.amount?.toLocaleString('en-IN')}</span>
                  </td>
                  <td data-label="Mode & Type">
                    <div>
                      <span className="badge badge-info" style={{ marginRight: 4 }}>{p.paymentMode}</span>
                      <span className={`badge ${p.paymentType === 'PRINCIPAL' ? 'badge-warning' : 'badge-success'}`}>{p.paymentType}</span>
                    </div>
                    {p.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{p.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
