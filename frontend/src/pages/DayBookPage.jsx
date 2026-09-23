import { useState, useEffect } from 'react';
import api from '../services/api';
import { IndianRupee, Plus, FileText, ArrowDownRight, ArrowUpRight, HandCoins, Building2, Wallet, AlertTriangle, TrendingUp, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DayBookPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'OFFICE', description: '' });

  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/daybook/summary?date=${date}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load daybook data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayBook();
  }, [date]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/daybook/expense', { ...expenseForm, date });
      toast.success('Expense added');
      setShowModal(false);
      setExpenseForm({ amount: '', category: 'OFFICE', description: '' });
      fetchDayBook();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const fmt = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  if (loading && !data) return <div className="p-4">Loading day book...</div>;

  return (
    <div className="page-container animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Day Book</h1>
          <p className="page-subtitle">Daily cash flow, collections & profit breakdown</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input 
            type="date" 
            className="form-input" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            style={{ width: 'auto' }}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><Wallet size={20} /></div>
          <div className="stat-value">{fmt(data?.openingBalance)}</div>
          <div className="stat-label">Opening Balance (ஆரம்ப இருப்பு)</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><ArrowDownRight size={20} /></div>
          <div className="stat-value">{fmt((data?.collections || 0) + (data?.processingFees || 0))}</div>
          <div className="stat-label">Total Inflow (வரவு)</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow"><Landmark size={20} /></div>
          <div className="stat-value">{fmt(data?.loanDistributed)}</div>
          <div className="stat-label">Loans Distributed (வழங்கிய கடன்)</div>
        </div>
        <div className="stat-card purple" style={{ background: 'var(--primary-600)', color: 'white' }}>
          <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}><IndianRupee size={20} /></div>
          <div className="stat-value" style={{ color: 'white' }}>{fmt(data?.cashInHand)}</div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Cash in Hand (கல்லா இருப்பு)</div>
        </div>
      </div>

      {/* Income & Outflow Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Income Details */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HandCoins size={18} className="color-success" /> Income Details (வரவு விவரம்)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Principal Collected (அசல் வசூல்)</span>
              <span className="font-bold" style={{ color: '#059669' }}>{fmt(data?.principalCollected)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Interest Collected (வட்டி வசூல்)</span>
              <span className="font-bold" style={{ color: '#d97706' }}>{fmt(data?.interestCollected)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Advance Deduction / Fees (பிடித்தம்)</span>
              <span className="font-bold" style={{ color: 'var(--primary-600)' }}>{fmt(data?.processingFees)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Penalty Collected (அபராத வசூல்)</span>
              <span className="font-bold" style={{ color: 'var(--danger)' }}>{fmt(data?.penaltyCollected)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', marginTop: 4 }}>
              <span className="font-bold">Total Inflow (மொத்த வசூல்)</span>
              <span className="font-bold" style={{ color: '#059669', fontSize: '15px' }}>{fmt((data?.collections || 0) + (data?.processingFees || 0))}</span>
            </div>
          </div>
        </div>

        {/* Outflow Details */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} className="color-danger" /> Outflow Details (செலவு & கடன்)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Loans Distributed (வழங்கிய கடன் அசல்)</span>
              <span className="font-bold" style={{ color: '#d97706' }}>{fmt(data?.loanDistributed)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Office Expenses (அலுவலகச் செலவு)</span>
              <span className="font-bold" style={{ color: 'var(--danger)' }}>{fmt(data?.officeExpenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginTop: 4 }}>
              <span className="font-bold">Total Outflow (மொத்த வெளியீடு)</span>
              <span className="font-bold" style={{ color: '#dc2626', fontSize: '15px' }}>{fmt((data?.loanDistributed || 0) + (data?.officeExpenses || 0))}</span>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)', fontSize: '12px', color: 'var(--text-muted)' }}>
              💡 <b>Note:</b> வழங்கப்பட்ட கடன் மூலதனம் (Market Capital) என்பதால், தினசரி கல்லா இருப்பில் (Cash in Hand) இருந்து கழிக்கப்படாமல் வரவு மட்டும் நேரடியாக கணக்கிடப்படுகிறது.
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Profit Breakdown Section */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.02) 100%)', border: '1.5px solid rgba(245, 158, 11, 0.28)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <TrendingUp size={20} /> Profit Breakdown (லாப விவரம்)
          </h3>
          <span style={{ fontSize: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#b45309', padding: '4px 12px', borderRadius: '12px', fontWeight: 700 }}>
            Date: {date}
          </span>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Interest Profit */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Pure Interest Profit (வட்டி லாபம்)</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
              {fmt(data?.interestProfit || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              வட்டி வசூல் + முன்பணம் பிடித்தம்
            </div>
          </div>

          {/* Penalty Profit */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Penalty Profit (அபராத லாபம்)</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', marginTop: '6px' }}>
              {fmt(data?.penaltyProfit || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              வசூலான தாமதக் கட்டணங்கள்
            </div>
          </div>

          {/* Total Combined Profit */}
          <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(217, 119, 6, 0.08))', padding: '16px 18px', borderRadius: '12px', border: '1.5px solid rgba(245, 158, 11, 0.45)' }}>
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>Total Combined Profit (மொத்த லாபம்)</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
              {fmt(data?.totalProfit || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>
              வட்டி + அபராதம் சேர்ந்த நிகர லாபம்
            </div>
          </div>
        </div>
      </div>

      {/* Expense List */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} className="color-primary" /> Expense List (அலுவலகச் செலவுப் பட்டியல்)
        </h3>
        {data?.expenseDetails?.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.expenseDetails.map(exp => (
                  <tr key={exp.id}>
                    <td><span className="badge badge-secondary">{exp.category}</span></td>
                    <td>{exp.description || '-'}</td>
                    <td className="font-bold">{fmt(exp.amount)}</td>
                    <td className="color-muted">{new Date(exp.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No office expenses recorded for this date.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal animate-in" style={{ maxWidth: '420px', padding: '0' }}>
            <div className="modal-header">
              <h3>Add Office Expense</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddExpense} className="modal-body">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select 
                  className="form-select" 
                  value={expenseForm.category} 
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  <option value="OFFICE">Office Expense</option>
                  <option value="TEA_SNACKS">Tea & Snacks</option>
                  <option value="PETROL">Petrol / Conveyance</option>
                  <option value="SALARY">Salary</option>
                  <option value="RENT">Rent</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 50" 
                  value={expenseForm.amount} 
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} 
                  required 
                  min="1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Staff evening tea" 
                  value={expenseForm.description} 
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} 
                />
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
