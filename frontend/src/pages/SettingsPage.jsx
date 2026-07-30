import { useAuth } from '../contexts/AuthContext';
import { LogOut, AlertOctagon } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../services/api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  
  const handleReset = async () => {
    if (window.confirm("Are you ABSOLUTELY sure you want to delete ALL customer and loan data? This cannot be undone!")) {
      if (window.confirm("FINAL WARNING: All loans, repayments, and customers will be permanently deleted. Only users will remain. Proceed?")) {
        try {
          const res = await dashboardAPI.resetAllData();
          toast.success(res.message || "Database has been reset successfully.");
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          toast.error(err.message || 'Reset failed');
        }
      }
    }
  };


  return (
    <div className="animate-in" style={{ maxWidth: 500, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Profile & Settings</div>
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 20px', marginBottom: 16 }}>
        <div className="sidebar-avatar" style={{ width: 80, height: 80, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{user?.email}</div>
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <span className="badge badge-info" style={{ fontSize: 11, padding: '4px 10px' }}>
            Role: {user?.role}
          </span>
          <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 10px' }}>
            Status: Active
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', width: '100%', paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Phone</span>
            <span style={{ fontWeight: 600 }}>{user?.phone || 'N/A'}</span>
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', background: 'var(--danger-500)', borderColor: 'var(--danger-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 30 }}
        onClick={logout}
      >
        <LogOut size={16} /> Sign Out
      </button>

      {/* DANGER ZONE */}
      {['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && (
        <div className="card" style={{ padding: '24px', border: '1px solid var(--danger-500)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger-600)', fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
            <AlertOctagon size={20} />
            Danger Zone
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            This will permanently delete ALL customers, loans, and collections. Only User accounts will remain.
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', background: 'var(--danger-600)', borderColor: 'var(--danger-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handleReset}
          >
            <AlertOctagon size={16} /> Delete All App Data
          </button>
        </div>
      )}
    </div>
  );
}
