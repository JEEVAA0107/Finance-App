import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import AddCustomerModal from '../components/AddCustomerModal';
import { isPdfDocument } from '../utils/imageCompressor';
import {
  User, Phone, MapPin, CreditCard, Landmark, ArrowLeft,
  ShieldCheck, Edit2, MessageCircle, Eye, ExternalLink, X, FileText
} from 'lucide-react';

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchCustomer = () => {
    customersAPI.get(id)
      .then(r => setCustomer(r))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading Customer...</p></div>;
  if (!customer) return <div className="card empty-state"><h3>Customer not found</h3></div>;

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link to="/customers" className="btn btn-ghost" style={{ gap: 6 }}>
          <ArrowLeft size={16} /> Back to Customers
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowEditModal(true)}
          style={{ gap: 6 }}
        >
          <Edit2 size={14} /> Edit Profile & Jamin
        </button>
      </div>

      <div className="grid-2 mb-24" style={{ alignItems: 'start' }}>
        {/* Customer Details Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">
              <User size={18} style={{ marginRight: 8, color: 'var(--primary-500)' }} />
              Customer Information
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
            {customer.photoUrl ? (
              <img
                src={customer.photoUrl}
                alt={customer.name}
                onClick={() => setPreviewImage(customer.photoUrl)}
                title="Click to zoom"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  objectFit: 'cover',
                  border: '2px solid var(--primary-400)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  background: 'rgba(99,102,241,0.1)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 28,
                  flexShrink: 0,
                }}
              >
                {customer.name?.charAt(0)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{customer.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={12} />
                <a href={`tel:${customer.phone}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                  {customer.phone}
                </a>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Customer Since: {formatDate(customer.createdAt)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div className="form-row">
              <div>
                <span className="color-muted fs-12">EMAIL</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{customer.email || 'N/A'}</div>
              </div>
              <div>
                <span className="color-muted fs-12">CITY / TOWN</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{customer.city}</div>
              </div>
            </div>

            <div>
              <span className="color-muted fs-12">COMPLETE RESIDENCE ADDRESS</span>
              <div style={{ fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <MapPin size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--primary-500)' }} />
                <span>{customer.address}, {customer.city}</span>
              </div>
            </div>

            <div className="form-row">
              <div>
                <span className="color-muted fs-12">IDENTITY PROOF</span>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <CreditCard size={14} style={{ color: 'var(--primary-500)' }} />
                  <span className="badge badge-info">{customer.idType}</span>
                  <span>{customer.idNumber}</span>
                </div>
              </div>
              {customer.latitude && customer.longitude && (
                <div>
                  <span className="color-muted fs-12">GPS PIN</span>
                  <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 2 }}>
                    📍 {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                  </div>
                </div>
              )}
            </div>

            {/* Attached Customer ID Proof document preview */}
            {customer.idProofUrl && (
              <div style={{ marginTop: 8 }}>
                <span className="color-muted fs-12" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  ATTACHED {customer.idType} DOCUMENT PROOF
                </span>
                {isPdfDocument(customer.idProofUrl) ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.22)',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={20} color="#ef4444" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {customer.idType} Document (PDF)
                        </div>
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Verified Document Proof</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(customer.idProofUrl)}
                      className="btn btn-primary btn-sm"
                      style={{ gap: 5, fontSize: 11, padding: '5px 10px', flexShrink: 0 }}
                    >
                      <Eye size={13} /> View PDF
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.02)' }}>
                    <img
                      src={customer.idProofUrl}
                      alt={`${customer.idType} Proof`}
                      style={{ width: '100%', maxHeight: 200, objectFit: 'contain', cursor: 'pointer', display: 'block' }}
                      onClick={() => setPreviewImage(customer.idProofUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImage(customer.idProofUrl)}
                      className="btn btn-ghost btn-sm"
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        borderRadius: 6,
                        fontSize: 11,
                        padding: '4px 8px',
                      }}
                    >
                      <Eye size={13} style={{ marginRight: 4 }} /> View Full Proof
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Jamin Person (Guarantor) Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">
              <ShieldCheck size={18} style={{ marginRight: 8, color: '#10b981' }} />
              Jamin Person (ஜாமீன் நபர் / Guarantor)
            </div>
            {customer.jaminName && (
              <span className="badge badge-success" style={{ fontSize: 11 }}>Linked Guarantor</span>
            )}
          </div>

          {customer.jaminName ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Jamin Avatar / Photo & Contact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                {customer.jaminPhotoUrl ? (
                  <img
                    src={customer.jaminPhotoUrl}
                    alt={customer.jaminName}
                    onClick={() => setPreviewImage(customer.jaminPhotoUrl)}
                    title="Click to zoom"
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 16,
                      objectFit: 'cover',
                      border: '2px solid #10b981',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 16,
                      background: 'rgba(16,185,129,0.1)',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 26,
                      flexShrink: 0,
                    }}
                  >
                    {customer.jaminName?.charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{customer.jaminName}</div>
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                    Relationship: {customer.jaminRelationship || 'Guarantor'}
                  </div>
                  {customer.jaminPhone && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={12} />
                      <a href={`tel:${customer.jaminPhone}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                        {customer.jaminPhone}
                      </a>
                      <a
                        href={`https://wa.me/91${customer.jaminPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Chat on WhatsApp"
                        style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}
                      >
                        <MessageCircle size={14} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Jamin Details */}
              {customer.jaminAddress && (
                <div>
                  <span className="color-muted fs-12">JAMIN RESIDENCE ADDRESS</span>
                  <div style={{ fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <MapPin size={14} style={{ flexShrink: 0, marginTop: 2, color: '#10b981' }} />
                    <span>{customer.jaminAddress}</span>
                  </div>
                </div>
              )}

              {customer.jaminIdNumber && (
                <div>
                  <span className="color-muted fs-12">JAMIN IDENTITY CARD</span>
                  <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <CreditCard size={14} style={{ color: '#10b981' }} />
                    <span className="badge badge-info">{customer.jaminIdType || 'ID'}</span>
                    <span>{customer.jaminIdNumber}</span>
                  </div>
                </div>
              )}

              {/* Jamin ID Proof document preview */}
              {customer.jaminIdProofUrl && (
                <div style={{ marginTop: 8 }}>
                  <span className="color-muted fs-12" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    ATTACHED JAMIN ID DOCUMENT PROOF
                  </span>
                  {isPdfDocument(customer.jaminIdProofUrl) ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <FileText size={20} color="#ef4444" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            Jamin {customer.jaminIdType || 'ID'} Document (PDF)
                          </div>
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Verified Guarantor Document</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(customer.jaminIdProofUrl)}
                        className="btn btn-primary btn-sm"
                        style={{ gap: 5, fontSize: 11, padding: '5px 10px', flexShrink: 0 }}
                      >
                        <Eye size={13} /> View PDF
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.02)' }}>
                      <img
                        src={customer.jaminIdProofUrl}
                        alt="Jamin ID Proof"
                        style={{ width: '100%', maxHeight: 180, objectFit: 'contain', cursor: 'pointer', display: 'block' }}
                        onClick={() => setPreviewImage(customer.jaminIdProofUrl)}
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewImage(customer.jaminIdProofUrl)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          borderRadius: 6,
                          fontSize: 11,
                          padding: '4px 8px',
                        }}
                      >
                        <Eye size={13} style={{ marginRight: 4 }} /> View Jamin Proof
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <ShieldCheck size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No Jamin Person (Guarantor) Added</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Add a guarantor for this customer to secure future loans and track collateral verification.
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowEditModal(true)}
              >
                + Add Jamin Person Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loan History Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">
            <Landmark size={18} style={{ marginRight: 8, color: 'var(--primary-500)' }} />
            Loan History ({customer.loans?.length || 0})
          </div>
          <Link to="/loans/create" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
            + Create New Loan
          </Link>
        </div>

        {customer.loans?.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr><th>Loan #</th><th>Principal</th><th>Payable</th><th>Tenure</th><th>Status</th><th>Start Date</th></tr>
              </thead>
              <tbody>
                {customer.loans.map((l) => (
                  <tr key={l.id}>
                    <td data-label="Loan #"><Link to={`/loans/${l.id}`} className="fw-600">{l.loanNumber}</Link></td>
                    <td data-label="Principal">
                      ₹{l.principalAmount?.toLocaleString('en-IN')}
                      {l.interestType === 'WITHOUT_INTEREST' && (
                        <div style={{ fontSize: 11, color: 'var(--accent-400)', marginTop: 2 }}>
                          Disbursed: ₹{(l.principalAmount - (l.processingFee || 0)).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td data-label="Payable">
                      {l.interestType === 'FLAT' ? (
                        <div>
                          <span style={{ fontWeight: 700, color: '#2563EB' }}>₹{l.installmentAmount?.toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> / {l.tenureUnit === 'WEEKS' ? 'wk' : l.tenureUnit === 'MONTHS' ? 'mo' : 'day'} (வட்டி)</span>
                        </div>
                      ) : (
                        <span>₹{l.totalPayable?.toLocaleString('en-IN')}</span>
                      )}
                    </td>
                    <td data-label="Tenure">{l.tenure} {l.tenureUnit?.toLowerCase()}</td>
                    <td data-label="Status"><span className={`badge ${l.status === 'ACTIVE' ? 'badge-success' : l.status === 'CLOSED' ? 'badge-muted' : 'badge-danger'}`}>{l.status}</span></td>
                    <td data-label="Start Date">{formatDate(l.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            No loans have been disbursed to this customer yet.
          </div>
        )}
      </div>

      {/* Edit Customer & Jamin Modal */}
      <AddCustomerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={(updated) => {
          if (updated) setCustomer(prev => ({ ...prev, ...updated }));
          fetchCustomer();
        }}
        editCustomer={customer}
      />

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
