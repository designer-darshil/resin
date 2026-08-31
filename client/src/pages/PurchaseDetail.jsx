import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { purchasesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty } from '../utils/helpers.js';

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiveModal, setReceiveModal] = useState(null); // item object
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await purchasesApi.get(id);
      setPurchase(data);
    } catch (err) {
      toast.error('Purchase not found');
      navigate('/purchases');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleReceive = async () => {
    if (!receiveQty || parseFloat(receiveQty) <= 0) { toast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      await purchasesApi.receive(id, { item_id: receiveModal.id, received_quantity: parseFloat(receiveQty), notes: receiveNotes });
      toast.success(`Received ${receiveQty} units`);
      setReceiveModal(null);
      setReceiveQty('');
      setReceiveNotes('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300 }} /></div>;
  if (!purchase) return null;

  const canReceive = hasPermission('purchases', 'can_edit');

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/purchases">Purchases</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{purchase.purchase_code}</span>
      </div>

      <PageHeader
        title={purchase.purchase_code}
        subtitle={`Supplier: ${purchase.supplier_name}`}
        actions={<StatusBadge status={purchase.status} />}
      />

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><h3>Purchase Info</h3></div>
          <div className="card-body">
            <div className="detail-field">
              <div className="detail-field-label">Supplier</div>
              <div className="detail-field-value">{purchase.supplier_name}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Purchase Date</div>
              <div className="detail-field-value">{fmtDate(purchase.purchase_date)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Invoice Number</div>
              <div className="detail-field-value">{purchase.invoice_number || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Total Amount</div>
              <div className="detail-field-value font-bold" style={{ fontSize: 20 }}>{fmtCurrency(purchase.total_amount)}</div>
            </div>
            {purchase.notes && (
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value">{purchase.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Stock Status</h3></div>
          <div className="card-body">
            {purchase.items?.map((item, i) => (
              <div key={item.id} style={{ marginBottom: 12, padding: 12, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="font-semibold text-sm">Item {i + 1}: {item.shape} {item.diamond_type}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <div><span className="text-muted text-xs">Ordered: </span><strong>{fmtQty(item.quantity)}</strong></div>
                  <div><span className="text-muted text-xs">Received: </span><strong style={{ color: 'var(--color-success)' }}>{fmtQty(item.received_quantity)}</strong></div>
                  <div><span className="text-muted text-xs">Pending: </span><strong style={{ color: 'var(--color-warning)' }}>{fmtQty(item.quantity - item.received_quantity)}</strong></div>
                </div>
                <div style={{ background: 'var(--color-border)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--color-success)', height: '100%', width: `${Math.min(100, (item.received_quantity / item.quantity) * 100)}%`, borderRadius: 2 }} />
                </div>
                {canReceive && item.received_quantity < item.quantity && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => { setReceiveModal(item); setReceiveQty(''); }}
                    >
                      Receive Stock
                    </button>
                    {item.raw_quantity > 0 && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 8 }}
                        onClick={() => navigate(`/coating-jobs?new=1&purchase_item_id=${item.id}`)}
                      >
                        Create Coating Job
                      </button>
                    )}
                  </div>
                )}
                {(!canReceive || item.received_quantity >= item.quantity) && item.raw_quantity > 0 && (
                   <button
                     className="btn btn-secondary btn-sm"
                     style={{ marginTop: 8 }}
                     onClick={() => navigate(`/coating-jobs?new=1&purchase_item_id=${item.id}`)}
                   >
                     Create Coating Job
                   </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card">
        <div className="card-header"><h3>Purchase Items</h3></div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Shape</th>
                <th>Size</th>
                <th>Color</th>
                <th>Clarity</th>
                <th>Qty</th>
                <th>Weight</th>
                <th>Rate</th>
                <th>Total</th>
                <th>Received</th>
                <th>Raw Stock</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>{item.diamond_type || '—'}</td>
                  <td>{item.shape || '—'}</td>
                  <td>{item.size || '—'}</td>
                  <td>{item.color || '—'}</td>
                  <td>{item.clarity || '—'}</td>
                  <td>{fmtQty(item.quantity)}</td>
                  <td>{item.weight ? `${item.weight} ct` : '—'}</td>
                  <td>{fmtCurrency(item.rate)}</td>
                  <td>{fmtCurrency(item.total_amount)}</td>
                  <td><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(item.received_quantity)}</span></td>
                  <td><span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{fmtQty(item.raw_quantity || 0)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile items */}
        <div className="data-cards" style={{ padding: 16 }}>
          {purchase.items?.map((item, i) => (
            <div key={item.id} className="data-card">
              <div className="data-card-title">Item {i + 1}: {item.shape} {item.diamond_type}</div>
              <div className="data-card-row"><span className="data-card-label">Size/Color/Clarity</span><span>{[item.size, item.color, item.clarity].filter(Boolean).join(' / ') || '—'}</span></div>
              <div className="data-card-row"><span className="data-card-label">Ordered</span><span>{fmtQty(item.quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Received</span><span className="text-success">{fmtQty(item.received_quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Total</span><span>{fmtCurrency(item.total_amount)}</span></div>
              {canReceive && item.received_quantity < item.quantity && (
                <div className="data-card-actions">
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { setReceiveModal(item); setReceiveQty(''); }}>Receive Stock</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Receive Modal */}
      <Modal open={!!receiveModal} onClose={() => setReceiveModal(null)} title="Receive Stock"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setReceiveModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleReceive} disabled={saving}>{saving ? 'Saving…' : 'Confirm Receive'}</button>
        </>}>
        {receiveModal && (
          <>
            <div className="info-box" style={{ marginBottom: 16 }}>
              Item: {receiveModal.shape} {receiveModal.diamond_type} · Remaining: <strong>{fmtQty(receiveModal.quantity - receiveModal.received_quantity)} pcs</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Received <span className="required">*</span></label>
              <input
                className="form-control"
                type="number"
                inputMode="numeric"
                max={receiveModal.quantity - receiveModal.received_quantity}
                value={receiveQty}
                onChange={e => setReceiveQty(e.target.value)}
                placeholder={`Max: ${receiveModal.quantity - receiveModal.received_quantity}`}
                autoFocus
              />
              <div className="form-hint">Cannot exceed remaining ordered quantity</div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Optional" />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
