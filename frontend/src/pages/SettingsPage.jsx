import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="animate-in" style={{ maxWidth: 500, margin: '0 auto' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>User ID</span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{user?.id?.substring(0, 8)}...</span>
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', background: 'var(--danger-500)', borderColor: 'var(--danger-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={logout}
      >
        Sign Out
      </button>
    </div>
  );
}
