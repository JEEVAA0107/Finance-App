import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, Edit2, Trash2, X, Phone, Camera, Upload, RefreshCw } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', idType: 'AADHAR', idNumber: '', idProofUrl: '', notificationPref: 'WHATSAPP' });

  // Camera states & refs
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const load = async () => {
    try { setCustomers(await customersAPI.list({ search: debouncedSearch, limit: 100 })); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [debouncedSearch]);

  const openAdd = () => { setForm({ name: '', phone: '', address: '', city: '', idType: 'AADHAR', idNumber: '', idProofUrl: '', notificationPref: 'WHATSAPP' }); setEditCustomer(null); setShowModal(true); };
  const openEdit = (c) => { setEditCustomer(c); setForm({ name: c.name, phone: c.phone, address: c.address, city: c.city, idType: c.idType, idNumber: c.idNumber, idProofUrl: c.idProofUrl || '', notificationPref: c.notificationPref === 'NONE' ? 'NONE' : 'WHATSAPP' }); setShowModal(true); };

  const startCamera = async (mode = facingMode) => {
    setShowCamera(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Could not access camera. Please allow camera permissions or upload an image file.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setForm(prev => ({ ...prev, idProofUrl: dataUrl }));
    stopCamera();
    toast.success('Photo captured successfully!');
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, idProofUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editCustomer && !form.idProofUrl) {
      toast.error('Please upload an ID proof image (Aadhar / PAN / Driving License)');
      return;
    }
    try {
      editCustomer ? await customersAPI.update(editCustomer.id, form) : await customersAPI.create(form);
      toast.success(editCustomer ? 'Updated!' : 'Customer added!');
      setShowModal(false); load();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleDelete = async (c) => {
    const hasActiveLoans = (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0);
    if (hasActiveLoans) {
      toast.error('Currently an active loan is running for this customer, so cannot delete.');
      return;
    }

    if (!confirm(`Remove customer "${c.name}"?`)) return;

    try {
      await customersAPI.delete(c.id);
      toast.success('Removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Currently an active loan is running for this customer, so cannot delete.');
    }
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Customers <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>({customers.length})</span></div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={15} /> Add</button>
      </div>

      {/* Search */}
      <div className="search-bar" style={{ maxWidth: '100%', marginBottom: 14 }}>
        <Search size={16} />
        <input placeholder="Search name, phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No customers yet</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap Add to create your first customer</div>
        </div>
      ) : (
        customers.map(c => (
          <div key={c.id} className="collection-card flex items-center gap-16">
            <div className="sidebar-avatar" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>{c.name?.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 6px', marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={10} />
                  <a href={`tel:${c.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.phone}</a>
                </div>
                <span>·</span>
                <span>{c.city}</span>
              </div>
              {(c.loans?.length > 0 || c.activeLoans > 0) && (
                <span className="badge badge-info" style={{ marginTop: 4, fontSize: 10 }}>{c.loans?.length || c.activeLoans} loan{(c.loans?.length || c.activeLoans) > 1 ? 's' : ''}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Link to={`/customers/${c.id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }}><Eye size={14} /></Link>
              <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} onClick={() => openEdit(c)}><Edit2 size={14} /></button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px', color: 'var(--danger-400)' }} onClick={() => handleDelete(c)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, fontSize: 16 }}>{editCustomer ? 'Edit Customer' : 'New Customer'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Address *</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">ID Type *</label>
                    <select className="form-select" value={form.idType} onChange={e => setForm({ ...form, idType: e.target.value })}>
                      <option value="AADHAR">Aadhar</option>
                      <option value="PAN">PAN</option>
                      <option value="VOTER">Voter ID</option>
                      <option value="DRIVING">Driving</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ID Number *</label>
                    <input className="form-input" value={form.idNumber} onChange={e => setForm({ ...form, idNumber: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    ID Proof Image (Aadhar / PAN / Driving License) {!editCustomer && <span style={{ color: 'var(--danger-400)' }}>*</span>}
                  </label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', justifyContent: 'center', fontSize: 13 }}
                      onClick={() => startCamera()}
                    >
                      <Camera size={16} style={{ color: 'var(--primary-500)', marginRight: 6 }} /> Take Photo
                    </button>
                    
                    <label 
                      className="btn btn-ghost" 
                      style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', justifyContent: 'center', fontSize: 13, cursor: 'pointer', margin: 0 }}
                    >
                      <Upload size={16} style={{ color: 'var(--accent-500)', marginRight: 6 }} /> Upload File
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleImageUpload} 
                      />
                    </label>
                  </div>

                  {form.idProofUrl && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 10, border: '1px dashed var(--accent-400)' }}>
                      <img 
                        src={form.idProofUrl} 
                        alt="ID Proof Document" 
                        style={{ width: 80, height: 55, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-subtle)' }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-600)' }}>✓ Image Attached</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ready for customer record</div>
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--danger-400)', fontSize: 12, padding: '4px 8px' }} 
                        onClick={() => setForm({ ...form, idProofUrl: '' })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Notification Preferences</label>
                  <select className="form-select" value={form.notificationPref} onChange={e => setForm({ ...form, notificationPref: e.target.value })}>
                    <option value="WHATSAPP">WhatsApp Only</option>
                    <option value="NONE">Do Not Send</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editCustomer ? 'Update' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Camera Stream Modal */}
      {showCamera && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={stopCamera}>
          <div className="modal animate-in" style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '12px 16px', background: '#000', color: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} style={{ color: 'var(--accent-400)' }} /> Capture ID Proof Photo
              </div>
              <button className="modal-close" style={{ color: '#fff' }} onClick={stopCamera}><X size={18} /></button>
            </div>
            
            <div style={{ position: 'relative', background: '#000', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }} 
              />
              <button 
                type="button" 
                onClick={toggleFacingMode} 
                title="Switch Camera (Front/Back)"
                style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <RefreshCw size={18} />
              </button>
            </div>

            <div style={{ padding: 16, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <button type="button" className="btn btn-ghost" style={{ color: '#94a3b8' }} onClick={stopCamera}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'var(--accent-500)', border: 'none', padding: '10px 24px', fontWeight: 700, borderRadius: 24, display: 'flex', alignItems: 'center', gap: 8 }} 
                onClick={capturePhoto}
              >
                <Camera size={18} /> Take Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
