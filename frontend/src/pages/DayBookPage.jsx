import { useState, useEffect } from 'react';
import api from '../services/api';
import { IndianRupee, Plus, FileText, ArrowDownRight, ArrowUpRight, HandCoins, Building2, Wallet } from 'lucide-react';
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
          <p className="page-subtitle">Daily cash flow & office expenses</p>
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

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><Wallet size={20} /></div>
          <div className="stat-value">{fmt(data?.openingBalance)}</div>
          <div className="stat-label">Opening Balance</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><ArrowDownRight size={20} /></div>
          <div className="stat-value">{fmt(data?.collections + data?.processingFees)}</div>
          <div className="stat-label">Total In (Collections + Fees)</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow"><ArrowUpRight size={20} /></div>
          <div className="stat-value">{fmt(data?.loanDistributed + data?.officeExpenses)}</div>
          <div className="stat-label">Total Out (Loans + Expenses)</div>
        </div>
        <div className="stat-card purple" style={{ background: 'var(--primary-600)', color: 'white' }}>
          <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}><IndianRupee size={20} /></div>
          <div className="stat-value" style={{ color: 'white' }}>{fmt(data?.cashInHand)}</div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Cash in Hand</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HandCoins size={18} className="color-success" /> Income Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Collections (EMI/Interest)</span>
              <span className="font-bold">{fmt(data?.collections)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Processing Fees</span>
              <span className="font-bold">{fmt(data?.processingFees)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} className="color-danger" /> Outflow Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Loans Distributed (Principal)</span>
              <span className="font-bold">{fmt(data?.loanDistributed)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <span className="color-muted font-medium">Office Expenses</span>
              <span className="font-bold">{fmt(data?.officeExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} className="color-primary" /> Expense List
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
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Add Office Expense</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddExpense} className="modal-body">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-input"
                  value={expenseForm.category}
                  onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                >
                  <option value="OFFICE">Office Supply</option>
                  <option value="PETTY_CASH">Petty Cash</option>
                  <option value="FOOD">Food / Snacks</option>
                  <option value="TRAVEL">Travel / Fuel</option>
                  <option value="MISC">Miscellaneous</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                  placeholder="E.g. Printer ink, Tea..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
