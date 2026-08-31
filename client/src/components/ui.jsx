import { getStatusVariant, statusLabel } from '../utils/helpers.js';

export function StatusDot({ status }) {
  const variant = getStatusVariant(status);
  return <span className={`status-dot ${variant}`} />;
}

export function StatusBadge({ status, text }) {
  const variant = getStatusVariant(status);
  const label = text || statusLabel(status);
  return (
    <span className={`badge badge-${variant}`}>
      <span className={`status-dot ${variant}`} style={{ width: 5, height: 5 }} />
      {label}
    </span>
  );
}

export function StatCard({ label, value, sub, variant = '', onClick }) {
  return (
    <div
      className={`stat-card ${variant} ${onClick ? 'interactive' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {back && (
          <div className="breadcrumb">
            {back}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingRows({ cols = 5, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j}>
          <div className="skeleton-line" style={{ width: j === 0 ? '75%' : '50%', margin: 0 }} />
        </td>
      ))}
    </tr>
  ));
}

export function LoadingCards({ count = 4 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card" style={{ marginBottom: 12 }}>
      <div className="skeleton-line" style={{ width: '40%', marginBottom: 10, height: 16 }} />
      <div className="skeleton-line" style={{ width: '65%', height: 12 }} />
    </div>
  ));
}

export function Avatar({ name, size = 32 }) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius-md)',
      background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
      fontSize: size * 0.4, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--border-subtle)',
      flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false, loading = false }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = '' }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${size === 'large' ? 'modal-large' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function WhatsAppButton({ phone, message, label = 'Send WhatsApp', size = '' }) {
  if (!phone) return null;

  const handleClick = () => {
    const num = phone.replace(/[^0-9]/g, '');
    const fullNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(message || '')}`, '_blank');
  };

  return (
    <button className={`btn btn-whatsapp ${size === 'sm' ? 'btn-sm' : ''}`} onClick={handleClick}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.547 4.103 1.508 5.833L0 24l6.337-1.491A11.938 11.938 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.548 9.548 0 0 1-4.879-1.337l-.35-.208-3.619.851.886-3.523-.228-.363A9.547 9.547 0 0 1 2.4 12c0-5.292 4.308-9.6 9.6-9.6s9.6 4.308 9.6 9.6-4.308 9.6-9.6 9.6z"/>
      </svg>
      {label}
    </button>
  );
}

export function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  if (total === 0) return null;

  return (
    <div className="pagination">
      <span>Showing <strong>{from}–{to}</strong> of <strong>{total}</strong></span>
      <div className="pagination-controls">
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >← Prev</button>
        <span style={{ padding: '0 4px', fontWeight: 600 }}>{page} / {totalPages || 1}</span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >Next →</button>
      </div>
    </div>
  );
}

export function WorkflowPipeline({ steps, currentStep }) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  return (
    <div className="workflow-pipeline">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div
            key={step.id}
            className={`workflow-step ${isDone ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
          >
            <span>{isDone ? '✓' : `${i + 1}.`}</span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
