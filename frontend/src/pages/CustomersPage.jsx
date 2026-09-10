import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { customersAPI } from '../services/api';
import AddCustomerModal from '../components/AddCustomerModal';
import toast from 'react-hot-toast';
import {
  Plus, Search, Eye, Edit2, Trash2, Phone, ShieldCheck,
  MapPin, MessageCircle, Table, LayoutGrid, X, Users
} from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'NO_LOANS'

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

  // Filter calculations
  const totalCount = customers.length;
  const activeLoansCount = customers.filter(c => (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0)).length;
  const noLoansCount = totalCount - activeLoansCount;

  const filteredCustomers = customers.filter(c => {
    const hasActive = (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0);
    if (statusFilter === 'ACTIVE') return hasActive;
    if (statusFilter === 'NO_LOANS') return !hasActive;
    return true;
  });

  const renderAvatar = (c) => {
    if (c.photoUrl) {
      return (
        <img
          src={c.photoUrl}
          alt={c.name}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid var(--primary-400)',
            flexShrink: 0
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-600), var(--accent-500))',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 15,
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}
      >
        {c.name?.charAt(0).toUpperCase() || 'C'}
      </div>
    );
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Customers</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-600)', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: 12 }}>
              {customers.length} total
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Manage borrower profiles, guarantor records, and customer accounts
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 3 }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              style={{
                background: viewMode === 'table' ? 'var(--primary-600)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 7,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
            >
              <Table size={14} /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              style={{
                background: viewMode === 'grid' ? 'var(--primary-600)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 7,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>

          <button className="btn btn-primary" onClick={openAdd} style={{ gap: 6, padding: '8px 16px', fontWeight: 700 }}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Search Input */}
        <div className="search-bar" style={{ flex: 1, minWidth: 260, maxWidth: 440, position: 'relative' }}>
          <Search size={16} />
          <input
            placeholder="Search by name, phone, Jamin guarantor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            className={`tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active Loans ({activeLoansCount})
          </button>
          <button
            type="button"
            className={`tab ${statusFilter === 'NO_LOANS' ? 'active' : ''}`}
            onClick={() => setStatusFilter('NO_LOANS')}
          >
            No Loans ({noLoansCount})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Users size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No customers found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {search ? `No results matching "${search}"` : 'Get started by creating your first customer profile'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={14} /> Add Customer
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Crisp, Perfectly Aligned) */
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Customer</th>
                <th style={{ width: '20%' }}>Contact</th>
                <th style={{ width: '16%' }}>City / Location</th>
                <th style={{ width: '13%' }}>Active Loans</th>
                <th style={{ width: '15%' }}>Jamin Guarantor</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(c => {
                const hasActive = (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0);
                const loansCount = c.loans?.length || c.activeLoans || 0;

                return (
                  <tr key={c.id}>
                    <td data-label="Customer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {renderAvatar(c)}
                        <div style={{ minWidth: 0 }}>
                          <Link
                            to={`/customers/${c.id}`}
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={c.name}
                          >
                            {c.name}
                          </Link>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span className="badge badge-info" style={{ fontSize: 9, padding: '1px 6px', fontWeight: 700 }}>
                              {c.idType || 'AADHAR'}
                            </span>
                            {c.idNumber && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {c.idNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td data-label="Contact">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a
                          href={`tel:${c.phone}`}
                          style={{
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: 13,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          <Phone size={13} style={{ color: 'var(--primary-500)' }} />
                          {c.phone}
                        </a>
                        <a
                          href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Chat on WhatsApp"
                          style={{
                            color: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.08)'
                          }}
                        >
                          <MessageCircle size={13} />
                        </a>
                      </div>
                    </td>

                    <td data-label="City / Location">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                        <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{c.city || 'N/A'}</span>
                      </div>
                    </td>

                    <td data-label="Active Loans">
                      {hasActive ? (
                        <span className="badge badge-success" style={{ fontSize: 11, padding: '3px 8px' }}>
                          {loansCount} Active
                        </span>
                      ) : (
                        <span className="badge badge-muted" style={{ fontSize: 11, padding: '3px 8px' }}>
                          None
                        </span>
                      )}
                    </td>

                    <td data-label="Jamin Guarantor">
                      {c.jaminName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.jaminName}
                            </div>
                            {c.jaminRelationship && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {c.jaminRelationship.split(' ')[0]}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                      )}
                    </td>

                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link
                          to={`/customers/${c.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            color: 'var(--primary-600)',
                            background: 'rgba(99, 102, 241, 0.06)'
                          }}
                          title="View Details"
                        >
                          <Eye size={15} />
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            color: '#d97706',
                            background: 'rgba(217, 119, 6, 0.06)'
                          }}
                          onClick={() => openEdit(c)}
                          title="Edit Customer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            color: 'var(--danger-500)',
                            background: 'rgba(239, 68, 68, 0.06)'
                          }}
                          onClick={() => handleDelete(c)}
                          title="Delete Customer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID / CARDS VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredCustomers.map(c => {
            const hasActive = (c.loans && c.loans.length > 0) || (c.activeLoans && c.activeLoans > 0);
            const loansCount = c.loans?.length || c.activeLoans || 0;

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 14,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {/* Top: Avatar, Name, ID & Loans badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {renderAvatar(c)}
                    <div style={{ minWidth: 0 }}>
                      <Link
                        to={`/customers/${c.id}`}
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {c.name}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span className="badge badge-info" style={{ fontSize: 9, padding: '1px 6px', fontWeight: 700 }}>
                          {c.idType || 'AADHAR'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.city}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${hasActive ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {hasActive ? `${loansCount} Active` : 'No Loans'}
                  </span>
                </div>

                {/* Details snippet */}
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: 10, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> Phone
                    </span>
                    <a href={`tel:${c.phone}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                      {c.phone}
                    </a>
                  </div>
                  {c.jaminName && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed var(--border-subtle)' }}>
                      <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <ShieldCheck size={12} /> Jamin
                      </span>
                      <span style={{ fontWeight: 600 }}>{c.jaminName}</span>
                    </div>
                  )}
                </div>

                {/* Footer action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <Link
                    to={`/customers/${c.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                  >
                    <Eye size={13} /> View Details
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEdit(c)}
                    title="Edit Customer"
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, color: '#d97706' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(c)}
                    title="Delete Customer"
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--danger-500)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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

