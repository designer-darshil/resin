import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, debounce, today } from '../utils/helpers.js';

const EMPTY_FORM = {
  full_name: '', phone: '', address: '', joining_date: today(),
  department: 'Production', designation: 'Coating Operator', salary_type: 'monthly', base_salary: '',
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
      const emp = await employeesApi.create({
        ...form,
        base_salary: parseFloat(form.base_salary) || 0,
        overtime_rate: parseFloat(form.overtime_rate) || 0
      });
      toast.success('Employee created successfully');
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
        title="Employee Directory"
        subtitle="Manage operators, factory technicians, roles, and compensation"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Add Employee
          </button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search employee name, code, phone…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Employment Status</option>
          <option value="active">Active Staff</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
          <option value="resigned">Resigned</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Phone</th>
              <th className="num-col">Base Salary</th>
              <th className="num-col">OT Rate / hr</th>
              <th>Status</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={9} rows={6} />
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="No employees found"
                    description="Register your machine operators and supervisors to assign coating batches and track payroll."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                        + Add Employee
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => navigate(`/employees/${emp.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {emp.employee_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{emp.full_name}</td>
                  <td>{emp.department || 'Production'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.designation || 'Coater Operator'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.phone || '—'}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>
                    {fmtCurrency(emp.base_salary)}
                  </td>
                  <td className="num-col" style={{ color: 'var(--text-secondary)' }}>
                    {fmtCurrency(emp.overtime_rate)}
                  </td>
                  <td>
                    <StatusBadge status={emp.employment_status || 'active'} />
                  </td>
                  <td className="action-col" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/employees/${emp.id}`)}
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="mobile-card-list">
        {employees.map(emp => (
          <div key={emp.id} className="mobile-card" onClick={() => navigate(`/employees/${emp.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 4 }}>{emp.employee_code}</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.full_name}</div>
              </div>
              <StatusBadge status={emp.employment_status || 'active'} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              <span>{emp.designation || 'Operator'}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtCurrency(emp.base_salary)}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Add Employee Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Register New Employee"
        size="large"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Register Employee'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-section-title" style={{ marginTop: 0 }}>1. Personal &amp; Contact Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                className="form-control"
                placeholder="e.g. Rahul Patel"
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-control"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Joining Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.joining_date}
                onChange={e => set('joining_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-section-title">2. Role &amp; Department</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                className="form-control"
                placeholder="e.g. Production / Quality Control"
                value={form.department}
                onChange={e => set('department', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                className="form-control"
                placeholder="e.g. Senior Coating Operator"
                value={form.designation}
                onChange={e => set('designation', e.target.value)}
              />
            </div>
          </div>

          <div className="form-section-title">3. Compensation &amp; Payroll</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Salary Type</label>
              <select
                className="form-control"
                value={form.salary_type}
                onChange={e => set('salary_type', e.target.value)}
              >
                <option value="monthly">Monthly Fixed</option>
                <option value="daily">Daily Wage</option>
                <option value="piece_rate">Per Piece Rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Base Salary (₹) *</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 25000"
                value={form.base_salary}
                onChange={e => set('base_salary', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Overtime Rate / hr (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 150"
                value={form.overtime_rate}
                onChange={e => set('overtime_rate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <textarea
              className="form-textarea"
              placeholder="Address / ID proof notes"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
