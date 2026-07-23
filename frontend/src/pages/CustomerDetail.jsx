import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import { User, Phone, MapPin, CreditCard, Landmark, ArrowLeft } from 'lucide-react';

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customersAPI.get(id).then(r => setCustomer(r)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading...</p></div>;
  if (!customer) return <div className="card empty-state"><h3>Customer not found</h3></div>;

  return (
    <div className="animate-in">
      <Link to="/customers" className="btn btn-ghost mb-24"><ArrowLeft size={16} />Back to Customers</Link>

      <div className="grid-2 mb-24">
        <div className="card">
          <div className="card-header"><div className="card-title"><User size={18} style={{ marginRight: 8 }} />Customer Details</div></div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div><span className="color-muted fs-12">NAME</span><div className="fw-600">{customer.name}</div></div>
            <div className="form-row">
              <div><span className="color-muted fs-12">PHONE</span><div><Phone size={14} style={{verticalAlign:'middle',marginRight:4}} /><a href={`tel:${customer.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{customer.phone}</a></div></div>
              <div><span className="color-muted fs-12">EMAIL</span><div>{customer.email || '-'}</div></div>
            </div>
            <div><span className="color-muted fs-12">ADDRESS</span><div><MapPin size={14} style={{verticalAlign:'middle',marginRight:4}} />{customer.address}, {customer.city}</div></div>
            <div className="form-row">
              <div><span className="color-muted fs-12">ID PROOF</span><div><CreditCard size={14} style={{verticalAlign:'middle',marginRight:4}} /><span className="badge badge-info">{customer.idType}</span> {customer.idNumber}</div></div>
              <div><span className="color-muted fs-12">SINCE</span><div>{formatDate(customer.createdAt)}</div></div>
            </div>
            {customer.idProofUrl && (
              <div style={{ marginTop: 8 }}>
                <span className="color-muted fs-12" style={{ display: 'block', marginBottom: 6 }}>ATTACHED ID PROOF DOCUMENT</span>
                <img 
                  src={customer.idProofUrl} 
                  alt={`${customer.idType} Proof`} 
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.02)', cursor: 'pointer' }} 
                  onClick={() => {
                    const w = window.open('');
                    w.document.write(`<img src="${customer.idProofUrl}" style="max-width:100%;height:auto;" />`);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title"><Landmark size={18} style={{ marginRight: 8 }} />Loan Summary</div></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-value" style={{ fontSize: 32, color: 'var(--primary-400)' }}>{customer.loans?.length || 0}</div>
              <div className="stat-label">Total Loans</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-value" style={{ fontSize: 32, color: 'var(--accent-400)' }}>
                {customer.loans?.filter(l => l.status === 'ACTIVE').length || 0}
              </div>
              <div className="stat-label">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loan History */}
      {customer.loans?.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Loan History</div></div>
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
        </div>
      )}
    </div>
  );
}
