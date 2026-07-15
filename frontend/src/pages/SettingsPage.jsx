import { useState, useEffect } from 'react';
import { fullSync, getScriptUrl, setScriptUrl, getLastSync } from '../services/sheetsSync';
import { backupDatabase, listBackups, restoreDatabase } from '../services/backup';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { Download, Upload, RefreshCw, CheckCircle, Cloud, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user, isAdmin, logout } = useAuth();
  const [scriptUrl, setScriptUrlState] = useState(getScriptUrl());
  const [lastSync, setLastSync] = useState(getLastSync());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => { if (isNative && isAdmin) loadBackups(); }, []);

  if (!isAdmin) {
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

  const loadBackups = async () => {
    try { const r = await listBackups(); setBackups(r.backups || []); } catch (_) {}
  };

  const handleTest = async () => {
    if (!scriptUrl.trim()) return setSyncMsg('✗ Enter URL first');
    setTesting(true);
    setSyncMsg('Testing connection...');
    try {
      const res = await fetch(`${scriptUrl.trim()}?action=ping`, { method: 'GET' });
      const text = await res.text();
      setSyncMsg(`Raw response (status ${res.status}): ${text.substring(0, 300)}`);
    } catch (err) {
      setSyncMsg(`✗ Fetch failed: ${err.message}`);
    } finally { setTesting(false); }
  };

  const handleSaveAndSync = async () => {
    if (!scriptUrl.trim()) return toast.error('Enter the URL first');
    setScriptUrl(scriptUrl.trim());
    setSyncing(true);
    setSyncMsg('Syncing...');
    try {
      const payload = await fullSync();
      setLastSync(getLastSync());
      setSyncMsg(`✓ ${payload.customers?.length || 0} customers, ${payload.loans?.length || 0} loans, ${payload.payments?.length || 0} payments synced!`);
      toast.success('Synced to Google Sheets!');
    } catch (err) {
      setSyncMsg(`✗ ${err.message}`);
      toast.error(err.message);
    } finally { setSyncing(false); }
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      const res = await backupDatabase();
      toast.success(`✓ Backup saved to Downloads/LoanFlowPro`);
      loadBackups();
    } catch (err) { toast.error(err.message || 'Backup failed'); }
    finally { setBacking(false); }
  };

  const handleRestore = async (path) => {
    if (!confirm('Restore this backup? Current data will be replaced. Restart app after restore.')) return;
    setRestoring(true);
    try {
      await restoreDatabase(path);
      toast.success('✓ Restored! Please restart the app.');
    } catch (err) { toast.error(err.message || 'Restore failed'); }
    finally { setRestoring(false); }
  };

  return (
    <div className="animate-in">
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Settings</div>

      {/* ── Google Sheets Sync ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Cloud size={18} style={{ color: '#34a853' }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Google Sheets Sync</div>
          {lastSync && <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: 10 }}>Last: {lastSync}</span>}
        </div>

        {/* Setup instructions */}
        <div style={{ background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#34a853' }}>📋 One-time Setup:</div>
          <div>1. Open <strong>script.google.com</strong> → New Project</div>
          <div>2. Paste the code from <strong>google-apps-script.js</strong> file</div>
          <div>3. Click <strong>Deploy → New Deployment → Web App</strong></div>
          <div>4. Set <strong>Execute as: Me</strong> | <strong>Access: Anyone</strong></div>
          <div>5. Copy the Web App URL → paste below</div>
        </div>

        <div className="form-group">
          <label className="form-label">Apps Script Web App URL</label>
          <input
            className="form-input"
            placeholder="https://script.google.com/macros/s/..."
            value={scriptUrl}
            onChange={e => setScriptUrlState(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={handleTest}
            disabled={testing || !scriptUrl}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, background: 'linear-gradient(135deg,#34a853,#0f9d58)' }}
            onClick={handleSaveAndSync}
            disabled={syncing || !scriptUrl}
          >
            <Cloud size={16} /> {syncing ? 'Syncing...' : 'Save & Sync'}
          </button>
        </div>

        {syncMsg && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: syncMsg.startsWith('✓') ? 'rgba(52,168,83,0.12)' : 'rgba(234,67,53,0.12)', color: syncMsg.startsWith('✓') ? '#34a853' : '#ea4335', fontSize: 12, wordBreak: 'break-all' }}>
            {syncMsg}
          </div>
        )}

        {!scriptUrl && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Configure the URL above to enable sync
          </div>
        )}
      </div>

      {/* ── How Sheets sync works ── */}
      <div className="card" style={{ marginBottom: 12, background: 'var(--bg-glass)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>What gets synced to Google Sheets</div>
        {[
          ['Customers Sheet', 'All customer names, phones, addresses'],
          ['Loans Sheet', 'All loans with principal, interest, status'],
          ['Payments Sheet', 'Every payment collected with date & amount'],
          ['Summary Sheet', 'Total disbursed, collected, outstanding'],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <CheckCircle size={13} style={{ color: '#34a853', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          💡 App works fully offline. Sync happens automatically when internet is available, or tap "Sync Now" manually.
        </div>
      </div>

      {/* ── Local Backup ── */}
      {isNative && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Shield size={18} style={{ color: 'var(--primary-400)' }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Local Backup</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Saves database to <strong>Downloads/LoanFlowPro</strong> — survives app uninstall.
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={handleBackup} disabled={backing}>
            <Download size={15} /> {backing ? 'Saving...' : 'Backup to Downloads'}
          </button>

          {backups.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Saved Backups</div>
              {backups.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < backups.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{b.date}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(b.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(b.path)} disabled={restoring}>
                    <Upload size={12} /> Restore
                  </button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={loadBackups}>
                <RefreshCw size={13} /> Refresh
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Google Drive Auto Backup ── */}
      <div className="card" style={{ background: 'rgba(66,133,244,0.06)', borderColor: 'rgba(66,133,244,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={16} style={{ color: '#4285f4' }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: '#4285f4' }}>Google Drive Auto Backup</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Android automatically backs up app data to Google Drive when on WiFi. Reinstall the app with the same Google account to restore all data automatically.
        </div>
      </div>
    </div>
  );
}
