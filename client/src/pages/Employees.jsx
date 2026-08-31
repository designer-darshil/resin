import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, LoadingCards, Pagination, Modal, EmptyState, Avatar } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, debounce, today } from '../utils/helpers.js';

const EMPTY_FORM = {
  full_name: '', phone: '', address: '', joining_date: today(),
  department: '', designation: '', salary_type: 'monthly', base_salary: '',
  overtime_rate: '', payment_frequency: 'monthly', notes: ''
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('employees', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await employeesApi.list(params);
      setEmployees(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useCallback(debounce(v => { setSearch(v); setPage(1); }, 350), []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      const emp = await employeesApi.create({ ...form, base_salary: parseFloat(form.base_salary) || 0, overtime_rate: parseFloat(form.overtime_rate) || 0 });
      toast.success('Employee created');
      setShowModal(false);
      setForm(EMPTY_FORM);
      navigate(`/employees/${emp.id}`);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Employees"
        subtitle={`${total} employees`}
        actions={canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Employee</button>}
      />

      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search name, code, phone…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
          <option value="resigned">Resigned</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Salary Type</th>
              <th>Base Salary</th>
              <th>Status</th>
              <th>Jobs</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : employees.map(e => (
                <tr key={e.id}>
                  <td><span className="tag">{e.employee_code}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={e.full_name} size={28} />
                      <span style={{ fontWeight: 500 }}>{e.full_name}</span>
                    </div>
                  </td>
                  <td className="text-muted">{e.department || '—'}</td>
                  <td className="text-muted">{e.designation || '—'}</td>
                  <td className="text-sm">{e.salary_type}</td>
                  <td>{e.base_salary !== undefined ? fmtCurrency(e.base_salary) : '—'}</td>
                  <td><StatusBadge status={e.employment_status || 'active'} /></td>
                  <td>{e.job_count}</td>
                  <td className="col-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/employees/${e.id}`)}>View</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && employees.length === 0 && (
          <EmptyState title="No employees found" description="Add your first employee" action={
            canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Employee</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : employees.map(e => (
          <div key={e.id} className="data-card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <Avatar name={e.full_name} />
              <div>
                <div className="data-card-title" style={{ marginBottom: 0 }}>{e.full_name}</div>
                <div className="text-sm text-muted">{e.employee_code} · {e.department || 'No dept'}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={e.employment_status || 'active'} /></div>
            </div>
            <div className="data-card-row"><span className="data-card-label">Designation</span><span>{e.designation || '—'}</span></div>
            <div className="data-card-row"><span className="data-card-label">Salary</span><span>{e.base_salary !== undefined ? fmtCurrency(e.base_salary) : '—'} / {e.salary_type}</span></div>
            <div className="data-card-row"><span className="data-card-label">Jobs</span><span>{e.job_count} assignments</span></div>
            <div className="data-card-actions">
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/employees/${e.id}`)}>View Profile</button>
            </div>
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Employee" size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add Employee'}</button>
        </>}>
        <form onSubmit={handleSave}>
          <div className="form-section-title">Personal Info</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name <span className="required">*</span></label>
              <input className="form-control" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" type="tel" inputMode="numeric" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-control" rows="2" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Joining Date</label>
              <input className="form-control" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-control" value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Coating, QC" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Designation</label>
            <input className="form-control" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Senior Coater" />
          </div>

          <div className="form-section-title" style={{ marginTop: 16 }}>Salary Info</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Salary Type</label>
              <select className="form-control" value={form.salary_type} onChange={e => set('salary_type', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
                <option value="piece_rate">Piece Rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Base Salary (₹)</label>
              <input className="form-control" type="number" inputMode="numeric" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Overtime Rate (₹/hr)</label>
              <input className="form-control" type="number" inputMode="numeric" value={form.overtime_rate} onChange={e => set('overtime_rate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Frequency</label>
              <select className="form-control" value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
