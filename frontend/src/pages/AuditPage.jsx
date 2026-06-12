import { useState, useEffect } from 'react';
import { auditAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Shield, Filter } from 'lucide-react';

function formatDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const actionColors = {
  LOGIN: 'badge-info',
  CREATE_CUSTOMER: 'badge-success',
  UPDATE_CUSTOMER: 'badge-warning',
  DELETE_CUSTOMER: 'badge-danger',
  CREATE_LOAN: 'badge-success',
  UPDATE_LOAN_STATUS: 'badge-warning',
  COLLECT_PAYMENT: 'badge-success',
  CREATE_USER: 'badge-info',
  UPDATE_USER: 'badge-warning',
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    auditAPI.list({ page, limit: 30 })
      .then(r => { setLogs(r); setTotal(r.length || 0); })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading audit logs...</p></div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h2>Audit Logs</h2>
        <p>Track all system actions for compliance</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title flex items-center gap-8"><Shield size={18} />Activity Log</div>
          <span className="badge badge-info">{total} total entries</span>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state"><p>No audit logs recorded yet.</p></div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td data-label="Time" className="fs-12">{formatDateTime(log.createdAt)}</td>
                    <td data-label="User">
                      <div className="flex items-center gap-8">
                        <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{log.user?.name?.charAt(0)}</div>
                        <div>
                          <div className="fw-600 fs-14">{log.user?.name}</div>
                          <div className="fs-12 color-muted">{log.user?.role}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Action"><span className={`badge ${actionColors[log.action] || 'badge-muted'}`}>{log.action}</span></td>
                    <td data-label="Entity">{log.entity}</td>
                    <td data-label="Details" className="fs-12 color-secondary truncate" style={{ maxWidth: 200 }}>
                      {log.details ? (() => { try { const d = JSON.parse(log.details); return Object.entries(d).map(([k,v]) => `${k}: ${v}`).join(', '); } catch { return log.details; } })() : '-'}
                    </td>
                    <td data-label="IP" className="fs-12 color-muted">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 30 && (
          <div className="flex items-center justify-between mt-16" style={{ padding: '0 16px' }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="fs-12 color-muted">Page {page} of {Math.ceil(total / 30)}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
