/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FileBarChart, AlertTriangle, Calendar, Download, Users } from 'lucide-react';

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }

export default function ReportsPage() {
  const [tab, setTab] = useState('daily');
  const [dailyData, setDailyData] = useState({ payments: [], total: 0 });
  const [defaulters, setDefaulters] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const loadDaily = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.dailyCollection({ date });
      setDailyData({ payments: res.payments, total: res.total });
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const loadDefaulters = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.defaulters();
      setDefaulters(res);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'daily') loadDaily();
    else if (tab === 'defaulters') loadDefaulters();
  }, [tab, date]);

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${r[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h2>Reports</h2>
        <p>Generate and export financial reports</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          <Calendar size={14} style={{ marginRight: 4 }} />Daily Collection
        </button>
        <button className={`tab ${tab === 'defaulters' ? 'active' : ''}`} onClick={() => setTab('defaulters')}>
          <AlertTriangle size={14} style={{ marginRight: 4 }} />Defaulter List
        </button>
      </div>

      {/* Daily Collection */}
      {tab === 'daily' && (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div className="card-title flex items-center gap-8"><Calendar size={18} />Daily Collection Report</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }} />
              <button className="btn btn-ghost btn-sm" style={{ flex: '1 1 120px', minWidth: 0 }} onClick={() => {
                const rows = dailyData.payments.map(p => ({
                  Customer: p.repayment?.loan?.customer?.name,
                  Phone: p.repayment?.loan?.customer?.phone,
                  Loan: p.repayment?.loan?.loanNumber,
                  Amount: p.amount,
                  Mode: p.paymentMode,
                  Reference: p.reference || '',
                  CollectedBy: p.collectedBy?.name,
                  Time: new Date(p.collectedAt).toLocaleTimeString(),
                }));
                exportCSV(rows, `daily-collection-${date}`);
              }}>
                <Download size={14} />Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <>
              <div style={{ padding: '16px 20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="color-muted fs-12">TOTAL COLLECTION</span>
                  <div className="stat-value" style={{ fontSize: 24, color: 'var(--accent-400)' }}>₹{dailyData.total?.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="color-muted fs-12">ENTRIES</span>
                  <div className="stat-value" style={{ fontSize: 24 }}>{dailyData.payments.length}</div>
                </div>
              </div>

              {dailyData.payments.length === 0 ? (
                <div className="empty-state"><p>No collections for this date.</p></div>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Customer</th><th>Loan #</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Collected By</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {dailyData.payments.map((p) => (
                        <tr key={p.id}>
                          <td data-label="Customer" className="fw-600">{p.repayment?.loan?.customer?.name}</td>
                          <td data-label="Loan #">{p.repayment?.loan?.loanNumber}</td>
                          <td data-label="Amount" className="fw-700" style={{ color: 'var(--accent-400)' }}>₹{p.amount?.toLocaleString('en-IN')}</td>
                          <td data-label="Mode"><span className="badge badge-info">{p.paymentMode}</span></td>
                          <td data-label="Reference">{p.reference || '-'}</td>
                          <td data-label="Collected By">{p.collectedBy?.name}</td>
                          <td data-label="Time" className="fs-12 color-muted">{new Date(p.collectedAt).toLocaleTimeString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Defaulters */}
      {tab === 'defaulters' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title flex items-center gap-8"><AlertTriangle size={18} style={{ color: 'var(--danger-400)' }} />Defaulter List</div>
            <div className="flex-mobile-stack items-center gap-8">
              <span className="badge badge-danger" style={{ justifyContent: 'center' }}>{defaulters.length} overdue</span>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => {
                const rows = defaulters.map(d => ({
                  Customer: d.loan?.customer?.name,
                  Phone: d.loan?.customer?.phone,
                  Address: `${d.loan?.customer?.address}, ${d.loan?.customer?.city}`,
                  Loan: d.loan?.loanNumber,
                  DueDate: formatDate(d.dueDate),
                  DueAmount: d.dueAmount,
                  Agent: d.loan?.agent?.name || '',
                }));
                exportCSV(rows, 'defaulters');
              }}>
                <Download size={14} />Export
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : defaulters.length === 0 ? (
            <div className="empty-state">
              <h3 style={{ color: 'var(--accent-400)' }}>No defaulters!</h3>
              <p>All payments are on track.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Customer</th><th>Phone</th><th>Loan #</th><th>Due Date</th><th>Amount Due</th><th>Agent</th></tr>
                </thead>
                <tbody>
                  {defaulters.map((d, i) => (
                    <tr key={i}>
                      <td data-label="Customer">
                        <div className="flex items-center gap-8">
                          <div className="sidebar-avatar" style={{ width: 30, height: 30, fontSize: 11, background: 'linear-gradient(135deg, var(--danger-600), var(--warning-500))' }}>
                            {d.loan?.customer?.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="fw-600">{d.loan?.customer?.name}</div>
                            <div className="fs-12 color-muted">{d.loan?.customer?.city}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Phone">{d.loan?.customer?.phone}</td>
                      <td data-label="Loan #" className="fw-600">{d.loan?.loanNumber}</td>
                      <td data-label="Due Date" style={{ color: 'var(--danger-400)' }}>{formatDate(d.dueDate)}</td>
                      <td data-label="Amount Due" className="fw-700" style={{ color: 'var(--danger-400)' }}>₹{d.dueAmount?.toLocaleString('en-IN')}</td>
                      <td data-label="Agent">{d.loan?.agent?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
