import { useState, useEffect, useRef } from 'react';
import { customersAPI } from '../services/api';
import { compressImageFile, isPdfDocument } from '../utils/imageCompressor';
import MapPickerModal from './MapPickerModal';
import toast from 'react-hot-toast';
import {
  X, User, Phone, MapPin, CreditCard, Camera, Upload, Trash2, Eye,
  RefreshCw, CheckCircle2, ShieldCheck, Users, Sparkles, FileText
} from 'lucide-react';

const RELATIONSHIPS = [
  'Father (அப்பா)',
  'Mother (அம்மா)',
  'Brother (சகோதரன்)',
  'Sister (சகோதரி)',
  'Spouse (மனைவி / கணவர்)',
  'Son (மகன்)',
  'Daughter (மகள்)',
  'Friend (நண்பர்)',
  'Relative (உறவினர்)',
  'Business Partner (பங்குதாரர்)',
  'Neighbor (அக்கம்பக்கத்தினர்)',
  'Other (மற்றவை)',
];

export default function AddCustomerModal({ isOpen, onClose, onSuccess, editCustomer = null }) {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'jamin'
  const [submitting, setSubmitting] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Full form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    idType: 'AADHAR',
    idNumber: '',
    idProofUrl: '',
    photoUrl: '',
    notificationPref: 'WHATSAPP',
    latitude: null,
    longitude: null,
    // Jamin (Guarantor) fields
    jaminName: '',
    jaminPhone: '',
    jaminAddress: '',
    jaminRelationship: 'Friend (நண்பர்)',
    jaminIdType: 'AADHAR',
    jaminIdNumber: '',
    jaminPhotoUrl: '',
    jaminIdProofUrl: '',
  });

  // Camera modal state
  const [cameraField, setCameraField] = useState(null); // 'photoUrl' | 'idProofUrl' | 'jaminPhotoUrl' | 'jaminIdProofUrl'
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Fullscreen image preview modal
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (editCustomer) {
      setForm({
        name: editCustomer.name || '',
        phone: editCustomer.phone || '',
        email: editCustomer.email || '',
        address: editCustomer.address || '',
        city: editCustomer.city || '',
        idType: editCustomer.idType || 'AADHAR',
        idNumber: editCustomer.idNumber || '',
        idProofUrl: editCustomer.idProofUrl || '',
        photoUrl: editCustomer.photoUrl || '',
        notificationPref: editCustomer.notificationPref === 'NONE' ? 'NONE' : 'WHATSAPP',
        latitude: editCustomer.latitude || null,
        longitude: editCustomer.longitude || null,
        jaminName: editCustomer.jaminName || '',
        jaminPhone: editCustomer.jaminPhone || '',
        jaminAddress: editCustomer.jaminAddress || '',
        jaminRelationship: editCustomer.jaminRelationship || 'Friend (நண்பர்)',
        jaminIdType: editCustomer.jaminIdType || 'AADHAR',
        jaminIdNumber: editCustomer.jaminIdNumber || '',
        jaminPhotoUrl: editCustomer.jaminPhotoUrl || '',
        jaminIdProofUrl: editCustomer.jaminIdProofUrl || '',
      });
    } else {
      setForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        idType: 'AADHAR',
        idNumber: '',
        idProofUrl: '',
        photoUrl: '',
        notificationPref: 'WHATSAPP',
        latitude: null,
        longitude: null,
        jaminName: '',
        jaminPhone: '',
        jaminAddress: '',
        jaminRelationship: 'Friend (நண்பர்)',
        jaminIdType: 'AADHAR',
        jaminIdNumber: '',
        jaminPhotoUrl: '',
        jaminIdProofUrl: '',
      });
    }
    setActiveTab('customer');
  }, [editCustomer, isOpen]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Camera Management
  const startCamera = async (field, mode = facingMode) => {
    setCameraField(field);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Unable to open camera. Please check camera permissions or upload an image.');
      setCameraField(null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraField(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraField) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    update(cameraField, dataUrl);
    stopCamera();
    toast.success('Photo captured!');
  };

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraField) startCamera(cameraField, next);
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      const processed = await compressImageFile(file, 1280, 0.82);
      update(field, processed);
      toast.success(isPdf ? 'PDF Document attached successfully!' : 'Photo attached successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to process document');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Customer name is required');
    if (!form.phone.trim()) return toast.error('Customer phone number is required');
    if (!form.address.trim()) return toast.error('Address is required');
    if (!form.idNumber.trim()) return toast.error('ID Number is required');

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        idType: form.idType || 'AADHAR',
        idNumber: form.idNumber.trim(),
        idProofUrl: form.idProofUrl || null,
        photoUrl: form.photoUrl || null,
        notificationPref: form.notificationPref || 'WHATSAPP',
        latitude: form.latitude !== null && form.latitude !== undefined && form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude: form.longitude !== null && form.longitude !== undefined && form.longitude !== '' ? parseFloat(form.longitude) : null,
        jaminName: form.jaminName?.trim() || null,
        jaminPhone: form.jaminPhone?.trim() || null,
        jaminAddress: form.jaminAddress?.trim() || null,
        jaminRelationship: form.jaminRelationship || null,
        jaminIdType: form.jaminIdType || 'AADHAR',
        jaminIdNumber: form.jaminIdNumber?.trim() || null,
        jaminPhotoUrl: form.jaminPhotoUrl || null,
        jaminIdProofUrl: form.jaminIdProofUrl || null,
      };

      let res;
      if (editCustomer && editCustomer.id) {
        res = await customersAPI.update(editCustomer.id, payload);
        toast.success('Customer details updated successfully!');
      } else {
        res = await customersAPI.create(payload);
        toast.success('Customer and Jamin created successfully!');
      }

      if (onSuccess) onSuccess(res);
      if (onClose) onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Reusable Image / Document Upload & Preview Box
  const renderImageUploader = (field, label, iconText, isAvatar = false) => {
    const val = form[field];
    const isPdf = isPdfDocument(val);

    return (
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
            {label}
          </span>
          {val && (
            <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {isPdf ? 'PDF Attached' : 'Attached'}
            </span>
          )}
        </div>

        {val ? (
          isPdf ? (
            /* PDF Document Attached Card */
            <div style={{
              position: 'relative',
              width: '100%',
              borderRadius: 8,
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 36,
                  height: 36,
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-color, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>PDF Document Attached</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setPreviewImage(val)}
                  title="View PDF Document"
                  style={{
                    background: 'var(--primary-600, #4f46e5)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Eye size={13} /> View
                </button>
                <button
                  type="button"
                  onClick={() => update(field, '')}
                  title="Remove Document"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    color: '#ef4444',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Image Preview */
            <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
              <img
                src={val}
                alt={label}
                style={{
                  width: '100%',
                  height: isAvatar ? 120 : 150,
                  objectFit: isAvatar ? 'cover' : 'contain',
                  background: '#f8fafc',
                  display: 'block',
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                display: 'flex',
                gap: 6,
                background: 'rgba(0,0,0,0.6)',
                padding: '4px 8px',
                borderRadius: 8,
                backdropFilter: 'blur(4px)',
              }}>
                <button
                  type="button"
                  onClick={() => setPreviewImage(val)}
                  title="View Fullscreen"
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2 }}
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => update(field, '')}
                  title="Remove Image"
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isAvatar ? '1fr 1fr' : '1fr 1fr',
            gap: 8,
            padding: '12px 6px',
            background: 'var(--bg-subtle, #f8fafc)',
            borderRadius: 8,
            border: '1px dashed var(--border-subtle, #cbd5e1)',
            textAlign: 'center',
          }}>
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--primary-600, #4f46e5)',
              padding: '8px 4px',
              borderRadius: 6,
              background: 'rgba(99, 102, 241, 0.08)',
            }}>
              <Upload size={16} />
              {isAvatar ? `Upload ${iconText}` : 'Upload Doc (Image/PDF)'}
              <input
                type="file"
                accept={isAvatar ? "image/*" : "image/*,application/pdf"}
                onClick={e => { e.target.value = ''; }}
                onChange={e => handleFileUpload(e, field)}
                style={{ display: 'none' }}
              />
            </label>

            <button
              type="button"
              onClick={() => startCamera(field)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent-600, #059669)',
                padding: '8px 4px',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(16, 185, 129, 0.08)',
              }}
            >
              <Camera size={16} />
              Camera
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal animate-scale-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 680,
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--card-bg, #ffffff)',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} style={{ color: 'var(--primary-500, #6366f1)' }} />
              {editCustomer ? 'Edit Customer & Jamin Profile' : 'Add New Customer & Guarantor (Jamin)'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
              Enter borrower details, photo, ID proof, and Jamin guarantor information
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-subtle, #f1f5f9)',
          padding: '6px 12px',
          gap: 8,
          borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'customer' ? 'var(--card-bg, #ffffff)' : 'transparent',
              color: activeTab === 'customer' ? 'var(--primary-600, #4f46e5)' : 'var(--text-muted, #64748b)',
              boxShadow: activeTab === 'customer' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <User size={15} /> 1. Customer Details & Proof
            {form.name && form.phone && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('jamin')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'jamin' ? 'var(--card-bg, #ffffff)' : 'transparent',
              color: activeTab === 'jamin' ? 'var(--primary-600, #4f46e5)' : 'var(--text-muted, #64748b)',
              boxShadow: activeTab === 'jamin' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <ShieldCheck size={15} /> 2. Jamin Person (ஜாமீன் நபர்)
            {form.jaminName && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            )}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {activeTab === 'customer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Basic Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Customer Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. R. Murugan"
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Mobile Phone Number *</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="10-digit mobile"
                      value={form.phone}
                      onChange={e => update('phone', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">City / Town *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Coimbatore"
                      value={form.city}
                      onChange={e => update('city', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email (Optional)</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="customer@email.com"
                      value={form.email}
                      onChange={e => update('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Complete Street Address *</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="House / Door No., Street, Area, Landmark"
                    value={form.address}
                    onChange={e => update('address', e.target.value)}
                    required
                  />
                </div>

                {/* Identity proof section */}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">ID Type *</label>
                    <select
                      className="form-select"
                      value={form.idType}
                      onChange={e => update('idType', e.target.value)}
                    >
                      <option value="AADHAR">Aadhar</option>
                      <option value="PAN">PAN Card</option>
                      <option value="VOTER">Voter ID</option>
                      <option value="DRIVING">Driving License</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{form.idType} Card Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Enter ${form.idType} Number`}
                      value={form.idNumber}
                      onChange={e => update('idNumber', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Customer Photo & ID Proof upload cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginTop: 4 }}>
                  {renderImageUploader('photoUrl', 'Customer Photo (புகைப்படம்)', 'Photo', true)}
                  {renderImageUploader('idProofUrl', `Customer ${form.idType} Document Proof *`, 'Document', false)}
                </div>

                {/* GPS Pin location */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} style={{ color: form.latitude ? '#10b981' : '#64748b' }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {form.latitude && form.longitude
                        ? `Pinned: ${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}`
                        : 'Location Pinning for Route Map (Optional)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowMapPicker(true)}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    {form.latitude ? 'Change Pin' : 'Pin on Map'}
                  </button>
                </div>

                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('jamin')}
                    style={{ gap: 6 }}
                  >
                    Next: Add Jamin Person (Guarantor) &rarr;
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'jamin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  fontSize: 12,
                  color: 'var(--primary-700, #4338ca)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Jamin Person (ஜாமீன் நபர்)</strong> is the guarantor responsible for the customer's loan. Attach their photo and document proof below.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Jamin Person Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. S. Kumar (Guarantor Name)"
                      value={form.jaminName}
                      onChange={e => update('jaminName', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Jamin Mobile Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="Jamin Phone Number"
                      value={form.jaminPhone}
                      onChange={e => update('jaminPhone', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Relationship with Customer</label>
                    <select
                      className="form-select"
                      value={form.jaminRelationship}
                      onChange={e => update('jaminRelationship', e.target.value)}
                    >
                      {RELATIONSHIPS.map(rel => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">ID Type</label>
                      <select
                        className="form-select"
                        value={form.jaminIdType}
                        onChange={e => update('jaminIdType', e.target.value)}
                      >
                        <option value="AADHAR">Aadhar</option>
                        <option value="PAN">PAN</option>
                        <option value="VOTER">Voter</option>
                        <option value="DRIVING">License</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">ID Number</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Card Number"
                        value={form.jaminIdNumber}
                        onChange={e => update('jaminIdNumber', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Jamin Person Address</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Guarantor complete address, city, landmark"
                    value={form.jaminAddress}
                    onChange={e => update('jaminAddress', e.target.value)}
                  />
                </div>

                {/* Jamin Photo & Jamin ID Proof Upload cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginTop: 4 }}>
                  {renderImageUploader('jaminPhotoUrl', 'Jamin Person Photo (ஜாமீன் புகைப்படம்)', 'Photo', true)}
                  {renderImageUploader('jaminIdProofUrl', 'Jamin ID Document Proof (ஆவண ஆதாரம்)', 'Document', false)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('customer')}
                  >
                    &larr; Back to Customer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: 'var(--card-bg, #ffffff)',
          }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: 140 }}
            >
              {submitting ? 'Saving...' : editCustomer ? 'Update Customer' : 'Save Customer & Jamin'}
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Live Camera Modal */}
      {cameraField && (
        <div
          className="modal-overlay"
          style={{ zIndex: 10001, background: 'rgba(0,0,0,0.85)' }}
          onClick={stopCamera}
        >
          <div
            style={{
              width: '90vw',
              maxWidth: 480,
              background: '#0f172a',
              borderRadius: 16,
              padding: 16,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Live Camera Capture</span>
              <button
                type="button"
                onClick={stopCamera}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ width: '100%', height: 320, background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleFacingMode}
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                <RefreshCw size={14} style={{ marginRight: 4 }} /> Flip Camera
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={capturePhoto}
                style={{ padding: '8px 24px', fontWeight: 700 }}
              >
                <Camera size={16} style={{ marginRight: 6 }} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Preview Modal */}
      {/* Fullscreen Photo or PDF Preview Modal */}
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
                alt="Preview"
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

      {/* Map Picker Modal for GPS coordinates */}
      {showMapPicker && (
        <MapPickerModal
          onClose={() => setShowMapPicker(false)}
          onConfirm={(coords) => {
            update('latitude', coords.lat);
            update('longitude', coords.lng);
            setShowMapPicker(false);
            toast.success('Location pinned!');
          }}
          initialLat={form.latitude}
          initialLng={form.longitude}
        />
      )}
    </div>
  );
}
