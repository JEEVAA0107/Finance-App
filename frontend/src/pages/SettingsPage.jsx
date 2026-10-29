import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  User, Lock, Building2, Printer, LogOut, Save,
  AlertOctagon, CheckCircle2, Phone, MapPin, Shield,
  Percent, HandCoins, Landmark, Calendar, Clock,
  Receipt, QrCode, Bell, ShieldCheck, Download,
  FileSpreadsheet, RefreshCw, Eye, Sparkles, AlertTriangle,
  Check, ChevronRight, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI, dashboardAPI, companiesAPI } from '../services/api';

// Comprehensive Financial Application Default Settings
const DEFAULT_FINANCIAL_SETTINGS = {
  // 1. Company & Shop Profile
  company: {
    name: 'Sri Murugan Finance',
    tagline: 'Microfinance & Daily Loan Services (தினசரி & வாரக் கடன் நிறுவனம்)',
    regNo: 'TN/CBE/MFI-2024-8841',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    address: 'Main Road, Coimbatore, Tamil Nadu',
    currencySymbol: '₹',
    financialYearStart: '04-01', // April 1st
  },

  // 2. Loan & Credit Policies
  loanPolicy: {
    defaultLoanModel: 'WITHOUT_INTEREST', // 'WITHOUT_INTEREST' (Deduction/பிடித்தம்) | 'FLAT_RATE' | 'EMI' | 'INTEREST_ONLY'
    defaultFrequency: 'DAILY', // 'DAILY' | 'WEEKLY' | 'MONTHLY'
    defaultDailyTenure: 100, // 100 Days Daily
    defaultWeeklyTenure: 10, // 10 Weeks
    defaultMonthlyTenure: 12, // 12 Months
    defaultInterestRate: 2.0, // 2% per month
    defaultProcessingFee: 10, // 10% advance deduction
    minLoanAmount: 5000,
    maxLoanAmount: 500000,
    allowPreclosure: true,
    preclosureDiscountRate: 5.0, // 5% discount on early foreclosure
    requireApprovalForPreclosure: true,
  },

  // 3. Penalty & Overdue Late Fees
  penaltyPolicy: {
    enablePenalty: true,
    gracePeriodDays: 2, // 2 days grace period
    penaltyType: 'FIXED_PER_INSTALLMENT', // 'FIXED_PER_INSTALLMENT' | 'FIXED_DAILY' | 'PERCENTAGE'
    penaltyAmount: 50, // ₹50 per missed installment
    maxPenaltyCap: 500, // Maximum penalty cap per installment
    autoCarryForwardPenalty: true,
    requireApprovalForWaiver: true,
  },

  // 4. Collection & Field Agent Rules
  collectionPolicy: {
    windowStartTime: '06:00',
    windowEndTime: '21:30',
    restrictOutsideHours: false,
    sundayPolicy: 'EXCLUDE_SUNDAYS', // 'EXCLUDE_SUNDAYS' (Skip Sunday) | 'INCLUDE_SUNDAYS'
    holidayRollover: 'POSTPONE_NEXT_DAY', // 'POSTPONE_NEXT_DAY' | 'ADVANCE_PREVIOUS_DAY'
    maxAgentCashInHand: 50000, // ₹50,000 max before deposit to cash drawer
    allowPartialPayment: true,
    allowAdvancePayment: true,
    requireCustomerSignature: false,
    requireGpsGeotag: false,
  },

  // 5. Thermal Receipt & Print Configuration
  receiptPolicy: {
    printerType: '58mm', // '58mm' | '80mm' | 'A4'
    printCopies: 1, // 1 or 2 (Customer + Office)
    autoOpenPrintDialog: false,
    headerTitle: 'SRI MURUGAN FINANCE',
    subHeader: 'Daily & Weekly Microfinance',
    footerNote: 'நன்றி! கடன் தொகையை குறித்த நாளில் செலுத்தி நற்பெயர் பெறவும்.',
    englishFooter: 'Thank you for your prompt repayment! Keep this slip safe.',
    showAgentDetails: true,
    showCustomerAddress: true,
    showOutstandingBalance: true,
    showNextDueDate: true,
    enableUpiQr: true,
    upiVpa: 'srimurugan@oksbi',
  },

  // 6. Customer Alerts & Notifications
  notificationPolicy: {
    whatsappOnPayment: true,
    smsOnPayment: false,
    disbursementWelcomeAlert: true,
    dueReminderDaysBefore: 1, // 1 day before due date
    enableDueReminder: true,
    overdueWarningDaysAfter: 3, // 3 days after due date
    enableOverdueWarning: true,
    closureClearanceAlert: true,
  },

  // 7. Security, Daybook & Audit
  securityPolicy: {
    sessionTimeoutMins: 60, // 60 mins inactivity auto-logout
    strictDaybookBalancing: false, // Must close daybook before next day loans
    highValuePinThreshold: 50000, // Require confirmation for > ₹50,000
    requireApprovalForDeletion: true,
  }
};

