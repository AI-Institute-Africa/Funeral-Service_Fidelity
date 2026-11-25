import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { REQUEST_KINDS, REQUEST_STEPS, type RequestKind, type RequestStatus } from './data'
import { useRequests } from './queries'
import { RequestCard } from './RequestCard'
import { RequestForm } from './RequestForm'
import './account.css'

const isRequestKind = (value: string | null): value is RequestKind => REQUEST_KINDS.some((kind) => kind.value === value)
const statusLabel = (status: RequestStatus) => REQUEST_STEPS.find((step) => step.value === status)?.label ?? status

export default function RequestsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('new')
  const [formOpen, setFormOpen] = useState(requested !== null)
  const [liveNotice, setLiveNotice] = useState<string | null>(null)
  const requestsQuery = useRequests()
  const prevSnapshot = useRef<Map<string, { status: RequestStatus; historyLen: number }> | null>(null)

  useEffect(() => {
    const refresh = () => {
      void requestsQuery.refetch()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'fidelity.mock.requestStore') refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('fidelity:requests-updated', refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('fidelity:requests-updated', refresh)
    }
  }, [requestsQuery.refetch])

  useEffect(() => {
    const items = requestsQuery.data
    if (!items) return

    if (prevSnapshot.current === null) {
      prevSnapshot.current = new Map(
        items.map((req) => [req.id, { status: req.status, historyLen: req.statusHistory?.length ?? 0 }]),
      )
      return
    }

    for (const req of items) {
      const prev = prevSnapshot.current.get(req.id)
      const nextHistoryLen = req.statusHistory?.length ?? 0
      if (prev && (prev.status !== req.status || nextHistoryLen > prev.historyLen)) {
        setLiveNotice(
          `Update: Your request ${req.reference} has moved to ${statusLabel(req.status)}. Check your WhatsApp, SMS, and email for details.`,
        )
        break
      }
    }

    prevSnapshot.current = new Map(
      items.map((req) => [req.id, { status: req.status, historyLen: req.statusHistory?.length ?? 0 }]),
    )
  }, [requestsQuery.data])

  const closeForm = () => {
    setFormOpen(false)
    if (requested !== null) setParams({}, { replace: true })
  }

  return (
    <div className="page-stack">
      <header className="page-head page-head--row reveal">
        <div>
          <p className="eyebrow">Requests</p>
          <h1>Help, on your terms.</h1>
        </div>
        {!formOpen && (
          <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
            <Icon name="plus" size={18} />
            New request
          </button>
        )}
      </header>

      {liveNotice && (
        <Callout tone="success" role="status">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{liveNotice}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setLiveNotice(null)}
              aria-label="Dismiss update notification"
            >
              Dismiss
            </button>
          </div>
        </Callout>
      )}

      {formOpen && <RequestForm initialKind={isRequestKind(requested) ? requested : 'general'} onClose={closeForm} />}

      {requestsQuery.data ? (
        requestsQuery.data.length > 0 ? (
          <div className="request-list">
            {requestsQuery.data.map((request, index) => (
              <div key={request.id} className="reveal" style={{ '--i': index } as React.CSSProperties}>
                <RequestCard request={request} />
              </div>
            ))}
          </div>
        ) : (
          !formOpen && (
            <div className="card empty empty--large">
              <span className="icon-tile icon-tile--lg">
                <Icon name="chat" size={24} />
              </span>
              <p>
                <strong>No requests yet.</strong>
                <span className="muted"> Ask us anything: a claim, a question, or help planning ahead.</span>
              </p>
              <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
                Ask for help
              </button>
            </div>
          )
        )
      ) : requestsQuery.isPending ? (
        <div className="request-list" role="status" aria-busy="true">
          <span className="visually-hidden">Loading your requests…</span>
          <Skeleton height="8rem" className="skeleton--card" />
          <Skeleton height="8rem" className="skeleton--card" />
        </div>
      ) : (
        <QueryState isPending={false} error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} noun="your requests" />
      )}
    </div>
  )
}
