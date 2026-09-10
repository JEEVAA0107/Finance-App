import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { loansAPI, paymentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, HandCoins, X, Banknote, Lock, Trash2, User, ShieldCheck, Phone, Eye, FileText, Calendar, ArrowRight, CornerDownRight, ChevronDown, ChevronUp } from 'lucide-react';
import { isPdfDocument } from '../utils/imageCompressor';
import { useAuth } from '../contexts/AuthContext';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'CASH', reference: '', penaltyAmount: '' });
  const [paying, setPaying] = useState(false);
  const [penaltyModal, setPenaltyModal] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({ amount: '100', paymentMode: 'CASH', reference: '', notes: '' });
  const [payingPenalty, setPayingPenalty] = useState(false);
  const [principalModal, setPrincipalModal] = useState(false);
  const [principalForm, setPrincipalForm] = useState({ amount: '', accruedInterest: '', penaltyAmount: '', paymentMode: 'CASH', reference: '', notes: '' });
  const [payingPrincipal, setPayingPrincipal] = useState(false);
  const [preclosure, setPreclosure] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const toggleWeek = (w) => setExpandedWeeks(prev => ({ ...prev, [w]: prev[w] !== undefined ? !prev[w] : false }));
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleOpenPrincipalModal = async () => {
    setPrincipalForm({ amount: String(loan?.outstandingPrincipal ?? loan?.principalAmount ?? 0), accruedInterest: '0', penaltyAmount: '0', paymentMode: 'CASH', reference: '', notes: '' });
    setPreclosure(null);
    setPrincipalModal(true);
    try {
      const res = await loansAPI.getPreclosure(id);
      setPreclosure(res);
      setPrincipalForm(prev => ({ ...prev, accruedInterest: String(res.accruedInterest || 0) }));
    } catch (e) {
      toast.error('Failed to get preclosure details');
    }
  };

  const load = () => {
    setLoading(true);
    loansAPI.get(id).then(r => setLoan(r)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await paymentsAPI.collect({ repaymentId: payModal.id, ...payForm, amount: parseFloat(payForm.amount), penaltyAmount: parseFloat(payForm.penaltyAmount) || 0 });
      toast.success('✓ Payment collected!');
      setPayModal(null);
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setPaying(false); }
  };

  const handleOpenPenaltyModal = (r) => {
    setPenaltyModal(r);
    setPenaltyForm({
      amount: String(r.penaltyAmount > 0 ? r.penaltyAmount : 100),
      paymentMode: 'CASH',
      reference: '',
      notes: ''
    });
  };

  const handlePayPenalty = async (e) => {
    e.preventDefault();
    setPayingPenalty(true);
    try {
      const res = await paymentsAPI.collectPenalty({
        repaymentId: penaltyModal.id,
        amount: parseFloat(penaltyForm.amount),
        paymentMode: penaltyForm.paymentMode,
        reference: penaltyForm.reference,
        notes: penaltyForm.notes,
      });
      toast.success(res.message || '✓ Penalty collected & Installment carried forward!');
      setPenaltyModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to collect penalty');
    } finally {
      setPayingPenalty(false);
    }
  };

  const handlePrincipalPay = async (e) => {
    e.preventDefault();
    setPayingPrincipal(true);
    try {
      const res = await paymentsAPI.close({ 
        loanId: id, 
        principalAmount: parseFloat(principalForm.amount),
        accruedInterestAmount: parseFloat(principalForm.accruedInterest || 0),
        penaltyAmount: parseFloat(principalForm.penaltyAmount || 0),
        paymentMode: principalForm.paymentMode,
        reference: principalForm.reference,
        notes: principalForm.notes
      });
      toast.success(res.loanStatus === 'CLOSED' ? '✓ Loan CLOSED!' : `✓ Principal paid! Remaining: ₹${res.outstandingPrincipal?.toLocaleString('en-IN')}`);
      setPrincipalModal(false);
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setPayingPrincipal(false); }
  };

  const handleDeleteLoan = async () => {
    setDeleting(true);
    try {
      await loansAPI.delete(id);
      toast.success('Loan permanently deleted!');
      setDeleteModal(false);
      navigate('/loans');
    } catch (err) {
      toast.error(err.message || 'Failed to delete loan');
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!loan) return <div className="card" style={{ textAlign: 'center', padding: 32 }}>Loan not found</div>;

  const outstanding = loan.outstandingPrincipal ?? loan.principalAmount;
  const isWithoutInt = loan.interestType === 'WITHOUT_INTEREST';
  const isDaily = loan.tenureUnit === 'DAYS' || loan.repayments?.some(r => r.dayNo != null);
  const paidCount = loan.repayments?.filter(r => r.status === 'PAID').length || 0;
  const carriedCount = loan.repayments?.filter(r => r.status === 'CARRIED_FORWARD').length || 0;
  const overdueCount = loan.repayments?.filter(r => r.status === 'OVERDUE').length || 0;
  const totalCount = loan.repayments?.length || 1;
  const progress = Math.round((paidCount / totalCount) * 100);

  // Active unpaid: only installments that are neither PAID nor CARRIED_FORWARD
  const activeUnpaid = loan.repayments?.filter(r => r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD') || [];
  const lowestUnpaidInstNo = activeUnpaid.length > 0
    ? Math.min(...activeUnpaid.map(r => r.installmentNo))
    : null;

  // Group all repayments by weekNo
  const weekMap = {};
  (loan.repayments || []).forEach(r => {
    const w = r.weekNo || (r.installmentNo ? Math.floor((r.installmentNo - 1) / (isDaily ? 7 : 1)) + 1 : 1);
    if (!weekMap[w]) weekMap[w] = [];
    weekMap[w].push(r);
  });
  const weekNumbers = Object.keys(weekMap).map(Number).sort((a, b) => a - b);

  return (
    <div className="animate-in">
      {/* Back */}
      <Link to="/loans" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, marginBottom: 14, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Loans
      </Link>

      {/* Loan summary card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{loan.loanNumber}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loan.customer?.name} · {loan.tenureUnit === 'WEEKS' ? 'Weekly' : loan.tenureUnit === 'MONTHS' ? 'Monthly' : 'Daily'}</div>
          </div>
          <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-success' : loan.status === 'CLOSED' ? 'badge-info' : 'badge-danger'}`}>{loan.status}</span>
        </div>

        {/* Key numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isWithoutInt ? 'Total Payable' : 'Principal'}</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>₹{loan.principalAmount?.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isWithoutInt ? (loan.tenureUnit === 'DAYS' ? 'Daily Due' : 'Weekly Due') : 'Per Period'}</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-400)' }}>₹{loan.installmentAmount?.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-glass)', borderRadius: 10, padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: outstanding > 0 ? 'var(--warning-400)' : 'var(--accent-400)' }}>₹{outstanding?.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Interest collected or WITHOUT_INTEREST details */}
        {isWithoutInt ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Disbursed Amount</span>
              <span style={{ fontWeight: 700 }}>₹{(loan.principalAmount - (loan.processingFee || 0)).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Advance Deduction</span>
              <span style={{ fontWeight: 700, color: 'var(--danger-400)' }}>₹{(loan.processingFee || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Paid So Far</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-600)' }}>₹{(loan.principalAmount - outstanding).toLocaleString('en-IN')}</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>Interest Collected</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-600)' }}>₹{(loan.interestCollected || 0).toLocaleString('en-IN')}</span>
          </div>
        )}

        {/* Progress */}
        <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary-500)', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{paidCount}/{totalCount} paid</div>

        {/* Pay Principal button */}
        {!isWithoutInt && loan.status === 'ACTIVE' && outstanding > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12, borderColor: 'rgba(245,158,11,0.3)', color: 'var(--warning-600)' }}
            onClick={handleOpenPrincipalModal}>
            <Banknote size={15} /> Close Loan / Pay Principal
          </button>
        )}
        
        {/* Delete Loan Button */}
        {user?.role === 'ADMIN' && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, borderColor: 'rgba(239,68,68,0.3)', color: 'var(--danger-600)' }}
            onClick={() => setDeleteModal(true)}>
            <Trash2 size={15} /> Delete Loan
          </button>
        )}
      </div>

      {/* Borrower & Jamin Summary Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {/* Borrower */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {loan.customer?.photoUrl ? (
              <img
                src={loan.customer.photoUrl}
                alt={loan.customer.name}
                onClick={() => setPreviewImage(loan.customer.photoUrl)}
                title="Click to zoom"
                style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--primary-400)', cursor: 'pointer', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                {loan.customer?.name?.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Borrower (வாடிக்கையாளர்)</div>
              <Link to={`/customers/${loan.customer?.id}`} style={{ fontWeight: 800, fontSize: 14, color: 'inherit', textDecoration: 'none' }}>
                {loan.customer?.name}
              </Link>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={11} />
                <a href={`tel:${loan.customer?.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{loan.customer?.phone}</a>
              </div>
            </div>
            {loan.customer?.idProofUrl && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPreviewImage(loan.customer.idProofUrl)}
                title="View Borrower ID Proof"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                <Eye size={13} /> Proof
              </button>
            )}
          </div>

          {/* Jamin Person */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            {loan.customer?.jaminName ? (
              <>
                {loan.customer.jaminPhotoUrl ? (
                  <img
                    src={loan.customer.jaminPhotoUrl}
                    alt={loan.customer.jaminName}
                    onClick={() => setPreviewImage(loan.customer.jaminPhotoUrl)}
                    title="Click to zoom"
                    style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '2px solid #10b981', cursor: 'pointer', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                    {loan.customer.jaminName?.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>
                    Jamin Person (ஜாமீன்)
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{loan.customer.jaminName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={11} />
                    {loan.customer.jaminPhone ? (
                      <a href={`tel:${loan.customer.jaminPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{loan.customer.jaminPhone}</a>
                    ) : (
                      <span>{loan.customer.jaminRelationship || 'Guarantor'}</span>
                    )}
                  </div>
                </div>
                {loan.customer?.jaminIdProofUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPreviewImage(loan.customer.jaminIdProofUrl)}
                    title="View Jamin ID Proof"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <Eye size={13} /> Proof
                  </button>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <ShieldCheck size={20} style={{ color: '#94a3b8' }} />
                <span>No Jamin guarantor registered for this borrower.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Repayment Schedule */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Weekly Repayment Schedule</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {weekNumbers.length} Weeks · {totalCount} Installments {isDaily ? '(Daily Collections)' : '(Weekly Collections)'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {overdueCount > 0 && (
              <span className="badge badge-danger" style={{ fontSize: 11 }}>
                ⚠️ {overdueCount} Overdue
              </span>
            )}
            {carriedCount > 0 && (
              <span className="badge" style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.3)' }}>
                ↺ {carriedCount} Carried Forward
              </span>
            )}
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              ✓ {paidCount} Paid
            </span>
          </div>
        </div>

        {/* Weeks Accordion List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {weekNumbers.map(w => {
            const weekList = weekMap[w] || [];
            const isWeekPaid = weekList.every(r => r.status === 'PAID');
            const hasOverdue = weekList.some(r => r.status === 'OVERDUE');
            const hasCarried = weekList.some(r => r.status === 'CARRIED_FORWARD');
            const isWeekCleared = weekList.every(r => r.status === 'PAID' || r.status === 'CARRIED_FORWARD');
            const weekDueSum = weekList.reduce((sum, r) => sum + r.dueAmount, 0);
            const weekPaidSum = weekList.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
            
            // Expanded by default unless all items are paid
            const isExpanded = expandedWeeks[w] !== undefined ? expandedWeeks[w] : (!isWeekPaid || weekNumbers.length <= 10);

            return (
              <div
                key={w}
                style={{
                  border: hasOverdue
                    ? '1.5px solid rgba(239, 68, 68, 0.4)'
                    : isWeekPaid
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : hasCarried
                    ? '1px solid rgba(139, 92, 246, 0.3)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--bg-glass, rgba(255,255,255,0.02))',
                }}
              >
                {/* Week Header */}
                <div
                  onClick={() => toggleWeek(w)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: hasOverdue
                      ? 'rgba(239, 68, 68, 0.06)'
                      : isWeekPaid
                      ? 'rgba(16, 185, 129, 0.05)'
                      : hasCarried
                      ? 'rgba(139, 92, 246, 0.05)'
                      : 'rgba(0,0,0,0.02)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                      background: hasOverdue ? '#fee2e2' : isWeekPaid ? '#d1fae5' : hasCarried ? '#ede9fe' : 'rgba(99,102,241,0.1)',
                      color: hasOverdue ? '#b91c1c' : isWeekPaid ? '#047857' : hasCarried ? '#6d28d9' : 'var(--primary-600)',
                    }}>
                      W{w}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>Week {w}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {weekList.length} installments {weekList.length > 0 && `(${fmtShort(weekList[0].dueDate)} – ${fmtShort(weekList[weekList.length - 1].dueDate)})`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>
                        ₹{weekPaidSum.toLocaleString('en-IN')} / ₹{weekDueSum.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {isWeekPaid ? 'Fully Paid' : hasOverdue ? 'Overdue Pending' : isWeekCleared ? 'Carried Forward' : 'In Progress'}
                      </div>
                    </div>

                    {hasOverdue ? (
                      <span className="badge badge-danger" style={{ fontSize: 10 }}>⚠️ Overdue</span>
                    ) : isWeekPaid ? (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>✓ Paid</span>
                    ) : isWeekCleared ? (
                      <span className="badge" style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#7c3aed' }}>↺ Moved</span>
                    ) : (
                      <span className="badge badge-muted" style={{ fontSize: 10 }}>Pending</span>
                    )}

                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Week Installments Content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {weekList.map(r => {
                      const isBlocked = lowestUnpaidInstNo !== null && r.installmentNo > lowestUnpaidInstNo && r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD';
                      const isCarriedForward = r.status === 'CARRIED_FORWARD';
                      const isOverdue = r.status === 'OVERDUE';
                      const isPaid = r.status === 'PAID';

                      return (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isCarriedForward
                              ? 'rgba(139,92,246,0.03)'
                              : isOverdue
                              ? 'rgba(239,68,68,0.03)'
                              : 'transparent',
                          }}
                        >
                          {/* Left: icon & details */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: isPaid
                                ? 'rgba(16,185,129,0.15)'
                                : isCarriedForward
                                ? 'rgba(139,92,246,0.15)'
                                : isOverdue
                                ? 'rgba(239,68,68,0.15)'
                                : 'rgba(0,0,0,0.05)',
                            }}>
                              {isPaid ? (
                                <CheckCircle size={14} style={{ color: 'var(--accent-600)' }} />
                              ) : isCarriedForward ? (
                                <CornerDownRight size={14} style={{ color: '#7c3aed' }} />
                              ) : isOverdue ? (
                                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                              ) : (
                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>#{r.installmentNo} {r.dayNo ? `· Day ${r.dayNo}` : ''}</span>
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>({fmtShort(r.dueDate)})</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {isPaid ? (
                                  <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                                    Paid ₹{r.paidAmount?.toLocaleString('en-IN')}
                                  </span>
                                ) : isCarriedForward ? (
                                  <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(139,92,246,0.15)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    ↺ Carried Forward · Penalty Paid ₹{r.penaltyPaid || r.penaltyAmount} {r.carriedToInstNo ? `→ Inst #${r.carriedToInstNo}` : ''}
                                  </span>
                                ) : isOverdue ? (
                                  <span className="badge badge-danger" style={{ fontSize: 10, padding: '1px 6px' }}>
                                    Overdue · Penalty Due: ₹{r.penaltyAmount > 0 ? r.penaltyAmount : 100}
                                  </span>
                                ) : r.paidAmount > 0 ? (
                                  <span className="badge badge-warning" style={{ fontSize: 10, padding: '1px 6px' }}>
                                    Partial: ₹{r.paidAmount?.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="badge badge-muted" style={{ fontSize: 10, padding: '1px 6px' }}>
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: amount and action buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>₹{r.dueAmount?.toLocaleString('en-IN')}</div>
                            </div>

                            {/* Actions */}
                            {!isPaid && !isCarriedForward && loan.status !== 'CLOSED' && (
                              isBlocked ? (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '5px 8px', cursor: 'not-allowed', opacity: 0.45 }}
                                  disabled
                                  title={`முதலில் Installment #${lowestUnpaidInstNo} collect செய்யுங்கள் அல்லது Penalty செலுத்தி Carry Forward செய்யுங்கள்`}
                                >
                                  <Lock size={13} />
                                </button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {/* Normal collection */}
                                  <button
                                    className="btn btn-success btn-sm"
                                    style={{ padding: '5px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                                    title="Collect Installment Amount"
                                    onClick={() => {
                                      setPayModal(r);
                                      setPayForm({
                                        amount: String(r.dueAmount - r.paidAmount),
                                        paymentMode: 'CASH',
                                        reference: '',
                                        penaltyAmount: isOverdue ? String(r.penaltyAmount || 100) : ''
                                      });
                                    }}
                                  >
                                    <HandCoins size={13} /> Collect
                                  </button>

                                  {/* Overdue Case B: Pay Penalty Only & Carry Forward */}
                                  {isOverdue && (
                                    <button
                                      type="button"
                                      className="btn btn-warning btn-sm"
                                      style={{
                                        padding: '5px 8px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: 'rgba(245,158,11,0.15)',
                                        color: '#d97706',
                                        border: '1px solid rgba(245,158,11,0.35)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                      title="Pay Penalty Only & Carry Forward to End of Loan Schedule"
                                      onClick={() => handleOpenPenaltyModal(r)}
                                    >
                                      <Clock size={12} /> Carry Fwd
                                    </button>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interest payment modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700 }}>{isWithoutInt ? 'Collect Installment' : 'Collect Interest'} #{payModal.installmentNo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loan.customer?.name} · {fmtDate(payModal.dueDate)}</div>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePay}>
              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-glass)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>DUE</div><div style={{ fontWeight: 700 }}>₹{payModal.dueAmount?.toLocaleString('en-IN')}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PAID</div><div style={{ fontWeight: 700, color: 'var(--accent-400)' }}>₹{payModal.paidAmount?.toLocaleString('en-IN')}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BALANCE</div><div style={{ fontWeight: 700, color: 'var(--warning-400)' }}>₹{(payModal.dueAmount - payModal.paidAmount)?.toLocaleString('en-IN')}</div></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                </div>
                {payModal.status === 'OVERDUE' && (
                  <div className="form-group">
                    <label className="form-label">Interest for Overdue (₹) - optional</label>
                    <input className="form-input" type="number" min="0" placeholder="e.g. 100" value={payForm.penaltyAmount}
                      onChange={e => setPayForm({ ...payForm, penaltyAmount: e.target.value })} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paying}>{paying ? 'Processing...' : `Collect ₹${(parseFloat(payForm.amount || 0) + parseFloat(payForm.penaltyAmount || 0)).toLocaleString('en-IN')}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Penalty / Carry-Forward Modal */}
      {penaltyModal && (
        <div className="modal-overlay" onClick={() => setPenaltyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Pay Penalty & Carry Forward</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Installment #{penaltyModal.installmentNo} {penaltyModal.weekNo ? `(Week ${penaltyModal.weekNo})` : ''} · {loan.customer?.name}
                </div>
              </div>
              <button className="modal-close" onClick={() => setPenaltyModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePayPenalty}>
              <div className="modal-body">
                {/* Visual notice explaining Case B carry forward */}
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#6d28d9',
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> Penalty Carry-Forward System
                  </div>
                  <div>
                    Paying the overdue penalty of <b>₹{penaltyForm.amount || 100}</b> will mark this installment as <b>CARRIED FORWARD (Penalty Paid)</b> and unlock subsequent collections.
                    The unpaid installment amount of <b>₹{(penaltyModal.dueAmount - penaltyModal.paidAmount).toLocaleString('en-IN')}</b> will be dynamically appended to the end of the loan schedule, shifting the loan end date.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-glass)', padding: '10px 12px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>UNPAID INSTALLMENT</div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>₹{(penaltyModal.dueAmount - penaltyModal.paidAmount).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 10, color: '#7c3aed' }}>Carried to Schedule End</div>
                  </div>
                  <div style={{ background: 'var(--bg-glass)', padding: '10px 12px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PENALTY TO PAY NOW</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#d97706' }}>₹{penaltyForm.amount || 0}</div>
                    <div style={{ fontSize: 10, color: '#059669' }}>Unlocks Carry Forward</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Penalty Amount (₹) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    value={penaltyForm.amount}
                    onChange={e => setPenaltyForm({ ...penaltyForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={penaltyForm.paymentMode}
                    onChange={e => setPenaltyForm({ ...penaltyForm, paymentMode: e.target.value })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference / Notes (optional)</label>
                  <input
                    className="form-input"
                    placeholder="UPI Ref ID or reason"
                    value={penaltyForm.notes}
                    onChange={e => setPenaltyForm({ ...penaltyForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPenaltyModal(null)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                  disabled={payingPenalty}
                >
                  {payingPenalty ? 'Processing...' : `Pay ₹${penaltyForm.amount} & Carry Forward`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Principal payment modal */}
      {principalModal && (
        <div className="modal-overlay" onClick={() => setPrincipalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 700 }}>Loan Closure / Principal Payment</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Outstanding: ₹{outstanding?.toLocaleString('en-IN')}</div>
              </div>
              <button className="modal-close" onClick={() => setPrincipalModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePrincipalPay}>
              <div className="modal-body">
                <div style={{ padding: '10px 14px', background: 'var(--warning-50)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', marginBottom: 14, fontSize: 12, color: 'var(--warning-600)' }}>
                  ⚠️ Paying the full outstanding principal will <b>CLOSE</b> the loan automatically.
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Principal Amount *</label>
                    <input className="form-input" type="number" step="0.01" max={outstanding} value={principalForm.amount} onChange={e => setPrincipalForm({ ...principalForm, amount: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Accrued Interest (₹) 
                      {preclosure?.unpaidPeriods > 0 && 
                        <span style={{color: 'var(--danger-500)', marginLeft: 6, fontSize: 11}}>
                          ({preclosure.unpaidPeriods} {preclosure.tenureUnitStr} Unpaid)
                        </span>
                      }
                    </label>
                    <input className="form-input" type="number" step="0.01" value={principalForm.accruedInterest} onChange={e => setPrincipalForm({ ...principalForm, accruedInterest: e.target.value })} disabled={!preclosure} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Overdue Penalty / Extra Charges (₹) - optional</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={principalForm.penaltyAmount} onChange={e => setPrincipalForm({ ...principalForm, penaltyAmount: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={principalForm.paymentMode} onChange={e => setPrincipalForm({ ...principalForm, paymentMode: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reference / Notes (optional)</label>
                  <input className="form-input" placeholder="UPI / Txn ID or Notes" value={principalForm.notes} onChange={e => setPrincipalForm({ ...principalForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  Total: ₹{((parseFloat(principalForm.amount || 0) + parseFloat(principalForm.accruedInterest || 0) + parseFloat(principalForm.penaltyAmount || 0)).toLocaleString('en-IN'))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setPrincipalModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg,var(--warning-500),var(--warning-600))' }} disabled={payingPrincipal || !preclosure}>
                    {payingPrincipal ? 'Processing...' : 'Confirm Closure'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Loan Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, color: 'var(--danger-600)' }}>Delete Loan Permanently?</div>
              <button className="modal-close" onClick={() => !deleting && setDeleteModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 15 }}>Are you sure you want to delete loan <b>{loan.loanNumber}</b> for <b>{loan.customer?.name}</b>?</p>
              <div style={{ padding: '10px 14px', background: 'var(--danger-50)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: 'var(--danger-700)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>This action cannot be undone. All installments, payments, and history associated with this loan will be permanently erased.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteLoan} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo or PDF Zoom Modal */}
      {previewImage && (
        <div
          className="modal-overlay"
          style={{ zIndex: 10002, background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              maxWidth: isPdfDocument(previewImage) ? '820px' : '90vw',
              width: isPdfDocument(previewImage) ? '92vw' : 'auto',
              maxHeight: '90vh',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {isPdfDocument(previewImage) ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1e293b', color: '#fff' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} color="#ef4444" /> Attached PDF Document
                  </span>
                  <a
                    href={previewImage}
                    target="_blank"
                    rel="noreferrer"
                    download="Document.pdf"
                    style={{ color: '#38bdf8', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                  >
                    Open in New Tab / Download
                  </a>
                </div>
                <iframe
                  src={previewImage}
                  title="Document Preview"
                  style={{ width: '100%', flex: 1, border: 'none' }}
                />
              </div>
            ) : (
              <img
                src={previewImage}
                alt="Zoomed Preview"
                style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
              />
            )}
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -36,
                right: 0,
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
