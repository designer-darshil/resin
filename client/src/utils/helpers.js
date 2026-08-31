// Utility helpers

// Format currency
export function fmtCurrency(amount, symbol = '₹') {
  if (amount === null || amount === undefined) return `${symbol}0`;
  return `${symbol}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Format quantity
export function fmtQty(qty, unit = 'pcs') {
  if (qty === null || qty === undefined) return '0';
  return `${Number(qty).toLocaleString('en-IN')}`;
}

// Format date
export function fmtDate(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (format === 'DD/MM/YYYY') return `${day}/${mon}/${year}`;
  if (format === 'YYYY-MM-DD') return `${year}-${mon}-${day}`;
  return `${day} ${d.toLocaleString('default', { month: 'short' })} ${year}`;
}

// Today as YYYY-MM-DD
export function today() {
  return new Date().toISOString().split('T')[0];
}

// Get month name
export function monthName(num) {
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return months[num - 1] || '';
}

// Status badge variant mapper
export function getStatusVariant(status) {
  const map = {
    // Jobs
    draft: 'neutral', assigned: 'accent', in_progress: 'info', quality_check: 'warning',
    completed: 'success', partial: 'warning', rejected: 'error', cancelled: 'neutral',
    // Purchases
    expected: 'accent', received: 'success', partial_received: 'warning',
    // Dispatch
    ready: 'accent', dispatched: 'info', in_transit: 'warning', delivered: 'success', returned: 'error',
    // Employee
    active: 'success', inactive: 'neutral', on_leave: 'warning', resigned: 'neutral',
    // Payments / salary
    pending: 'warning', paid: 'success', approved: 'success', approved_status: 'success',
    // Overtime
    rejected_status: 'error',
  };
  return map[status] || 'neutral';
}

// Format status display label
export function statusLabel(status) {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// WhatsApp URL builder
export function buildWhatsAppUrl(phone, message) {
  const num = phone.replace(/[^0-9]/g, '');
  const fullNum = num.startsWith('91') ? num : `91${num}`;
  return `https://wa.me/${fullNum}?text=${encodeURIComponent(message)}`;
}

// Fill template variables
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// Truncate text
export function truncate(str, n = 40) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// Initials for avatar
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Debounce
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
