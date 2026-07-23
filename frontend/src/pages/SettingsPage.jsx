import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import { Trash2, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [resetting, setResetting] = useState(false);

  const canReset = isAdmin || isSuperAdmin;

  const handleResetData = async () => {
    if (!window.confirm('⚠️ ARE YOU SURE? This will permanently delete ALL customers, loans, repayments, and collection history from the live database. You can start 100% fresh.')) {
      return;
    }

    setResetting(true);
    try {
      await dashboardAPI.resetAllData();
      toast.success('✓ Database reset successfully! All test data cleared.');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      toast.error('Failed to reset database: ' + (err.response?.data?.message || err.message));
    } finally {
      setResetting(false);
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

      {canReset && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--danger-600)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={18} /> Database Management
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Delete all test customers, active loans, and collection history from the production database to start 100% fresh.
          </div>
          <button
            className="btn"
            style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-600)', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 700 }}
            onClick={handleResetData}
            disabled={resetting}
          >
            {resetting ? 'Resetting Database...' : '🧹 Clear All Database Data (Start Fresh)'}
          </button>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ width: '100%', background: 'var(--danger-500)', borderColor: 'var(--danger-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={logout}
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}
