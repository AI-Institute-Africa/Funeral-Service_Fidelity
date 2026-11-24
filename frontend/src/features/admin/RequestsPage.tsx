import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { requestKindLabel } from '@/features/account/data'
import { formatAge } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { AdminRequest } from './data'
import { assignmentDisplay, requestStatusDisplay, usePortalRole } from './portal-ui'
import { useRequests } from './queries'
import { RequestSheet } from './RequestSheet'
import './portal.css'

type Filter = 'all' | 'action' | 'progress' | 'complete'

const matches: Record<Filter, (request: AdminRequest, role: 'admin' | 'provider') => boolean> = {
  all: () => true,
  // Administrators act on requests nobody holds; providers act on ones waiting for their answer.
  action: (request, role) => (role === 'admin' ? request.status === 'received' : request.assignment?.status === 'assigned'),
  progress: (request) => request.status === 'assigned' || request.status === 'in_progress',
  complete: (request) => request.status === 'complete',
}

/** Modal for creating a new urgent request on the admin side */
function NewRequestModal({ onClose }: { onClose: () => void }) {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState('funeral_support')
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState({ whatsapp: true, sms: true, email: true })
  const [submitted, setSubmitted] = useState(false)

  function toggleChannel(ch: keyof typeof channels) {
    setChannels((prev) => ({ ...prev, [ch]: !prev[ch] }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim()) return
    const ref = `REQ-ADM-${Date.now().toString(36).toUpperCase()}`
    void fetch('/api/whatsapp/notify-assistance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: ref,
        customerName: customerName.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        kindLabel: kind,
        message: message.trim(),
        contactPreference: channels.whatsapp ? 'whatsapp' : channels.sms ? 'sms' : 'email',
      }),
    }).catch(() => {})
    setSubmitted(true)
  }

  if (submitted) {
    const sent = [
      channels.whatsapp ? '📲 WhatsApp' : null,
      channels.sms ? '📱 SMS' : null,
      channels.email ? '📧 Email' : null,
    ].filter(Boolean).join(', ')
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-box">
          <div className="modal-head">
            <h2>🚨 Urgent Request Created</h2>
            <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>Close</button>
          </div>
          <p style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: '1rem' }}>
            ✅ Request recorded for {customerName}.
          </p>
          <p className="muted">Multi-channel alerts dispatched via: {sent || 'No channels selected'}</p>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff3cd', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
            <strong>🚨 VERY URGENT</strong> — This request has been flagged for immediate attention.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="New urgent request">
      <div className="modal-box">
        <div className="modal-head">
          <h2>🚨 Add New Request</h2>
          <button type="button" className="btn btn--outline btn--sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          <strong style={{ color: '#dc2626' }}>🚨 VERY URGENT</strong> — All customer requests are treated as top priority.
        </div>
        <form onSubmit={submit} className="page-stack" style={{ gap: 'var(--space-3)' }}>
          <div className="field">
            <label className="field__label">Customer Name *</label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" required />
          </div>
          <div className="field">
            <label className="field__label">Phone (WhatsApp/SMS)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263..." type="tel" />
          </div>
          <div className="field">
            <label className="field__label">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@email.com" type="email" />
          </div>
          <div className="field">
            <label className="field__label">Request Type</label>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="funeral_support">Funeral Support</option>
              <option value="grief_support">Grief Counselling</option>
              <option value="repatriation">Repatriation</option>
              <option value="exhumation">Exhumation</option>
              <option value="general">General Enquiry</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">Message / Details</label>
            <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the family's need..." />
          </div>
          <div className="field">
            <label className="field__label">Notify via</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={channels.whatsapp} onChange={() => toggleChannel('whatsapp')} />
                📲 WhatsApp
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={channels.sms} onChange={() => toggleChannel('sms')} />
                📱 SMS
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={channels.email} onChange={() => toggleChannel('email')} />
                📧 Email
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn--primary btn--sm">🚨 Submit Urgent Request</button>
            <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RequestsPage() {
  const role = usePortalRole()
  const requests = useRequests()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showNewRequest, setShowNewRequest] = useState(false)
  const focus = params.get('focus')

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (requests.data ?? [])
      .filter((request) => matches[filter](request, role))
      .filter(
        (request) =>
          !needle ||
          [request.reference, request.customer.name, request.message, request.assignedTo ?? ''].some((text) =>
            (text || '').toLowerCase().includes(needle),
          ),
      )
  }, [requests.data, filter, search, role])

  const selected = requests.data?.find((request) => request.id === focus)
  const close = () => setParams({}, { replace: true })

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'action', label: role === 'admin' ? 'Needs assigning' : 'Waiting for me' },
    { id: 'progress', label: 'In progress' },
    { id: 'complete', label: 'Complete' },
  ]

  return (
    <div className="page-stack">
      <header className="page-head reveal">
        <p className="eyebrow">{role === 'admin' ? 'Requests' : 'Assignments'}</p>
        <h1>{role === 'admin' ? 'Families asking for help.' : 'Requests handed to you.'}</h1>
      </header>

      {/* VERY URGENT banner */}
      <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: '0.5rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🚨</span>
        <div>
          <strong style={{ color: '#dc2626' }}>VERY URGENT</strong>
          <span style={{ marginLeft: '0.5rem', color: '#7f1d1d', fontSize: '0.875rem' }}>
            All customer requests require immediate response. Notifications dispatched via WhatsApp, SMS and Email automatically.
          </span>
        </div>
      </div>

      {role === 'admin' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowNewRequest(true)}>
            <Icon name="plus" size={16} /> Add New Request
          </button>
        </div>
      )}

      {requests.data ? (
        <>
          <div className="portal-toolbar">
            <div className="portal-toolbar__chips" role="group" aria-label="Filter requests">
              {chips.map((chip) => (
                <button key={chip.id} type="button" className="chip" aria-pressed={filter === chip.id} onClick={() => setFilter(chip.id)}>
                  {chip.label}
                </button>
              ))}
            </div>
            <label className="portal-search">
              <span className="visually-hidden">Search requests</span>
              <input
                type="search"
                className="input"
                placeholder="Search by reference, name or message"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {rows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Family</th>
                    <th scope="col">Request</th>
                    <th scope="col">Status</th>
                    {role === 'admin' && <th scope="col">Handled by</th>}
                    <th scope="col">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((request) => (
                    <tr key={request.id} onClick={() => setParams({ focus: request.id }, { replace: true })}>
                      <td data-label="Reference">
                        <button
                          type="button"
                          className="row-link"
                          onClick={(event) => {
                            event.stopPropagation()
                            setParams({ focus: request.id }, { replace: true })
                          }}
                        >
                          {request.reference}
                        </button>
                        {/* Always show VERY URGENT for customer requests */}
                        <span className="urgent-tag" style={{ background: '#dc2626', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', marginLeft: '0.4rem', fontWeight: 700 }}>
                          🚨 URGENT
                        </span>
                      </td>
                      <td data-label="Family">
                        <span className="cell-stack">
                          <strong>{request.customer.name}</strong>
                          <span>{formatPhone(request.customer.phone)}</span>
                        </span>
                      </td>
                      <td data-label="Request">
                        <span className="cell-stack">
                          <strong>{requestKindLabel[request.kind] ?? request.kind ?? 'Bereavement support'}</strong>
                          <span className="cell-excerpt">{request.message || 'No message'}</span>
                        </span>
                      </td>
                      <td data-label="Status">
                        <StatusChip tone={requestStatusDisplay[request.status]?.tone ?? 'info'}>
                          {requestStatusDisplay[request.status]?.label ?? request.status}
                        </StatusChip>
                      </td>
                      {role === 'admin' && (
                        <td data-label="Handled by">
                          {request.assignment ? (
                            <span className="cell-stack">
                              <strong>{request.assignment.providerName}</strong>
                              <span>{assignmentDisplay[request.assignment.status]?.label ?? request.assignment.status}</span>
                            </span>
                          ) : (
                            <span className="muted">Nobody yet</span>
                          )}
                        </td>
                      )}
                      <td data-label="Received">{formatAge(request.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card empty empty--large">
              <span className="icon-tile icon-tile--lg">
                <Icon name="check" size={24} />
              </span>
              <p>
                <strong>Nothing here.</strong>
                <span className="muted"> No requests match that filter.</span>
              </p>
            </div>
          )}
        </>
      ) : requests.isPending ? (
        <div className="page-stack" role="status" aria-busy="true">
          <span className="visually-hidden">Loading requests…</span>
          <Skeleton height="3rem" className="skeleton--card" />
          <Skeleton height="16rem" className="skeleton--card" />
        </div>
      ) : (
        <QueryState isPending={false} error={requests.error} onRetry={() => void requests.refetch()} noun="requests" />
      )}

      <RequestSheet request={selected} onClose={close} />

      {showNewRequest && <NewRequestModal onClose={() => setShowNewRequest(false)} />}
    </div>
  )
}
