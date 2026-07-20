import { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Bell, Send, AlertTriangle, Settings, RefreshCw, CheckCircle } from 'lucide-react';

export default function NotificationsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      notificationsAPI.getDashboard(),
      notificationsAPI.getSettings(),
      notificationsAPI.getHistory(20)
    ]).then(([dashRes, setRes, histRes]) => {
      setDashboard(dashRes);
      setSettings(setRes);
      setHistory(histRes);
    }).catch(err => {
      toast.error('Failed to load notifications data');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSettingChange = (field, value) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    
    // Convert array back to numbers if needed, but in this UI we'll just handle enabled for now
    notificationsAPI.updateSettings({
      enabled: updated.enabled,
      daysBeforeDue: typeof updated.daysBeforeDue === 'string' ? JSON.parse(updated.daysBeforeDue) : updated.daysBeforeDue
    }).then(() => toast.success('Settings updated'))
      .catch(() => toast.error('Failed to update settings'));
  };

  const handleTrigger = () => {
    setTriggering(true);
    notificationsAPI.triggerCron()
      .then(() => {
        toast.success('Manual trigger started. Refreshing in a moment...');
        setTimeout(loadData, 2000);
      })
      .catch(() => toast.error('Trigger failed'))
      .finally(() => setTriggering(false));
  };

  if (loading && !dashboard) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="animate-in pb-20">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Notification Center</div>
        <button onClick={handleTrigger} disabled={triggering} className="btn btn-primary btn-sm">
          <RefreshCw size={14} className={triggering ? 'spin' : ''} />
          Force Send Now
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-title">Due Today</div>
          <div className="stat-value">{dashboard?.dueToday || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Upcoming (7 days)</div>
          <div className="stat-value">{dashboard?.upcoming || 0}</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--danger-500)', backgroundColor: 'var(--danger-50)' }}>
          <div className="stat-title" style={{ color: 'var(--danger-600)' }}>Overdue</div>
          <div className="stat-value text-danger">{dashboard?.overdue || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Sent Total</div>
          <div className="stat-value" style={{ color: 'var(--success-600)' }}>{dashboard?.sent || 0}</div>
        </div>
      </div>

      {/* Settings */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 700 }}>
          <Settings size={18} /> Global Reminder Settings
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Enable Automated Reminders</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sends WhatsApp/App notifications automatically at 8:00 AM</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={settings?.enabled || false} onChange={e => handleSettingChange('enabled', e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div style={{ padding: '12px 0' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Days Before Due Date (Raw JSON)</div>
          <input 
            type="text" 
            className="form-input" 
            value={typeof settings?.daysBeforeDue === 'string' ? settings.daysBeforeDue : JSON.stringify(settings?.daysBeforeDue)}
            onChange={e => setSettings({...settings, daysBeforeDue: e.target.value})}
            onBlur={e => handleSettingChange('daysBeforeDue', JSON.parse(e.target.value))}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Example: [0, 1] means send on Same Day (0) and 1 Day Before (1). Use negative for overdue e.g., [-1]</div>
        </div>
      </div>

      {/* History */}
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Recent Notifications</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No notifications sent yet.</div>
        ) : (
          <table className="table">
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
                    {log.status === 'SENT' ? <span className="badge badge-success">SENT</span> : <span className="badge badge-danger">FAILED</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(log.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