export default function SettingsPage() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('loanPolicy');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const receiptPrintRef = useRef(null);

  // Financial Settings State (Loaded from localStorage + synchronized with backend API)
  const [finSettings, setFinSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('finova_financial_settings') || localStorage.getItem('finance_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_FINANCIAL_SETTINGS,
          ...parsed,
          company: {
            ...DEFAULT_FINANCIAL_SETTINGS.company,
            ...(parsed.company || {}),
            name: parsed.companyName || parsed.company?.name || user?.company?.name || DEFAULT_FINANCIAL_SETTINGS.company.name,
            phone: parsed.businessPhone || parsed.company?.phone || user?.company?.phone || user?.phone || '',
            address: parsed.address || parsed.company?.address || user?.company?.address || DEFAULT_FINANCIAL_SETTINGS.company.address,
          },
          receiptPolicy: {
            ...DEFAULT_FINANCIAL_SETTINGS.receiptPolicy,
            ...(parsed.receiptPolicy || {}),
            headerTitle: parsed.receiptTitle || parsed.receiptPolicy?.headerTitle || DEFAULT_FINANCIAL_SETTINGS.receiptPolicy.headerTitle,
            footerNote: parsed.receiptFooter || parsed.receiptPolicy?.footerNote || DEFAULT_FINANCIAL_SETTINGS.receiptPolicy.footerNote,
            printerType: parsed.printerSize || parsed.receiptPolicy?.printerType || DEFAULT_FINANCIAL_SETTINGS.receiptPolicy.printerType,
          }
        };
      }
    } catch (_) {}
    return {
      ...DEFAULT_FINANCIAL_SETTINGS,
      company: {
        ...DEFAULT_FINANCIAL_SETTINGS.company,
        name: user?.company?.name || DEFAULT_FINANCIAL_SETTINGS.company.name,
        phone: user?.company?.phone || user?.phone || '',
        address: user?.company?.address || DEFAULT_FINANCIAL_SETTINGS.company.address,
      }
    };
  });

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Reset Records Danger Confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetting, setResetting] = useState(false);

  // Load latest settings from backend on component mount
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
      });
    }

    companiesAPI.getMySettings()
      .then(res => {
        if (res && res.company) {
          setFinSettings(prev => {
            const serverSettings = res.settings || {};
            const merged = {
              ...prev,
              ...serverSettings,
              company: {
                ...prev.company,
                ...(serverSettings.company || {}),
                name: res.company.name || prev.company.name,
                phone: res.company.phone || prev.company.phone,
                address: res.company.address || prev.company.address,
                regNo: res.company.code || prev.company.regNo,
              }
            };
            try {
              localStorage.setItem('finova_financial_settings', JSON.stringify(merged));
              // Also sync backwards compatibility keys
              localStorage.setItem('finance_app_settings', JSON.stringify({
                companyName: merged.company.name,
                businessPhone: merged.company.phone,
                address: merged.company.address,
                receiptTitle: merged.receiptPolicy.headerTitle,
                receiptFooter: merged.receiptPolicy.footerNote,
                printerSize: merged.receiptPolicy.printerType,
              }));
            } catch (_) {}
            return merged;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInitial(false));
  }, [user]);

  // Nested setting updater
  const updateNestedSetting = (category, field, value) => {
    setFinSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  // Save all financial settings to both localStorage and backend database
  const handleSaveAllSettings = async () => {
    setSavingSettings(true);
    try {
      // 1. Save to local storage for immediate offline/client-side access
      localStorage.setItem('finova_financial_settings', JSON.stringify(finSettings));
      localStorage.setItem('finance_app_settings', JSON.stringify({
        companyName: finSettings.company.name,
        businessPhone: finSettings.company.phone,
        address: finSettings.company.address,
        receiptTitle: finSettings.receiptPolicy.headerTitle,
        receiptFooter: finSettings.receiptPolicy.footerNote,
        printerSize: finSettings.receiptPolicy.printerType,
      }));

      // 2. Persist to Backend PostgreSQL Company profile & JSON settings
      if (isAdmin || isSuperAdmin) {
        await companiesAPI.updateMySettings({
          companyName: finSettings.company.name,
          phone: finSettings.company.phone,
          address: finSettings.company.address,
          ownerName: finSettings.company.ownerName || user?.name,
          settings: finSettings
        });
      }

      toast.success('Financial settings saved & synced successfully!');
    } catch (err) {
      console.warn('Backend sync note:', err.message);
      // Even if network fails, local save succeeded
      toast.success('Settings saved to local system storage!');
    } finally {
      setSavingSettings(false);
    }
  };

  // Export full JSON database backup
  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      const backupData = await companiesAPI.exportBackup();
      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const filename = `Finova_Backup_${(finSettings.company.name || 'Company').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Complete database backup downloaded!');
    } catch (err) {
      toast.error('Failed to export backup: ' + (err.message || 'Server error'));
    } finally {
      setExportingBackup(false);
    }
  };

  // Update User Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return toast.error('Name is required');
    if (!profileForm.phone.trim()) return toast.error('Phone number is required');

    setUpdatingProfile(true);
    try {
      await usersAPI.update(user.id, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        u.name = profileForm.name.trim();
        u.phone = profileForm.phone.trim();
        localStorage.setItem('user', JSON.stringify(u));
      }
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setUpdatingPassword(true);
    try {
      await usersAPI.changePassword(user.id, { password: passwordForm.newPassword });
      toast.success('Password changed successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Danger: Reset Application Data
  const handleResetData = async () => {
    if (resetConfirmationText !== 'RESET RECORDS') {
      return toast.error('Please type "RESET RECORDS" exactly to confirm.');
    }
    setResetting(true);
    try {
      const res = await dashboardAPI.resetAllData();
      toast.success(res.message || 'All customer & loan records have been reset.');
      setShowResetConfirm(false);
      setResetConfirmationText('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  // Test Print Thermal Slip
  const handleTestPrintSlip = () => {
    if (!receiptPrintRef.current) return;
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return toast.error('Pop-up blocked. Please allow pop-ups to print.');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Thermal Receipt Test</title>
          <style>
            @page { margin: 0; size: auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${finSettings.receiptPolicy.printerType === '80mm' ? '76mm' : '54mm'};
              margin: 0 auto;
              padding: 10px 4px;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${receiptPrintRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Tabs Definition
  const tabs = [
    {
      id: 'loanPolicy',
      label: 'Loan & Credit Policy',
      tamilLabel: 'கடன் & வட்டி விதிமுறைகள்',
      icon: Landmark,
      badge: 'Core Policy'
    },
    {
      id: 'collectionPolicy',
      label: 'Collection & Route',
      tamilLabel: 'வசூல் & முகவர் கட்டுப்பாடுகள்',
      icon: HandCoins,
      badge: 'Operations'
    },
    {
      id: 'receiptPolicy',
      label: 'Receipt & Thermal Print',
      tamilLabel: 'ரசீது & அச்சு வடிவமைப்பு',
      icon: Receipt,
      badge: 'Billing'
    },
    {
      id: 'notificationPolicy',
      label: 'Alerts & WhatsApp',
      tamilLabel: 'வாடிக்கையாளர் அறிவிப்புகள்',
      icon: Bell,
      badge: 'Messaging'
    },
    {
      id: 'securityPolicy',
      label: 'Security & Backup',
      tamilLabel: 'பாதுகாப்பு & கணக்கு தணிக்கை',
      icon: ShieldCheck,
      badge: 'Admin'
    },
    {
      id: 'company',
      label: 'Company Profile',
      tamilLabel: 'நிறுவன விவரங்கள்',
      icon: Building2,
      badge: 'Profile'
    },
    {
      id: 'account',
      label: 'My Account & Password',
      tamilLabel: 'சுயவிவரம் & கடவுச்சொல்',
      icon: User,
      badge: 'User'
    },
  ];

  return (
    <div className="animate-in" style={{ maxWidth: 1160, margin: '0 auto', paddingBottom: 80 }}>
      {/* ─── Top Header Section ─── */}
      <div className="settings-header-section" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 18,
        borderBottom: '1px solid var(--border-default)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <Landmark size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                Financial Settings (நிதி மற்றும் அமைப்புகள்)
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Configure credit rules, collection boundaries, thermal receipts, customer alerts & enterprise security
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="settings-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(isAdmin || isSuperAdmin) && (
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="btn btn-ghost btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
              }}
              title="Download entire database backup as encrypted JSON"
            >
              <Download size={14} className={exportingBackup ? 'spin' : ''} />
              {exportingBackup ? 'Backing Up...' : 'Export Backup (JSON)'}
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAllSettings}
            disabled={savingSettings}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 800,
              padding: '8px 18px',
              borderRadius: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Save size={15} className={savingSettings ? 'spin' : ''} />
            {savingSettings ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* ─── Modern Tab Navigation Bar ─── */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 24,
        borderBottom: '1px solid var(--border-subtle)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                borderRadius: 10,
                border: isActive ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid transparent',
                background: isActive ? 'var(--primary-50, #eff6ff)' : 'transparent',
                color: isActive ? 'var(--primary-700, #1d4ed8)' : 'var(--text-secondary, #475569)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease-in-out',
                boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.08)' : 'none'
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--primary-600)' : 'var(--text-muted)' }} />
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 999,
                background: isActive ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-tertiary, #f1f5f9)',
                color: isActive ? 'var(--primary-700)' : 'var(--text-muted)',
                fontWeight: 700
              }}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 1: LOAN & CREDIT POLICY (கடன் & வட்டி விதிமுறைகள்)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'loanPolicy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card 1: Default Loan Scheme & Calculation Method */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Percent size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Default Loan Model (இயல்புநிலை கடன் முறை)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Choose how loans are calculated by default when creating new loans in the system
                </div>
              </div>
            </div>

            {/* Visual Loan Model Selector Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                {
                  id: 'WITHOUT_INTEREST',
                  title: 'Deduction Based (கடன் பிடித்தம்)',
                  desc: 'Advance deduction/file charge cut upfront. Borrower repays full principal in fixed daily/weekly installments.',
                  tag: 'Most Popular for Thandal'
                },
                {
                  id: 'FLAT_RATE',
                  title: 'Flat Interest Rate (நிலையான வட்டி)',
                  desc: 'Fixed % interest calculated across total principal and distributed equally over loan tenure.',
                  tag: 'Fixed Rate'
                },
                {
                  id: 'EMI',
                  title: 'Reducing Balance EMI (குறைந்துவரும்)',
                  desc: 'Monthly diminishing compound interest. Interest decreases as principal gets repaid.',
                  tag: 'Standard Banking'
                },
                {
                  id: 'INTEREST_ONLY',
                  title: 'Interest Only / Monthly (வட்டி மட்டும்)',
                  desc: 'Customer pays interest monthly or weekly; complete principal settled upon loan termination.',
                  tag: 'Flexible Tenure'
                }
              ].map(model => {
                const isSelected = finSettings.loanPolicy.defaultLoanModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => updateNestedSetting('loanPolicy', 'defaultLoanModel', model.id)}
                    style={{
                      border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--border-default)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-secondary)',
                      borderRadius: 12,
                      padding: 14,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isSelected ? 'var(--primary-600)' : 'var(--bg-tertiary)',
                        color: isSelected ? '#fff' : 'var(--text-muted)'
                      }}>
                        {model.tag}
                      </span>
                      {isSelected && <Check size={16} style={{ color: 'var(--primary-600)' }} />}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{model.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{model.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Repayment Frequency & Default Tenures */}
            <div style={{
              background: 'var(--bg-tertiary, #f8fafc)',
              borderRadius: 12,
              padding: 16,
              border: '1px solid var(--border-subtle)',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                Default Tenure & Repayment Intervals (தவணை கால அளவு)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Default Repayment Frequency
                  </label>
                  <select
                    className="form-input"
                    value={finSettings.loanPolicy.defaultFrequency}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultFrequency', e.target.value)}
                  >
                    <option value="DAILY">Daily Repayment (தினசரி தவணை)</option>
                    <option value="WEEKLY">Weekly Repayment (வாரத் தவணை)</option>
                    <option value="MONTHLY">Monthly Repayment (மாதத் தவணை)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Default Daily Tenure (Days / நாட்கள்)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={finSettings.loanPolicy.defaultDailyTenure}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultDailyTenure', parseInt(e.target.value) || 0)}
                    placeholder="e.g. 100"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    Typically 100 days (100 நாள் கடன்)
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Default Weekly Tenure (Weeks / வாரங்கள்)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={finSettings.loanPolicy.defaultWeeklyTenure}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultWeeklyTenure', parseInt(e.target.value) || 0)}
                    placeholder="e.g. 10"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    Typically 10 to 15 weeks
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Default Monthly Tenure (Months / மாதங்கள்)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={finSettings.loanPolicy.defaultMonthlyTenure}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultMonthlyTenure', parseInt(e.target.value) || 0)}
                    placeholder="e.g. 12"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    Typically 12 to 24 months
                  </div>
                </div>
              </div>
            </div>

            {/* Interest Rates & Loan Slabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Default Monthly Interest Rate (%)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={finSettings.loanPolicy.defaultInterestRate}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultInterestRate', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 2.0"
                  />
                  <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                    %/mo
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Default Upfront Deduction / Fee (%)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={finSettings.loanPolicy.defaultProcessingFee}
                    onChange={e => updateNestedSetting('loanPolicy', 'defaultProcessingFee', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 10.0"
                  />
                  <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                    %
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  File charges / advance cut upfront
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Min Loan Limit ({finSettings.company.currencySymbol})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={finSettings.loanPolicy.minLoanAmount}
                  onChange={e => updateNestedSetting('loanPolicy', 'minLoanAmount', parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Max Loan Limit ({finSettings.company.currencySymbol})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={finSettings.loanPolicy.maxLoanAmount}
                  onChange={e => updateNestedSetting('loanPolicy', 'maxLoanAmount', parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 500000"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Late Payment Penalty & Overdue Rules */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(217, 119, 6, 0.1)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    Late Payment Penalty & Overdue Fine (தாமத அபராதக் கொள்கை)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Automatic penalty computation for defaulted/missed installment payments
                  </div>
                </div>
              </div>

              {/* Master Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={finSettings.penaltyPolicy.enablePenalty}
                  onChange={e => updateNestedSetting('penaltyPolicy', 'enablePenalty', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary-600)' }}
                />
                <span>Enable Overdue Penalty</span>
              </label>
            </div>

            {finSettings.penaltyPolicy.enablePenalty && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Grace Period (சலுகை நாட்கள்)
                  </label>
                  <select
                    className="form-input"
                    value={finSettings.penaltyPolicy.gracePeriodDays}
                    onChange={e => updateNestedSetting('penaltyPolicy', 'gracePeriodDays', parseInt(e.target.value) || 0)}
                  >
                    <option value="0">0 Days (Penalty immediately on next day)</option>
                    <option value="1">1 Day Grace Period</option>
                    <option value="2">2 Days Grace Period</option>
                    <option value="3">3 Days Grace Period</option>
                    <option value="5">5 Days Grace Period</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Penalty Calculation Type
                  </label>
                  <select
                    className="form-input"
                    value={finSettings.penaltyPolicy.penaltyType}
                    onChange={e => updateNestedSetting('penaltyPolicy', 'penaltyType', e.target.value)}
                  >
                    <option value="FIXED_PER_INSTALLMENT">Fixed Fine per Missed Installment (₹)</option>
                    <option value="FIXED_DAILY">Fixed Fine per Overdue Day (₹/day)</option>
                    <option value="PERCENTAGE">Percentage of Overdue Amount (%/month)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Penalty Fine Amount ({finSettings.company.currencySymbol})
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={finSettings.penaltyPolicy.penaltyAmount}
                    onChange={e => updateNestedSetting('penaltyPolicy', 'penaltyAmount', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 50"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Max Penalty Cap ({finSettings.company.currencySymbol})
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={finSettings.penaltyPolicy.maxPenaltyCap}
                    onChange={e => updateNestedSetting('penaltyPolicy', 'maxPenaltyCap', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 500"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    Upper ceiling limit to protect borrowers
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.penaltyPolicy.autoCarryForwardPenalty}
                  onChange={e => updateNestedSetting('penaltyPolicy', 'autoCarryForwardPenalty', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Automatically carry forward unpaid late penalty to next installment</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.penaltyPolicy.requireApprovalForWaiver}
                  onChange={e => updateNestedSetting('penaltyPolicy', 'requireApprovalForWaiver', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Require Admin Supervisor Approval to waive overdue penalties</span>
              </label>
            </div>
          </div>

          {/* Card 3: Pre-closure & Foreclosure Rebate */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Pre-closure & Settlement Policy (முன்கூட்டியே கடன் முடித்தல்)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Set incentives and rebate rules for customers settling loans prior to scheduled maturity
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Pre-closure Rebate / Discount (%)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={finSettings.loanPolicy.preclosureDiscountRate}
                    onChange={e => updateNestedSetting('loanPolicy', 'preclosureDiscountRate', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 5.0"
                  />
                  <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                    %
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Discount on remaining unaccrued interest
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={finSettings.loanPolicy.allowPreclosure}
                    onChange={e => updateNestedSetting('loanPolicy', 'allowPreclosure', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                  />
                  <span>Allow Borrower Loan Pre-closure in App</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={finSettings.loanPolicy.requireApprovalForPreclosure}
                    onChange={e => updateNestedSetting('loanPolicy', 'requireApprovalForPreclosure', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                  />
                  <span>Require Admin Approval for early pre-closure discount</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2: COLLECTION & ROUTE (வசூல் & முகவர் கட்டுப்பாடுகள்)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'collectionPolicy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Working Hours & Sunday Policy */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Collection Operational Hours & Sundays (வசூல் நேர வரம்புகள்)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Set daily collection time windows and determine whether Sunday is skipped in daily loan schedules
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Daily Collection Start Time
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={finSettings.collectionPolicy.windowStartTime}
                  onChange={e => updateNestedSetting('collectionPolicy', 'windowStartTime', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Daily Collection Cut-off Time
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={finSettings.collectionPolicy.windowEndTime}
                  onChange={e => updateNestedSetting('collectionPolicy', 'windowEndTime', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Sunday Collection Schedule
                </label>
                <select
                  className="form-input"
                  value={finSettings.collectionPolicy.sundayPolicy}
                  onChange={e => updateNestedSetting('collectionPolicy', 'sundayPolicy', e.target.value)}
                >
                  <option value="EXCLUDE_SUNDAYS">Exclude Sundays (Skip Sunday - 100 working days)</option>
                  <option value="INCLUDE_SUNDAYS">Include Sundays (All 7 days continuous collection)</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Excluding Sundays automatically shifts Sunday installments to Monday
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Public Holiday Rollover
                </label>
                <select
                  className="form-input"
                  value={finSettings.collectionPolicy.holidayRollover}
                  onChange={e => updateNestedSetting('collectionPolicy', 'holidayRollover', e.target.value)}
                >
                  <option value="POSTPONE_NEXT_DAY">Postpone to Next Working Day (அடுத்த வேலை நாள்)</option>
                  <option value="ADVANCE_PREVIOUS_DAY">Advance to Previous Day (முந்தைய நாள்)</option>
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={finSettings.collectionPolicy.restrictOutsideHours}
                onChange={e => updateNestedSetting('collectionPolicy', 'restrictOutsideHours', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
              />
              <span>Prevent field agents from recording collections outside the operational hours</span>
            </label>
          </div>

          {/* Field Agent Cash Limits & Safeguards */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <HandCoins size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Field Agent Rules & Cash Controls (முகவர் பண விதிமுறைகள்)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Cash-in-hand safety thresholds and collection flexibility options for field staff
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Max Cash-in-Hand Threshold ({finSettings.company.currencySymbol})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={finSettings.collectionPolicy.maxAgentCashInHand}
                  onChange={e => updateNestedSetting('collectionPolicy', 'maxAgentCashInHand', parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 50000"
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Warning triggered when agent carries cash above this limit before daybook deposit
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.collectionPolicy.allowPartialPayment}
                  onChange={e => updateNestedSetting('collectionPolicy', 'allowPartialPayment', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Allow agents to record partial installment collection (பகுதித் தொகை)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.collectionPolicy.allowAdvancePayment}
                  onChange={e => updateNestedSetting('collectionPolicy', 'allowAdvancePayment', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Allow agents to accept advance / future installments (முன்பணம்)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.collectionPolicy.requireCustomerSignature}
                  onChange={e => updateNestedSetting('collectionPolicy', 'requireCustomerSignature', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Require digital customer signature pad on payment confirmation</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.collectionPolicy.requireGpsGeotag}
                  onChange={e => updateNestedSetting('collectionPolicy', 'requireGpsGeotag', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Mandatory GPS location capture during collection recording</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 3: RECEIPT & THERMAL PRINT (ரசீது & அச்சு வடிவமைப்பு)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'receiptPolicy' && (
        <div className="settings-receipt-grid">
          {/* Left: Receipt Settings Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 22, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Printer size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Thermal Printer & Header (அச்சு அமைப்புகள்)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Support for 58mm Bluetooth handheld POS, 80mm desktop thermal and standard vouchers
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Hardware Printer Type
                  </label>
                  <select
                    className="form-input"
                    value={finSettings.receiptPolicy.printerType}
                    onChange={e => updateNestedSetting('receiptPolicy', 'printerType', e.target.value)}
                  >
                    <option value="58mm">58mm (2-inch Handheld Bluetooth POS)</option>
                    <option value="80mm">80mm (3-inch Desktop Thermal POS)</option>
                    <option value="A4">A4 / A5 Standard Page Voucher</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                    Print Copies Count
                  </label>
                  <select
                    className="form-input"
                    value={finSettings.receiptPolicy.printCopies}
                    onChange={e => updateNestedSetting('receiptPolicy', 'printCopies', parseInt(e.target.value) || 1)}
                  >
                    <option value="1">1 Copy (Customer Receipt)</option>
                    <option value="2">2 Copies (Customer + Office Duplicate)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Receipt Header Title (ரசீது தலைப்பு) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={finSettings.receiptPolicy.headerTitle}
                  onChange={e => updateNestedSetting('receiptPolicy', 'headerTitle', e.target.value)}
                  placeholder="e.g. SRI MURUGAN FINANCE"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Sub-Header / Tagline
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={finSettings.receiptPolicy.subHeader}
                  onChange={e => updateNestedSetting('receiptPolicy', 'subHeader', e.target.value)}
                  placeholder="e.g. Daily & Weekly Microfinance Services"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Receipt Footer Note (Tamil / English)
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={finSettings.receiptPolicy.footerNote}
                  onChange={e => updateNestedSetting('receiptPolicy', 'footerNote', e.target.value)}
                  placeholder="Thank you message or terms..."
                />
              </div>

              {/* Toggles on Receipt Content */}
              <div style={{
                background: 'var(--bg-tertiary, #f8fafc)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>
                  Show / Hide Receipt Line Items:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.showAgentDetails}
                      onChange={e => updateNestedSetting('receiptPolicy', 'showAgentDetails', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Print Collecting Agent Name</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.showCustomerAddress}
                      onChange={e => updateNestedSetting('receiptPolicy', 'showCustomerAddress', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Print Customer Address & Phone</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.showOutstandingBalance}
                      onChange={e => updateNestedSetting('receiptPolicy', 'showOutstandingBalance', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Print Remaining Loan Balance</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.showNextDueDate}
                      onChange={e => updateNestedSetting('receiptPolicy', 'showNextDueDate', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Print Next Due Date & Amount</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.autoOpenPrintDialog}
                      onChange={e => updateNestedSetting('receiptPolicy', 'autoOpenPrintDialog', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Auto-open print window on payment</span>
                  </label>
                </div>
              </div>

              {/* Dynamic UPI QR Code Configuration */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={16} style={{ color: 'var(--primary-600)' }} />
                    <span style={{ fontSize: 14, fontWeight: 800 }}>Dynamic UPI QR Code on Receipt</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={finSettings.receiptPolicy.enableUpiQr}
                      onChange={e => updateNestedSetting('receiptPolicy', 'enableUpiQr', e.target.checked)}
                      style={{ accentColor: 'var(--primary-600)' }}
                    />
                    <span>Include UPI QR</span>
                  </label>
                </div>

                {finSettings.receiptPolicy.enableUpiQr && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                      Company UPI VPA ID (e.g. GooglePay / PhonePe / Paytm / Bank VPA)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={finSettings.receiptPolicy.upiVpa}
                      onChange={e => updateNestedSetting('receiptPolicy', 'upiVpa', e.target.value)}
                      placeholder="e.g. srimurugan@oksbi or 9876543210@paytm"
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      Prints a scannable UPI QR code on the receipt so customer can scan and pay via GPay / PhonePe
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Real-time Live Thermal Slip Preview */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
                Live Thermal Slip Preview ({finSettings.receiptPolicy.printerType})
              </div>
              <button
                type="button"
                onClick={handleTestPrintSlip}
                className="btn btn-ghost btn-xs"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid var(--border-default)'
                }}
              >
                <Printer size={12} /> Test Print
              </button>
            </div>

            {/* Thermal Receipt Paper Effect */}
            <div style={{
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.07)',
              padding: '16px 14px',
              fontFamily: "'Courier New', Courier, monospace",
              color: '#1e293b',
              fontSize: 11,
              lineHeight: 1.35,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Paper serrated top effect */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundImage: 'radial-gradient(circle, #f1f5f9 2px, transparent 2px)',
                backgroundSize: '8px 4px'
              }} />

              {/* Printable Content Hook */}
              <div ref={receiptPrintRef}>
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>
                    {finSettings.receiptPolicy.headerTitle || 'SRI MURUGAN FINANCE'}
                  </div>
                  {finSettings.receiptPolicy.subHeader && (
                    <div style={{ fontSize: 10, color: '#64748b' }}>{finSettings.receiptPolicy.subHeader}</div>
                  )}
                  {finSettings.company.regNo && (
                    <div style={{ fontSize: 9, color: '#64748b' }}>Reg: {finSettings.company.regNo}</div>
                  )}
                  {finSettings.company.phone && (
                    <div style={{ fontSize: 10 }}>Ph: {finSettings.company.phone}</div>
                  )}
                  {finSettings.company.address && (
                    <div style={{ fontSize: 9, color: '#64748b' }}>{finSettings.company.address}</div>
                  )}
                </div>

                <div style={{ borderTop: '1px dashed #94a3b8', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>RCPT: #REC-2026-0914</span>
                  <span>{new Date().toLocaleDateString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>TIME: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>MODE: CASH</span>
                </div>

                <div style={{ borderTop: '1px dashed #94a3b8', margin: '6px 0' }} />

                <div>
                  <div><strong>CUST:</strong> K. Ramachandran</div>
                  {finSettings.receiptPolicy.showCustomerAddress && (
                    <div style={{ fontSize: 10, color: '#64748b' }}>Mob: 9842100000 | Gandhipuram</div>
                  )}
                  <div><strong>LOAN NO:</strong> LN-0042 (100 Days Daily)</div>
                </div>

                <div style={{ borderTop: '1px dashed #94a3b8', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 900 }}>
                  <span>AMOUNT RECEIVED:</span>
                  <span>{finSettings.company.currencySymbol}500.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>Installment #24 of 100</span>
                  <span style={{ color: '#16a34a', fontWeight: 800 }}>PAID</span>
                </div>

                {finSettings.receiptPolicy.showOutstandingBalance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                    <span>Remaining Principal:</span>
                    <span>{finSettings.company.currencySymbol}38,000.00</span>
                  </div>
                )}

                {finSettings.receiptPolicy.showNextDueDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span>Next Due: Tomorrow</span>
                    <span>{finSettings.company.currencySymbol}500.00</span>
                  </div>
                )}

                {finSettings.receiptPolicy.showAgentDetails && (
                  <div style={{ fontSize: 10, marginTop: 4, color: '#475569' }}>
                    Collected By: {user?.name || 'Field Officer 1'}
                  </div>
                )}

                {finSettings.receiptPolicy.enableUpiQr && finSettings.receiptPolicy.upiVpa && (
                  <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: 6,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6
                    }}>
                      {/* Simulated QR Code Icon Graphic */}
                      <QrCode size={52} style={{ color: '#0f172a' }} />
                    </div>
                    <div style={{ fontSize: 8, marginTop: 2, color: '#64748b' }}>
                      Scan & Pay via GPay / PhonePe: {finSettings.receiptPolicy.upiVpa}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px dashed #94a3b8', margin: '6px 0' }} />

                <div style={{ textAlign: 'center', fontSize: 9, color: '#64748b' }}>
                  {finSettings.receiptPolicy.footerNote || 'Thank you for your prompt repayment!'}
                </div>
                {finSettings.receiptPolicy.englishFooter && (
                  <div style={{ textAlign: 'center', fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
                    {finSettings.receiptPolicy.englishFooter}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 4: ALERTS & NOTIFICATIONS (வாடிக்கையாளர் அறிவிப்புகள்)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'notificationPolicy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Automatic Triggers */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(236, 72, 153, 0.1)',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bell size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Automated Borrower Notifications (தானியங்கி அறிவிப்புகள்)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Send instantaneous WhatsApp and SMS notices to borrowers upon events
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {[
                {
                  key: 'whatsappOnPayment',
                  title: 'Repayment Receipt Alert (ரசீது தகவல்)',
                  desc: 'Sends instant WhatsApp message with receipt details whenever payment is recorded'
                },
                {
                  key: 'disbursementWelcomeAlert',
                  title: 'Loan Disbursement Welcome Alert (கடன் வழங்கல்)',
                  desc: 'Sends welcome SMS/WhatsApp with sanctioned loan amount, installment schedule and terms'
                },
                {
                  key: 'enableDueReminder',
                  title: 'Upcoming Due Date Reminder (தவணை நினைவூட்டல்)',
                  desc: 'Sends polite reminder 1 day prior to repayment due date'
                },
                {
                  key: 'enableOverdueWarning',
                  title: 'Overdue Follow-up Notice (தாமத கட்டண எச்சரிக்கை)',
                  desc: 'Sends automated overdue alert if payment is pending 3 days after due date'
                },
                {
                  key: 'closureClearanceAlert',
                  title: 'Loan Closure & Clearance Note (கடன் நிறைவு)',
                  desc: 'Sends congratulatory clearance note and No-Due acknowledgment when loan finishes'
                }
              ].map(item => (
                <div
                  key={item.key}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary, #f8fafc)',
                    borderRadius: 12,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <input
                    type="checkbox"
                    checked={finSettings.notificationPolicy[item.key]}
                    onChange={e => updateNestedSetting('notificationPolicy', item.key, e.target.checked)}
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Templates Previews */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
              Standard Communication Templates (செய்தி மாதிரி வடிவங்கள்)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {/* Template 1: Receipt */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
                fontSize: 12,
                color: '#334155',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                  Repayment Receipt Template (ரசீது செய்தி)
                </div>
                <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  வணக்கம் <strong>{'{Customer_Name}'}</strong>,<br />
                  உங்கள் கடன் <strong>{'{Loan_No}'}</strong>-க்கான தவணைத் தொகை <strong>₹500</strong> வெற்றிகரமாகப் பெறப்பட்டது.<br />
                  மீதமுள்ள இருப்புத் தொகை: <strong>₹38,000</strong>.<br />
                  நன்றி! - <strong>{finSettings.company.name}</strong>
                </div>
              </div>

              {/* Template 2: Reminder */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
                fontSize: 12,
                color: '#334155',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} style={{ color: '#d97706' }} />
                  Due Date Reminder Template (நினைவூட்டல் செய்தி)
                </div>
                <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  அன்புள்ள <strong>{'{Customer_Name}'}</strong>,<br />
                  உங்கள் தினசரி தவணை <strong>₹500</strong> நாளை ({'{Tomorrow}'}) செலுத்த வேண்டிய நாள்.<br />
                  தாமத அபராதத்தைத் தவிர்க்க குறித்த நேரத்தில் செலுத்தவும்.<br />
                  தொடர்புக்கு: <strong>{finSettings.company.phone || 'Helpdesk'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 5: SECURITY, DAYBOOK & AUDIT (பாதுகாப்பு & கணக்கு தணிக்கை)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'securityPolicy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Session & Daybook Policy */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(14, 165, 233, 0.1)',
                color: '#0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Session Security & Daybook Controls (கணக்கு பாதுகாப்பு)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Enforce daily book-balancing discipline and session access timeouts
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Inactivity Auto-Logout Timeout
                </label>
                <select
                  className="form-input"
                  value={finSettings.securityPolicy.sessionTimeoutMins}
                  onChange={e => updateNestedSetting('securityPolicy', 'sessionTimeoutMins', parseInt(e.target.value) || 60)}
                >
                  <option value="15">15 Minutes Inactivity</option>
                  <option value="30">30 Minutes Inactivity</option>
                  <option value="60">1 Hour Inactivity (Recommended)</option>
                  <option value="240">4 Hours Inactivity</option>
                  <option value="0">Never (Stay logged in)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  High-Value Transaction PIN Threshold ({finSettings.company.currencySymbol})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={finSettings.securityPolicy.highValuePinThreshold}
                  onChange={e => updateNestedSetting('securityPolicy', 'highValuePinThreshold', parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 50000"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.securityPolicy.strictDaybookBalancing}
                  onChange={e => updateNestedSetting('securityPolicy', 'strictDaybookBalancing', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Strict Daybook Balancing: Enforce closing previous day's book before issuing new disbursements</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={finSettings.securityPolicy.requireApprovalForDeletion}
                  onChange={e => updateNestedSetting('securityPolicy', 'requireApprovalForDeletion', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary-600)' }}
                />
                <span>Require Admin Supervisor Approval to delete customer accounts or loan records</span>
              </label>
            </div>
          </div>

          {/* Backup & Data Protection */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={18} style={{ color: 'var(--primary-600)' }} />
              Enterprise Data Safeguard & Backups (தரவு காப்புப்பிரதி)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Download complete database snapshots containing all loans, customer KYC, daybook transactions and payment logs.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exportingBackup}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
              >
                <Download size={15} />
                {exportingBackup ? 'Generating Backup...' : 'Download Full JSON Database Backup'}
              </button>
            </div>
          </div>

          {/* Danger Zone: Reset Records (Admin Only) */}
          {(isAdmin || isSuperAdmin) && (
            <div className="card" style={{
              padding: 22,
              borderRadius: 14,
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
                <AlertOctagon size={20} />
                Danger Zone: Reset Application Records (தரவு மீட்டமைப்பு)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Clear all test loans, repayments, and customers to start fresh. Admin accounts and login credentials remain completely intact.
              </div>

              {!showResetConfirm ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowResetConfirm(true)}
                  style={{ background: '#dc2626', borderColor: '#b91c1c', gap: 6 }}
                >
                  <AlertOctagon size={15} /> Reset Application Records
                </button>
              ) : (
                <div style={{
                  background: '#fff',
                  border: '1px solid #ef4444',
                  borderRadius: 10,
                  padding: 16,
                  maxWidth: 480
                }}>
                  <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 14, marginBottom: 6 }}>
                    ⚠️ Security Check: Confirm Irreversible Reset
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                    Type <strong>RESET RECORDS</strong> in capital letters below to confirm this wipe:
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={resetConfirmationText}
                    onChange={e => setResetConfirmationText(e.target.value)}
                    placeholder="Type RESET RECORDS here"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={resetting || resetConfirmationText !== 'RESET RECORDS'}
                      onClick={handleResetData}
                      style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                    >
                      {resetting ? 'Resetting Records...' : 'I Understand, Reset Now'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setShowResetConfirm(false); setResetConfirmationText(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 6: COMPANY PROFILE (நிறுவன விவரங்கள்)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'company' && (
        <div className="card" style={{ padding: 22, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Finance Company / Shop Profile (நிறுவன விவரங்கள்)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Official registration details, helpline numbers, and branch address
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Finance Company Name (நிறுவனத்தின் பெயர்) *
              </label>
              <input
                type="text"
                className="form-input"
                value={finSettings.company.name}
                onChange={e => updateNestedSetting('company', 'name', e.target.value)}
                placeholder="e.g. Sri Murugan Finance"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Proprietor / Managing Director Name
              </label>
              <input
                type="text"
                className="form-input"
                value={finSettings.company.ownerName || ''}
                onChange={e => updateNestedSetting('company', 'ownerName', e.target.value)}
                placeholder="e.g. K. Murugesan"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Registration / License / MSME No
              </label>
              <input
                type="text"
                className="form-input"
                value={finSettings.company.regNo}
                onChange={e => updateNestedSetting('company', 'regNo', e.target.value)}
                placeholder="e.g. TN/CBE/MFI-2024-8841"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Helpline / WhatsApp Contact Number
              </label>
              <input
                type="tel"
                className="form-input"
                value={finSettings.company.phone}
                onChange={e => updateNestedSetting('company', 'phone', e.target.value)}
                placeholder="Official phone number"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                GSTIN / Tax ID (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                value={finSettings.company.gstin}
                onChange={e => updateNestedSetting('company', 'gstin', e.target.value)}
                placeholder="GST Identification Number"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Official Support Email
              </label>
              <input
                type="email"
                className="form-input"
                value={finSettings.company.email}
                onChange={e => updateNestedSetting('company', 'email', e.target.value)}
                placeholder="support@srimurugan.in"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Base Currency Symbol
              </label>
              <input
                type="text"
                className="form-input"
                value={finSettings.company.currencySymbol}
                onChange={e => updateNestedSetting('company', 'currencySymbol', e.target.value)}
                placeholder="₹"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
              Shop / Branch Physical Address
            </label>
            <input
              type="text"
              className="form-input"
              value={finSettings.company.address}
              onChange={e => updateNestedSetting('company', 'address', e.target.value)}
              placeholder="e.g. 142/A, Main Road, Gandhipuram, Coimbatore - 641012"
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveAllSettings}
              disabled={savingSettings}
              style={{ gap: 6 }}
            >
              <Save size={15} /> Save Company Details
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 7: MY ACCOUNT & PASSWORD (சுயவிவரம் & கடவுச்சொல்)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* User Profile Card */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 900,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{user?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="badge badge-info" style={{ fontSize: 11, padding: '2px 8px', fontWeight: 800 }}>
                    Role: {user?.role}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Phone: {user?.phone || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Your Name (பெயர்) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Mobile Number (அலைபேசி எண்) *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={updatingProfile}>
                  {updatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="card" style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
              <Lock size={16} style={{ color: '#d97706' }} />
              Change Password (கடவுச்சொல் மாற்றம்)
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Confirm New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Re-type new password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={updatingPassword}
                  style={{ background: '#d97706', borderColor: '#b45309' }}
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Sign Out Card */}
          <div className="card" style={{ padding: 18, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Sign Out from this Device</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Securely terminate your current session</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn btn-ghost btn-sm"
              style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', gap: 6, fontWeight: 800 }}
            >
              <LogOut size={14} /> Sign Out (வெளியேறு)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
