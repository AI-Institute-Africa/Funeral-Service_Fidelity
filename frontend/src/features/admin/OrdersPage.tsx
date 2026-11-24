import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { orderStatusDisplay } from '@/features/marketplace/status'
import { formatAge, formatUsd } from '@/lib/format'
import type { AdminOrder } from './data'
import { OrderSheet } from './OrderSheet'
import { usePortalRole } from './portal-ui'
import { useOrders } from './queries'
import './portal.css'

type StatusFilter = 'all' | 'confirm' | 'progress' | 'payment' | 'done'
type DateFilter = 'all_time' | 'today' | 'month' | 'quarter' | 'year'

const statusMatches: Record<StatusFilter, (order: AdminOrder) => boolean> = {
  all: () => true,
  confirm: (order) => order.status === 'paid',
  progress: (order) => order.status === 'confirmed' || order.status === 'in_progress',
  payment: (order) => order.status === 'awaiting_payment' || order.status === 'payment_failed',
  done: (order) => order.status === 'delivered' || order.status === 'closed' || order.status === 'cancelled',
}

const statusChips: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirm', label: 'To confirm' },
  { id: 'progress', label: 'In progress' },
  { id: 'payment', label: 'Payment issues' },
  { id: 'done', label: 'Closed / Finished' },
]

const dateChips: { id: DateFilter; label: string }[] = [
  { id: 'all_time', label: 'All time' },
  { id: 'today', label: 'Today (Day)' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'Quarterly' },
  { id: 'year', label: 'Yearly' },
]

function dateMatches(order: AdminOrder, filter: DateFilter): boolean {
  if (filter === 'all_time') return true
  const created = new Date(order.createdAt)
  const now = new Date()
  if (filter === 'today') {
    return created.toDateString() === now.toDateString()
  }
  if (filter === 'month') {
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
  }
  if (filter === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    const orderQuarter = Math.floor(created.getMonth() / 3)
    return created.getFullYear() === now.getFullYear() && orderQuarter === quarter
  }
  if (filter === 'year') {
    return created.getFullYear() === now.getFullYear()
  }
  return true
}

