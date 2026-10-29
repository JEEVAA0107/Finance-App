import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Sun, Moon, Monitor, Globe, Volume2, VolumeX,
  Smartphone, Download, RefreshCw, KeyRound,
  CheckCircle2, Sparkles, Sliders, ShieldCheck, Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import { companiesAPI, usersAPI } from '../services/api';

// Web Audio API Cash / Chime Synthesizer
function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // First tone (E6 ~ 1318 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second harmonic tone (B6 ~ 1975 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1975.5, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.error('Audio play error:', err);
  }
}

export default function SettingsPage() {
  const { user } = useAuth();

  // 1. Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('finova_theme') || 'light');

  // 2. Language state
  const [lang, setLang] = useState(() => localStorage.getItem('finova_lang') || 'en');

  // 3. Sound & Haptics state
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('finova_sound') !== 'false');
  const [hapticEnabled, setHapticEnabled] = useState(() => localStorage.getItem('finova_haptic') !== 'false');

  // 4. Density state
  const [density, setDensity] = useState(() => localStorage.getItem('finova_density') || 'comfortable');

  // 5. Password Modal / State
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Apply Theme
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('finova_theme', newTheme);
    if (newTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    toast.success(`Theme updated: ${newTheme === 'dark' ? 'Dark Mode 🌙' : newTheme === 'light' ? 'Light Mode ☀️' : 'System Auto 💻'}`);
  };

  // Apply Language
  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('finova_lang', newLang);
    toast.success(newLang === 'ta' ? 'மொழி மாற்றப்பட்டது: தமிழ் 🇮🇳' : 'Language set to English 🇬🇧');
  };

  // Toggle Sound
  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('finova_sound', String(next));
    if (next) {
      playChimeSound();
      toast.success('Collection chime sound enabled! 🔔');
    } else {
      toast.success('Sound disabled 🔕');
    }
  };

  // Toggle Haptics
  const handleHapticToggle = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    localStorage.setItem('finova_haptic', String(next));
    if (next && navigator.vibrate) {
      navigator.vibrate(50);
      toast.success('Vibration enabled! 📳');
    } else {
      toast.success('Vibration disabled');
    }
  };

  // Density change
  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('finova_density', newDensity);
    toast.success(`Layout density: ${newDensity === 'compact' ? 'Compact' : 'Comfortable'}`);
  };

  // Test Sound
  const handleTestSound = () => {
    playChimeSound();
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
    toast('🔔 Ding! Payment collection sound', { icon: '💰' });
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setChangingPass(true);
    try {
      await usersAPI.changePassword(user.id, { password: newPassword });
      toast.success('Password updated successfully!');
      setShowPassModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update password');
    } finally {
      setChangingPass(false);
    }
  };

  // Export Data Backup
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const data = await companiesAPI.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finova_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Complete database backup downloaded!');
    } catch (err) {
      toast.error('Failed to export backup: ' + (err.message || 'Error'));
    } finally {
      setExporting(false);
    }
  };

  // Clear Cache
  const handleClearCache = () => {
    localStorage.removeItem('daybook_cache');
    toast.success('Local cache cleared & refreshed!');
  };

  return (
    <div className="animate-in" style={{ paddingBottom: 60, maxWidth: 840, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          {lang === 'ta' ? 'செயலி அமைப்புகள் (App Settings)' : 'Settings & Preferences'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {lang === 'ta' ? 'தோற்றம், தீம், மொழி மற்றும் ஒலி அறிவிப்புகளை உங்கள் விருப்பத்திற்கேற்ப மாற்றவும்' : 'Customize theme, language, audio notifications and display preferences'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 1. THEME & APPEARANCE */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sun size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {lang === 'ta' ? 'தோற்றம் & தீம் (Theme & Appearance)' : 'Theme & Appearance'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ta' ? 'பகல் / இரவு முறையில் செயலியைப் பயன்படுத்தவும்' : 'Select your preferred visual mode'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {/* Light Mode */}
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              style={{
                background: theme === 'light' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                border: theme === 'light' ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                borderRadius: 14,
                padding: '16px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sun size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Light Mode</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>பகல் முறை</div>
              </div>
            </button>

            {/* Dark Mode */}
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              style={{
                background: theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                border: theme === 'dark' ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                borderRadius: 14,
                padding: '16px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Moon size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Dark Mode</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>இரவு முறை</div>
              </div>
            </button>

            {/* System Mode */}
            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              style={{
                background: theme === 'system' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                border: theme === 'system' ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                borderRadius: 14,
                padding: '16px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Monitor size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>System Auto</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>தானியங்கி</div>
              </div>
            </button>
          </div>
        </div>

        {/* 2. APP LANGUAGE & REGIONAL */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {lang === 'ta' ? 'செயலி மொழி (App Language)' : 'Language & Regional'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ta' ? 'தமிழ் அல்லது ஆங்கிலத்தில் தலைப்புகள் காட்டப்படும்' : 'Preferred language for labels & indicators'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={() => handleLangChange('en')}
              style={{
                background: lang === 'en' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                border: lang === 'en' ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '14px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>English</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Primary Interface</div>
            </button>

            <button
              type="button"
              onClick={() => handleLangChange('ta')}
              style={{
                background: lang === 'ta' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                border: lang === 'ta' ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '14px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-600)' }}>தமிழ் (Tamil)</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>தமிழ் மொழி இடைமுகம்</div>
            </button>
          </div>
        </div>

        {/* 3. SOUND EFFECTS & CHIMES */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Volume2 size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {lang === 'ta' ? 'ஒலி விளைவுகள் (Sound Effects)' : 'Audio & Sound Chimes'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {lang === 'ta' ? 'வசூல் பதிவு செய்யும்போது கேட்கும் மணி ஒலி' : 'Payment collection confirmation chime'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleTestSound}
              style={{ gap: 6, fontWeight: 700, borderColor: 'var(--border-default)' }}
            >
              <Volume2 size={15} /> {lang === 'ta' ? 'ஒலியை சோதிக்க (Test Sound)' : 'Play Test Sound'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Sound Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {lang === 'ta' ? 'வசூல் வெற்றி ஒலி (Collection Ding)' : 'Cash Chime on Payment'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {lang === 'ta' ? 'பணம் வசூலானவுடன் தெளிவான மணி ஒலி கேட்கும்' : 'Plays a crystal bell tone upon recording payment'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSoundToggle}
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 14,
                  border: 'none',
                  background: soundEnabled ? 'var(--primary-600)' : 'var(--border-default)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: soundEnabled ? 25 : 3,
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            {/* Haptic Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {lang === 'ta' ? 'மொபைல் அதிர்வு (Mobile Vibration)' : 'Haptic Vibration'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {lang === 'ta' ? 'மொபைலில் வசூலிக்கும்போது அதிர்வு ஏற்படும்' : 'Vibrates on phone when collection is confirmed'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleHapticToggle}
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 14,
                  border: 'none',
                  background: hapticEnabled ? 'var(--primary-600)' : 'var(--border-default)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: hapticEnabled ? 25 : 3,
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* 4. DATA & SYSTEM UTILITIES */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {lang === 'ta' ? 'டேட்டா & பயன்பாடுகள் (Data & Utilities)' : 'Data & Utilities'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ta' ? 'பேக்கப் டவுன்லோட் மற்றும் கணக்கு பாதுகாப்பு' : 'Export complete financial backup & manage account'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {/* Export Backup */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleExportBackup}
              disabled={exporting}
              style={{ justifyContent: 'center', height: 42, gap: 8, fontWeight: 700 }}
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export Complete Backup (JSON)'}
            </button>

            {/* Change Password */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowPassModal(true)}
              style={{ justifyContent: 'center', height: 42, gap: 8, fontWeight: 700 }}
            >
              <KeyRound size={16} /> Change Account Password
            </button>

            {/* Clear Cache */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClearCache}
              style={{ justifyContent: 'center', height: 42, gap: 8, fontWeight: 700 }}
            >
              <RefreshCw size={16} /> Clear Offline Cache
            </button>
          </div>

          {/* Cloud Status Footer */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>Database: <b>Neon PostgreSQL Cloud Serverless</b></span>
            </div>
            <span>Finova Pro v2.4.0</span>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPassModal && (
        <div className="modal-overlay" onClick={() => !changingPass && setShowPassModal(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 17, fontWeight: 800 }}>Change Password</h3>
              <button className="btn btn-ghost" onClick={() => setShowPassModal(false)} disabled={changingPass}>&times;</button>
            </div>
            <form onSubmit={handleChangePassword} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowPassModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={changingPass} style={{ flex: 1 }}>
                  {changingPass ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
