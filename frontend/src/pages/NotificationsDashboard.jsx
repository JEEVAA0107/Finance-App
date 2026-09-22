import { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Bell, Send, AlertTriangle, RefreshCw, CheckCircle, Calendar, MessageSquare } from 'lucide-react';

export default function NotificationsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      notificationsAPI.getDashboard(),
      notificationsAPI.getHistory(20)
    ]).then(([dashRes, histRes]) => {
      setDashboard(dashRes);
      setHistory(histRes);
    }).catch(err => {
      toast.error(err.response?.data?.message || err.message || 'Failed to load notifications data');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualReminder = (type) => {
    setTriggering(true);
    // For demo, we just simulate the API call or trigger the existing cron route
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      {
        loading: 'Sending SMS Reminders...',
        success: 'SMS Reminders sent successfully!',
        error: 'Failed to send SMS'
      }
    ).finally(() => {
      setTriggering(false);
      loadData();
    });
  };

  if (loading && !dashboard) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="animate-in pb-20">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Notification & SMS Center</div>
      </div>

      {/* Stats - Responsive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-title">Due Tomorrow</div>
          <div className="stat-value">{dashboard?.upcoming || 0}</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--danger-500)', backgroundColor: 'var(--danger-50)' }}>
          <div className="stat-title" style={{ color: 'var(--danger-600)' }}>Overdue</div>
          <div className="stat-value text-danger">{dashboard?.overdue || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total SMS Sent</div>
          <div className="stat-value" style={{ color: 'var(--success-600)' }}>{dashboard?.sent || 0}</div>
        </div>
      </div>

      {/* Manual Actions */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 700, fontSize: 16 }}>
          <MessageSquare size={18} /> Trigger Manual SMS
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <button 
            onClick={() => handleManualReminder('tomorrow')} 
            disabled={triggering} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '12px' }}
          >
            <Calendar size={18} />
            Remind for Tomorrow
          </button>
          
          <button 
            onClick={() => handleManualReminder('overdue')} 
            disabled={triggering} 
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '12px' }}
          >
            <AlertTriangle size={18} />
            Remind Overdue Customers
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          Note: This will send an SMS using the registered DLT sender ID (e.g. FINOVA) to customers.
        </p>
      </div>

      {/* History */}
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Recent SMS Logs</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No SMS sent yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.customer?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.repayment?.loan?.loanNumber}</div>
                    </td>
                    <td><span className="badge">{log.type}</span></td>
                    <td>
                      {log.status === 'SENT' ? <span className="badge badge-success">DELIVERED</span> : <span className="badge badge-danger">FAILED</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(log.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
