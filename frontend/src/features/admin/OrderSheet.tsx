import { useState } from 'react'
import { Callout } from '@/components/ui/Callout'
import { Sheet } from '@/components/ui/Sheet'
import { StatusChip } from '@/components/ui/StatusChip'
import { orderStatusDisplay, paymentMethodLabel } from '@/features/marketplace/status'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatServiceTime, formatUsd } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { AdminOrder } from './data'
import { orderActionLabel, usePortalRole } from './portal-ui'
import { useUpdateOrderStatus } from './queries'
import './portal.css'

type OrderSheetProps = {
  /** The order to show; `undefined` closes the sheet. */
  order: AdminOrder | undefined
  onClose: () => void
}

export function OrderSheet({ order, onClose }: OrderSheetProps) {
  return (
    <Sheet open={Boolean(order)} onClose={onClose} eyebrow="Order" title={order?.reference ?? 'Order'}>
      {order && <OrderBody order={order} />}
    </Sheet>
  )
}

function OrderBody({ order }: { order: AdminOrder }) {
  const role = usePortalRole()
  const update = useUpdateOrderStatus()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const status = orderStatusDisplay[order.status] ?? { label: order.status || 'Order', tone: 'neutral' as const }
  const actions = order.actions ?? []
  const forward = actions.filter((action) => action !== 'cancelled')
  const canCancel = actions.includes('cancelled')

  const lines = order.lines ?? []
  const delivery = order.delivery
  const payment = order.payment
  const events = order.events ?? []

  return (
    <>
      <div className="sheet-actions">
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
        {order.scoped && <span className="muted">Showing your part of this order</span>}
      </div>

      {order.shared && (
        <Callout tone="info">
          {role === 'admin'
            ? 'This order includes more than one provider, so you coordinate it. Move it along when every provider is ready.'
            : 'This order includes other providers too, so our team coordinates it. You’ll see it here for reference.'}
        </Callout>
      )}

      {update.error && (
        <Callout tone="danger" role="alert">
          {getErrorMessage(update.error)}
        </Callout>
      )}

      {(forward.length > 0 || canCancel) && (
        <section className="sheet-section" aria-labelledby="next-title">
          <h3 id="next-title">Next step</h3>
          <div className="sheet-actions">
            {forward.map((action) => (
              <button key={action} type="button" className="btn btn--primary btn--sm" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, status: action })}>
                {orderActionLabel[action]}
              </button>
            ))}
            {canCancel && !confirmingCancel && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmingCancel(true)}>
                {orderActionLabel.cancelled}
              </button>
            )}
          </div>
          {confirmingCancel && (
            <Callout tone="warning" role="alert">
              Cancel {order.reference}? The customer is told, and any refund is arranged separately.
              <div className="sheet-actions" style={{ marginTop: 'var(--space-3)' }}>
                <button type="button" className="btn btn--deep btn--sm" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, status: 'cancelled' }, { onSuccess: () => setConfirmingCancel(false) })}>
                  Yes, cancel it
                </button>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmingCancel(false)}>
                  Keep it
                </button>
              </div>
            </Callout>
          )}
        </section>
      )}

            {role === 'admin' && (order.status === 'closed' || order.status === 'delivered') && (
        <section className="sheet-section" aria-labelledby="erp-title">
          <h3 id="erp-title">ERP Integration</h3>
          <div className="sheet-actions" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600 }}>
              Linked to SAP/ERP: ERP-FID-{order.id.slice(-4).toUpperCase()}
            </span>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => window.alert('Order synced to Fidelity SAP ERP system.')}>
              Re-sync to SAP / ERP
            </button>
          </div>
        </section>
      )}

      <section className="sheet-section" aria-labelledby="lines-title">
        <h3 id="lines-title">Items</h3>
        {lines.length > 0 ? (
          <ul className="mini-list">
            {lines.map((line, index) => (
              <li key={`${line?.itemId ?? 'item'}-${index}`}>
                <span>
                  <strong>
                    {line?.title ?? 'Product'}
                    {(line?.quantity ?? 1) > 1 && ` × ${line.quantity}`}
                  </strong>
                  {(line?.optionLabels?.length ?? 0) > 0 && <small>{line.optionLabels.join(' · ')}</small>}
                  {line?.personalisation && <small>“{line.personalisation}”</small>}
                  {role === 'admin' && line?.provider && <small>by {line.provider}</small>}
                </span>
                <span>{formatUsd(line?.lineTotal ?? 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No item details recorded.</p>
        )}
        <dl className="kv">
          <div>
            <dt>{order.scoped ? 'Your share' : 'Total'}</dt>
            <dd>{formatUsd(order.total ?? 0)}</dd>
          </div>
        </dl>
      </section>

      {delivery && (
        <section className="sheet-section" aria-labelledby="delivery-title">
          <h3 id="delivery-title">Delivery</h3>
          <dl className="kv">
            {delivery.recipientName && (
              <div>
                <dt>For</dt>
                <dd>{delivery.recipientName}</dd>
              </div>
            )}
            {delivery.phone && (
              <div>
                <dt>Phone</dt>
                <dd>{formatPhone(delivery.phone)}</dd>
              </div>
            )}
            {(delivery.address || delivery.town) && (
              <div>
                <dt>Where</dt>
                <dd>
                  {[delivery.address, delivery.town].filter(Boolean).join(', ')}
                </dd>
              </div>
            )}
            {delivery.neededBy && (
              <div>
                <dt>Needed by</dt>
                <dd>{formatDate(delivery.neededBy)}</dd>
              </div>
            )}
            {delivery.note && (
              <div>
                <dt>Note</dt>
                <dd>{delivery.note}</dd>
              </div>
            )}
            {order.inMemoryOf && (
              <div>
                <dt>In memory of</dt>
                <dd>{order.inMemoryOf}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {role === 'admin' && (
        <section className="sheet-section" aria-labelledby="customer-title">
          <h3 id="customer-title">Customer and payment</h3>
          <dl className="kv">
            <div>
              <dt>Customer</dt>
              <dd>{order.customer?.name ?? 'Customer'}</dd>
            </div>
            {payment && (
              <>
                <div>
                  <dt>Paid with</dt>
                  <dd>
                    {paymentMethodLabel[payment.method] ?? payment.method} · {payment.status}
                  </dd>
                </div>
                {payment.reference && (
                  <div>
                    <dt>Reference</dt>
                    <dd>{payment.reference}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </section>
      )}

      {events.length > 0 && (
        <section className="sheet-section" aria-labelledby="history-title">
          <h3 id="history-title">History</h3>
          <ul className="mini-list">
            {[...events].reverse().map((event, idx) => (
              <li key={`${event.at}-${idx}`}>
                <span>{event.label}</span>
                <small>{formatServiceTime(event.at)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
