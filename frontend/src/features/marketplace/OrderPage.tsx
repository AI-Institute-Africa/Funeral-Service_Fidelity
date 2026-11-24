import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { paths } from '@/config/routes'
import { ApiError } from '@/lib/api-error'
import { formatDate, formatServiceTime, formatUsd } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { Order } from './data'
import { OrderTracker } from './OrderTracker'
import { PaymentPanel } from './PaymentPanel'
import { useOrder } from './queries'
import { needsPayment, orderStatusDisplay, paymentMethodLabel } from './status'
import { SummaryRows } from './SummaryRows'
import './shop.css'

export default function OrderPage() {
  const { id } = useParams()
  const order = useOrder(id)

  if (order.data) return <OrderView order={order.data} />

  if (order.error instanceof ApiError && order.error.status === 404) {
    return (
      <div className="page-stack">
        <div className="card empty empty--large">
          <h1 className="panel__title">We couldn’t find that order</h1>
          <p className="muted">It may belong to a different account.</p>
          <Link className="btn btn--primary" to={paths.accountOrders}>
            Back to my orders
          </Link>
        </div>
      </div>
    )
  }

  return order.isPending ? (
    <div className="page-stack" role="status" aria-busy="true">
      <span className="visually-hidden">Loading your order…</span>
      <Skeleton height="7rem" className="skeleton--card" />
      <Skeleton height="16rem" className="skeleton--card" />
    </div>
  ) : (
    <QueryState isPending={false} error={order.error} onRetry={() => void order.refetch()} noun="your order" />
  )
}

function OrderView({ order }: { order: Order }) {
  const [params] = useSearchParams()
  const justPlaced = params.get('placed') === '1'
  const status = orderStatusDisplay[order.status] ?? { label: order.status || 'Order', tone: 'neutral' as const }
  const paid = order.payment?.status === 'paid'
  const lines = order.lines ?? []
  const events = order.events ?? []
  const delivery = order.delivery
  const payment = order.payment

  return (
    <div className="page-stack">
      <header className="card order-head reveal">
        <div className="order-head__main">
          <p className="eyebrow">Order</p>
          <h1>{order.reference}</h1>
          <p className="muted">Placed {formatDate(order.createdAt)}</p>
        </div>
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
      </header>

      {paid && justPlaced && (
        <div className="celebrate" role="status">
          <span className="celebrate__mark" aria-hidden="true">
            <Icon name="check" size={28} />
          </span>
          <div>
            <p className="celebrate__title">Thank you. Your order is paid.</p>
            <p>The provider has been told and will confirm shortly. You can follow every step right here.</p>
          </div>
        </div>
      )}

      {paid && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🏛️</span>
            <div>
              <strong style={{ color: '#166534', fontSize: '0.95rem' }}>Posted to Fidelity Life Assurance ERP</strong>
              <div style={{ color: '#15803d', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                General Ledger: <code>GL-4100-FUNERAL-SERVICES-REVENUE</code> · Voucher: <code>{order.erpSync?.erpReference || `ERP-FLA-${order.reference}`}</code>
              </div>
            </div>
          </div>
          <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
            ✓ ERP Synchronized
          </span>
        </div>
      )}

      {needsPayment(order) || payment?.status === 'pending' ? (
        <div className="reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <PaymentPanel order={order} />
        </div>
      ) : (
        <section className="card panel reveal" style={{ '--i': 1 } as React.CSSProperties} aria-labelledby="progress-title">
          <h2 id="progress-title" className="panel__title">
            Progress
          </h2>
          <OrderTracker status={order.status} />
          <ol className="events">
            {[...events].reverse().map((event, idx) => (
              <li key={`${event.at}-${idx}`}>
                <span className="events__label">{event.label}</span>
                <time dateTime={event.at}>{formatServiceTime(event.at)}</time>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card panel reveal" style={{ '--i': 2 } as React.CSSProperties} aria-labelledby="items-title">
        <h2 id="items-title" className="panel__title">
          What you ordered
        </h2>
        <SummaryRows
          rows={lines.map((line, index) => ({ key: `${line.itemId}-${index}`, ...line, accent: '✦' }))}
          subtotal={order.subtotal ?? 0}
          deliveryFee={order.deliveryFee ?? 0}
          total={order.total ?? 0}
        />
      </section>

      <div className="order-details reveal" style={{ '--i': 3 } as React.CSSProperties}>
        {delivery && (
          <section className="card panel" aria-labelledby="delivery-details-title">
            <h2 id="delivery-details-title" className="panel__title">
              Delivery
            </h2>
            <dl className="details details--single">
              {delivery.recipientName && (
                <div>
                  <dt>For</dt>
                  <dd>{delivery.recipientName}</dd>
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
              {delivery.phone && (
                <div>
                  <dt>Contact</dt>
                  <dd>{formatPhone(delivery.phone)}</dd>
                </div>
              )}
              {delivery.neededBy && (
                <div>
                  <dt>Needed by</dt>
                  <dd>{formatDate(delivery.neededBy)}</dd>
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

        {payment && (
          <section className="card panel" aria-labelledby="payment-details-title">
            <h2 id="payment-details-title" className="panel__title">
              Payment
            </h2>
            <dl className="details details--single">
              <div>
                <dt>Method</dt>
                <dd>
                  {paymentMethodLabel[payment.method] ?? payment.method}
                  {payment.ecocashNumber && <> · {payment.ecocashNumber}</>}
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatUsd(payment.amount ?? order.total ?? 0)}</dd>
              </div>
              {payment.reference && (
                <div>
                  <dt>Reference</dt>
                  <dd>{payment.reference}</dd>
                </div>
              )}
              {payment.paidAt && (
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDate(payment.paidAt)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>

      <Callout tone="info" icon="phone">
        Something not right with this order?{' '}
        <Link to={`${paths.accountRequests}?new=general`}>Ask an adviser</Link> and quote {order.reference}.
      </Callout>
    </div>
  )
}
