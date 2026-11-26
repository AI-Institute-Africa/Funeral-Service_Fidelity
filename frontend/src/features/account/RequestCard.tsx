import { Icon, type IconName } from '@/components/ui/Icon'
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip'
import { formatRelativeDays, formatServiceTime } from '@/lib/format'
import { useCancelRequest } from './queries'
import {
  requestKindLabel,
  REQUEST_STEPS,
  type AssistanceRequest,
  type RequestKind,
  type RequestStatus,
  type StatusHistoryEntry,
} from './data'

const kindIcon: Record<RequestKind, IconName> = { bereavement: 'heart', claim: 'file', general: 'chat' }

const statusTone: Record<RequestStatus, StatusTone> = {
  received: 'info',
  assigned: 'info',
  in_progress: 'warning',
  complete: 'success',
  cancelled: 'danger',
}

const statusLabel = (status: RequestStatus) =>
  status === 'cancelled' ? 'Cancelled' : (REQUEST_STEPS.find((step) => step.value === status)?.label ?? status)

function buildHistory(request: AssistanceRequest): StatusHistoryEntry[] {
  if (request.statusHistory && request.statusHistory.length > 0) {
    return request.statusHistory
  }
  const entries: StatusHistoryEntry[] = [
    { status: 'received', label: 'Received', at: request.createdAt, note: 'Request submitted' },
  ]
  if (request.assignment) {
    entries.push({
      status: 'assigned',
      label: 'Adviser assigned',
      at: request.assignment.assignedAt || request.createdAt,
      note: `Assigned to ${request.assignment.providerName}`,
    })
    if (request.assignment.status === 'accepted' && request.assignment.respondedAt) {
      entries.push({
        status: 'in_progress',
        label: 'In progress',
        at: request.assignment.respondedAt,
        note: `${request.assignment.providerName} accepted and started work`,
      })
    } else if (request.assignment.status === 'completed' && request.assignment.respondedAt) {
      entries.push({
        status: 'complete',
        label: 'Complete',
        at: request.assignment.respondedAt,
        note: `Completed by ${request.assignment.providerName}`,
      })
    } else if (request.assignment.status === 'declined' && request.assignment.respondedAt) {
      entries.push({
        status: 'received',
        label: 'Received',
        at: request.assignment.respondedAt,
        note: `${request.assignment.providerName} declined; awaiting reassignment`,
      })
    }
  }
  return entries
}

type RequestCardProps = {
  request: AssistanceRequest
  /** Dashboard variant: no message, no stepper labels. */
  compact?: boolean
}

export function RequestCard({ request, compact = false }: RequestCardProps) {
  const cancel = useCancelRequest()
  const currentIndex = REQUEST_STEPS.findIndex((step) => step.value === request.status)
  const history = compact ? [] : buildHistory(request)
  const canCancel = !compact && request.status !== 'complete' && request.status !== 'cancelled'

  return (
    <article className={`request-card${compact ? ' request-card--compact' : ''}`}>
      <div className="request-card__head">
        <span className="icon-tile">
          <Icon name={kindIcon[request.kind]} size={20} />
        </span>
        <div className="request-card__title">
          <strong>{requestKindLabel[request.kind]}</strong>
          <span className="muted">
            {request.reference} · {formatRelativeDays(request.createdAt)}
          </span>
        </div>
        <StatusChip tone={statusTone[request.status]}>{statusLabel(request.status)}</StatusChip>
      </div>

      {!compact && request.message && <p className="request-card__message">“{request.message}”</p>}

      {!compact && (
        <>
          <ol className="stepper" aria-label="Request progress">
            {REQUEST_STEPS.map((step, index) => (
              <li
                key={step.value}
                className={`stepper__step${index < currentIndex ? ' is-done' : ''}${index === currentIndex ? ' is-current' : ''}`}
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                <span className="stepper__dot" aria-hidden="true">
                  {index < currentIndex && <Icon name="check" size={12} />}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
          {request.assignedTo && (
            <p className="request-card__adviser">
              <Icon name="user" size={16} /> {request.assignedTo} is looking after this for you.
            </p>
          )}
          {history.length > 0 && (
            <div className="request-card__history" aria-label="Activity log">
              <p className="request-card__history-title">Progress &amp; notification log</p>
              <ul className="request-card__history-list">
                {history.map((entry, idx) => (
                  <li key={`${entry.status}-${entry.at}-${idx}`} className="request-card__history-item">
                    <span className="request-card__history-dot" aria-hidden="true">
                      {idx < history.length - 1 || entry.status === 'complete' ? '✓' : '●'}
                    </span>
                    <div className="request-card__history-body">
                      <strong>{entry.label}</strong>
                      <span className="muted"> — {formatServiceTime(entry.at)}</span>
                      {entry.note && <span className="request-card__history-note"> ({entry.note})</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canCancel && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ color: '#dc2626', borderColor: '#fecaca' }}
                disabled={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Cancel request ${request.reference}?`)) {
                    cancel.mutate(request.id)
                  }
                }}
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel request'}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}
