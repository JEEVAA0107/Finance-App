import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { customersAPI } from '../services/api';
import AddCustomerModal from '../components/AddCustomerModal';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, Edit2, Trash2, Phone, ShieldCheck, User } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  const load = async () => {
    try {
      setCustomers(await customersAPI.list({ search: debouncedSearch, limit: 100 }));
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load();
  }, [debouncedSearch]);

  const openAdd = () => {
    setEditCustomer(null);
    setShowModal(true);
  };

  const openEdit = async (c) => {
    setEditCustomer(c);
    setShowModal(true);
    try {
      const full = await customersAPI.get(c.id);
      if (full) setEditCustomer(full);
    } catch (_) {}
  };

  const handleCustomerSaved = (saved) => {
    if (saved && saved.id) {
      setCustomers(prev => {
        const idx = prev.findIndex(c => c.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...saved };
          return next;
        }
        return [saved, ...prev];
      });
    }
    load();
  };

  useEffect(() => {
    if (location.search.includes('new=true')) {
      openAdd();
      navigate('/customers', { replace: true });
    }
  }, [location.search, navigate]);

  const handleDelete = async (c) => {
    const hasActiveLoans = (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0);
    if (hasActiveLoans) {
      toast.error('Currently an active loan is running for this customer, so cannot delete.');
      return;
    }

    if (!confirm(`Remove customer "${c.name}"?`)) return;

    try {
      await customersAPI.delete(c.id);
      toast.success('Customer removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Currently an active loan is running for this customer, so cannot delete.');
    }
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          Customers <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>({customers.length})</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="search-bar" style={{ maxWidth: '100%', marginBottom: 14 }}>
        <Search size={16} />
        <input
          placeholder="Search name, phone, Jamin guarantor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No customers yet</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap Add Customer to register your first borrower</div>
        </div>
      ) : (
        customers.map(c => (
          <div key={c.id} className="collection-card flex items-center gap-14" style={{ marginBottom: 10 }}>
            {/* Customer Avatar / Photo */}
            {c.photoUrl ? (
              <img
                src={c.photoUrl}
                alt={c.name}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--primary-400)' }}
              />
            ) : (
              <div className="sidebar-avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0, fontWeight: 800 }}>
                {c.name?.charAt(0)}
              </div>
            )}

            {/* Customer Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                {c.idProofUrl && (
                  <span className="badge badge-info" style={{ fontSize: 9, padding: '2px 6px' }}>
                    {c.idType}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 6px', marginTop: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} />
                  <a href={`tel:${c.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.phone}</a>
                </div>
                <span>·</span>
                <span>{c.city}</span>
                {(c.loans?.length > 0 || c.activeLoans > 0) && (
                  <>
                    <span>·</span>
                    <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                      {c.loans?.length || c.activeLoans} Active Loan
                    </span>
                  </>
                )}
              </div>

              {/* Jamin Person Indicator */}
              {c.jaminName && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#059669',
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  marginTop: 4,
                }}>
                  <ShieldCheck size={12} />
                  <span>Jamin: {c.jaminName} {c.jaminRelationship ? `(${c.jaminRelationship.split(' ')[0]})` : ''}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Link to={`/customers/${c.id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} title="View Details">
                <Eye size={14} />
              </Link>
              <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} onClick={() => openEdit(c)} title="Edit Customer">
                <Edit2 size={14} />
              </button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px', color: 'var(--danger-400)' }} onClick={() => handleDelete(c)} title="Delete Customer">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add / Edit Customer Modal */}
      <AddCustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCustomerSaved}
        editCustomer={editCustomer}
      />
    </div>
  );
}