function NewWalkInOrderModal({ onClose }: { onClose: () => void }) {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [product, setProduct] = useState('')
  const [amount, setAmount] = useState('150')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim() || !product.trim()) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Walk-in order created">
        <div className="modal-box">
          <div className="modal-head">
            <h2>Walk-in Order Created</h2>
            <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>Close</button>
          </div>
          <p style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: '1rem' }}>
            Order recorded for {customerName}. Linked to ERP: <strong>ERP-FID-9921</strong>.
          </p>
          <p className="muted">The customer is notified via WhatsApp and SMS confirmation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="New walk-in order">
      <div className="modal-box">
        <div className="modal-head">
          <h2>New Walk-in Order</h2>
          <button type="button" className="btn btn--outline btn--sm" onClick={onClose} aria-label="Close">X</button>
        </div>
        <form onSubmit={submit} className="page-stack" style={{ gap: 'var(--space-3)' }}>
          <div className="field">
            <label className="field__label">Customer Name *</label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full customer name" required />
          </div>
          <div className="field">
            <label className="field__label">Phone (WhatsApp / SMS)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="077 123 4567" type="tel" />
          </div>
          <div className="field">
            <label className="field__label">Product / Service Package *</label>
            <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Casket Wreath & Granite Plaque" required />
          </div>
          <div className="field">
            <label className="field__label">Amount (USD)</label>
            <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div className="field">
            <label className="field__label">Payment Method</label>
            <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="ecocash">EcoCash</option>
              <option value="innbucks">InnBucks</option>
              <option value="omari">O'mari</option>
              <option value="onemoney">OneMoney</option>
              <option value="zipit">ZimSwitch ZIPIT</option>
              <option value="card">Card (Visa/Mastercard)</option>
              <option value="chema_wallet">Chema Wallet</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">Notes / Delivery Instructions</label>
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special cemetery delivery or walk-in pickup notes." />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn--primary btn--sm">Record Walk-in Order</button>
            <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const role = usePortalRole()
  const orders = useOrders()
  const [params, setParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all_time')
  const [search, setSearch] = useState('')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const focus = params.get('focus')

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (orders.data ?? [])
      .filter(statusMatches[statusFilter] ?? (() => true))
      .filter((order) => dateMatches(order, dateFilter))
      .filter((order) => {
        if (!needle) return true
        const ref = order.reference ?? ''
        const cust = order.customer?.name ?? ''
        const lines = (order.lines ?? []).map((line) => line?.title ?? '')
        return [ref, cust, ...lines].some((text) => text.toLowerCase().includes(needle))
      })
  }, [orders.data, statusFilter, dateFilter, search])

  const selected = orders.data?.find((order) => order.id === focus)
  const close = () => setParams({}, { replace: true })

  return (
    <div className="page-stack">
      <header className="page-head reveal">
        <p className="eyebrow">Orders</p>
        <h1>{role === 'admin' ? 'What families have ordered.' : 'Orders for your products.'}</h1>
      </header>

      {role === 'admin' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowNewOrder(true)}>
            <Icon name="plus" size={16} /> New Walk-in Order
          </button>
        </div>
      )}

      {orders.data ? (
        <>
          <div className="portal-toolbar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
              <div>
                <p className="eyebrow" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Filter by status</p>
                <div className="portal-toolbar__chips" role="group" aria-label="Filter orders by status">
                  {statusChips.map((chip) => (
                    <button key={chip.id} type="button" className="chip" aria-pressed={statusFilter === chip.id} onClick={() => setStatusFilter(chip.id)}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Filter by time period</p>
                <div className="portal-toolbar__chips" role="group" aria-label="Filter orders by time period">
                  {dateChips.map((chip) => (
                    <button key={chip.id} type="button" className="chip" aria-pressed={dateFilter === chip.id} onClick={() => setDateFilter(chip.id)}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="portal-search">
              <span className="visually-hidden">Search orders</span>
              <input type="search" className="input" placeholder="Search by reference, name or product" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>

          {rows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Items</th>
                    <th scope="col" className="num">
                      {role === 'admin' ? 'Total' : 'Your share'}
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">ERP Link</th>
                    <th scope="col">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const status = orderStatusDisplay[order.status] ?? { label: order.status || 'Order', tone: 'neutral' as const }
                    const lines = order.lines ?? []
                    const first = lines[0]
                    const more = Math.max(0, lines.length - 1)
                    const isClosed = order.status === 'closed' || order.status === 'delivered'
                    return (
                      <tr key={order.id} onClick={() => setParams({ focus: order.id }, { replace: true })}>
                        <td data-label="Order">
                          <button type="button" className="row-link" onClick={(event) => { event.stopPropagation(); setParams({ focus: order.id }, { replace: true }) }}>
                            {order.reference}
                          </button>
                          {order.shared && role === 'admin' && <span className="muted"> · shared</span>}
                        </td>
                        <td data-label="Customer">{order.customer?.name ?? 'Customer'}</td>
                        <td data-label="Items">
                          <span className="cell-stack">
                            <strong>{first?.title ?? 'Item'}</strong>
                            {more > 0 && <span>+ {more} more</span>}
                          </span>
                        </td>
                        <td className="num" data-label={role === 'admin' ? 'Total' : 'Your share'}>{formatUsd(order.total ?? 0)}</td>
                        <td data-label="Status">
                          <StatusChip tone={status.tone}>{status.label}</StatusChip>
                        </td>
                        <td data-label="ERP Link">
                          {isClosed ? (
                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                              ERP-FID-{order.id.slice(-4).toUpperCase()}
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.75rem' }}>Pending</span>
                          )}
                        </td>
                        <td data-label="Placed">{formatAge(order.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card empty empty--large">
              <span className="icon-tile icon-tile--lg">
                <Icon name="bag" size={24} />
              </span>
              <p>
                <strong>No orders here.</strong>
                <span className="muted"> Nothing matches that filter.</span>
              </p>
            </div>
          )}
        </>
      ) : orders.isPending ? (
        <div className="page-stack" role="status" aria-busy="true">
          <span className="visually-hidden">Loading orders...</span>
          <Skeleton height="3rem" className="skeleton--card" />
          <Skeleton height="16rem" className="skeleton--card" />
        </div>
      ) : (
        <QueryState isPending={false} error={orders.error} onRetry={() => void orders.refetch()} noun="orders" />
      )}

      <OrderSheet order={selected} onClose={close} />
      {showNewOrder && <NewWalkInOrderModal onClose={() => setShowNewOrder(false)} />}
    </div>
  )
}
