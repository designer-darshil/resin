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
  const [receiveModal, setReceiveModal] = useState(null);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleReceive = async () => {
    if (!receiveQty || parseFloat(receiveQty) <= 0) { toast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      await purchasesApi.receive(id, {
        item_id: receiveModal.id,
        received_quantity: parseFloat(receiveQty),
        notes: receiveNotes
      });
      toast.success(`Received ${receiveQty} units into stock`);
      setReceiveModal(null);
      setReceiveQty('');
      setReceiveNotes('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton-line" style={{ height: 28, width: 220, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ height: 90 }} />
    </div>
  );
  if (!purchase) return null;

  const canReceive = hasPermission('purchases', 'can_edit');

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/purchases">Purchases</Link>
        <span>/</span>
        <strong>{purchase.purchase_code}</strong>
      </div>

      <PageHeader
        title={purchase.purchase_code}
        subtitle={`Supplier: ${purchase.supplier_name}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={purchase.status} />
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/suppliers/${purchase.supplier_id}`)}>
              Supplier Profile →
            </button>
          </div>
        }
      />

      {/* Snapshot Summary Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Order Total</div>
          <div className="stat-strip-value">{fmtCurrency(purchase.total_amount)}</div>
          <div className="stat-strip-sub">{fmtDate(purchase.purchase_date)}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Supplier Invoice</div>
          <div className="stat-strip-value" style={{ fontSize: 16 }}>{purchase.invoice_number || '—'}</div>
          <div className="stat-strip-sub">{purchase.supplier_name}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Items Count</div>
          <div className="stat-strip-value">{purchase.items?.length || 0}</div>
          <div className="stat-strip-sub">Diamond spec lines</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Inward Status</div>
          <div className="stat-strip-value" style={{ fontSize: 16 }}>
            <StatusBadge status={purchase.status} />
          </div>
          <div className="stat-strip-sub">Inventory update status</div>
        </div>
      </div>

      {/* Diamond Items Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
        <div style={{
          padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-subtle)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Diamond Line Items & Inward Receiving
          </span>
        </div>

        <div className="table-wrapper" style={{ border: 'none', margin: 0, boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Diamond Spec</th>
                <th>Shape</th>
                <th>Size / Sieve</th>
                <th className="num-col">Ordered Qty</th>
                <th className="num-col">Received Qty</th>
                <th className="num-col">Weight (ct)</th>
                <th className="num-col">Rate / pc</th>
                <th className="num-col">Total Amount</th>
                <th className="action-col">Stock Action</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map(item => {
                const isFullyReceived = (item.received_quantity || 0) >= item.quantity;
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.diamond_type || 'Diamond'}</td>
                    <td>{item.shape || 'Round'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.size || '—'}</td>
                    <td className="num-col" style={{ fontWeight: 600 }}>{fmtQty(item.quantity)} pcs</td>
                    <td className="num-col" style={{ color: isFullyReceived ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: 600 }}>
                      {fmtQty(item.received_quantity || 0)} pcs
                    </td>
                    <td className="num-col">{item.weight ? `${item.weight} ct` : '—'}</td>
                    <td className="num-col">{fmtCurrency(item.rate)}</td>
                    <td className="num-col" style={{ fontWeight: 600 }}>{fmtCurrency(item.total_amount)}</td>
                    <td className="action-col">
                      {isFullyReceived ? (
                        <span className="badge badge-success">✓ In Stock</span>
                      ) : canReceive ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setReceiveModal(item);
                            setReceiveQty(String(item.quantity - (item.received_quantity || 0)));
                          }}
                        >
                          Receive Inward
                        </button>
                      ) : (
                        <span className="badge badge-warning">Pending Inward</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward Receiving Modal */}
      <Modal
        open={Boolean(receiveModal)}
        onClose={() => setReceiveModal(null)}
        title={`Receive Stock — ${receiveModal?.diamond_type || 'Diamond Item'}`}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setReceiveModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleReceive} disabled={saving}>
              {saving ? 'Processing…' : 'Confirm Inward to Stock'}
            </button>
          </>
        }
      >
        {receiveModal && (
          <div>
            <div className="panel-subtle" style={{ marginBottom: 16 }}>
              <div className="data-row">
                <span className="data-row-label">Diamond Item:</span>
                <span className="data-row-value">{receiveModal.diamond_type} ({receiveModal.shape}, {receiveModal.size})</span>
              </div>
              <div className="data-row">
                <span className="data-row-label">Total Ordered:</span>
                <span className="data-row-value">{fmtQty(receiveModal.quantity)} pcs</span>
              </div>
              <div className="data-row">
                <span className="data-row-label">Already Received:</span>
                <span className="data-row-value">{fmtQty(receiveModal.received_quantity || 0)} pcs</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Receiving Quantity (pcs) *</label>
              <input
                className="form-control"
                type="number"
                value={receiveQty}
                onChange={e => setReceiveQty(e.target.value)}
                placeholder="Enter quantity received"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Inward Inspection Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Package inspection notes or lot verification..."
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
