import { useState } from 'react'
import { Callout } from '@/components/ui/Callout'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { StatusChip } from '@/components/ui/StatusChip'
import { requestKindLabel, CONTACT_OPTIONS } from '@/features/account/data'
import { getErrorMessage } from '@/lib/api-error'
import { formatAge, formatServiceTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import type { AdminRequest } from './data'
import { assignmentDisplay, requestActionLabel, requestStatusDisplay, usePortalRole } from './portal-ui'
import { useAssignRequest, useRespondToRequest } from './queries'
import './portal.css'

type RequestSheetProps = {
  /** The request to show; `undefined` closes the sheet. */
  request: AdminRequest | undefined
  onClose: () => void
}

const contactLabel = (value?: string) =>
  (value && CONTACT_OPTIONS.find((option) => option.value === value)?.label) ?? value ?? 'Phone call'

export function RequestSheet({ request, onClose }: RequestSheetProps) {
  const title = request ? (requestKindLabel[request.kind] ?? request.kind ?? 'Assistance Request') : 'Request'
  return (
    <Sheet open={Boolean(request)} onClose={onClose} eyebrow={request?.reference} title={title}>
      {request && <RequestBody request={request} />}
    </Sheet>
  )
}

function RequestBody({ request }: { request: AdminRequest }) {
  const role = usePortalRole()
  const respond = useRespondToRequest()
  const status = requestStatusDisplay[request.status] ?? { tone: 'info', label: request.status || 'Received' }
  const responses = (request.actions || []).filter((action): action is 'accepted' | 'declined' | 'completed' => action !== 'assign')
  const assignmentStatus = request.assignment
    ? (assignmentDisplay[request.assignment.status] ?? { tone: 'info', label: request.assignment.status })
    : null

  return (
    <>
      <div className="sheet-actions">
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
        {request.urgent && <span className="urgent-tag">Urgent</span>}
      </div>

      <section className="sheet-section" aria-labelledby="family-title">
        <h3 id="family-title">The family</h3>
        <dl className="kv">
          <div>
            <dt>Name</dt>
            <dd>{request.customer?.name || 'Customer'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{formatPhone(request.customer?.phone || '')}</dd>
          </div>
          <div>
            <dt>Prefers</dt>
            <dd>{contactLabel(request.contactPreference)}</dd>
          </div>
          {role === 'admin' && (
            <div>
              <dt>Policy</dt>
              <dd>
                {request.customer?.policyNumber
                  ? `${request.customer.policyNumber} (${request.customer.policyStatus || 'Active'})`
                  : 'No policy linked'}
              </dd>
            </div>
          )}
          <div>
            <dt>Received</dt>
            <dd>
              {formatAge(request.createdAt)} · {formatServiceTime(request.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="sheet-section" aria-labelledby="message-title">
        <h3 id="message-title">What they said</h3>
        {request.message ? (
          <blockquote className="quote">“{request.message}”</blockquote>
        ) : (
          <p className="muted">They didn’t leave a message. Please call.</p>
        )}
      </section>

      {request.assignment && assignmentStatus && (
        <section className="sheet-section" aria-labelledby="assignment-title">
          <h3 id="assignment-title">Handled by</h3>
          <dl className="kv">
            <div>
              <dt>Provider</dt>
              <dd>{request.assignment.providerName}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusChip tone={assignmentStatus.tone}>{assignmentStatus.label}</StatusChip>
              </dd>
            </div>
            <div>
              <dt>Assigned</dt>
              <dd>{formatServiceTime(request.assignment.assignedAt)}</dd>
            </div>
            {request.assignment.respondedAt && (
              <div>
                <dt>Answered</dt>
                <dd>{formatServiceTime(request.assignment.respondedAt)}</dd>
              </div>
            )}
          </dl>
          {request.assignment.note && <p className="note-box">Note: {request.assignment.note}</p>}
        </section>
      )}

      {(request.actions || []).includes('assign') && <AssignForm request={request} />}

      {respond.error && (
        <Callout tone="danger" role="alert">
          {getErrorMessage(respond.error)}
        </Callout>
      )}

      {responses.length > 0 && (
        <section className="sheet-section" aria-labelledby="actions-title">
          <h3 id="actions-title">{role === 'admin' ? 'Or close it' : 'Your answer'}</h3>
          <div className="sheet-actions">
            {responses.map((action) => (
              <button
                key={action}
                type="button"
                className={`btn btn--sm ${
                  action === 'declined' ? 'btn--outline' : action === 'completed' && role === 'admin' ? 'btn--outline' : 'btn--primary'
                }`}
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: request.id, status: action })}
              >
                {action === 'accepted' && <Icon name="check" size={16} />}
                {requestActionLabel[action]}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

const FIDELITY_STAFF_MEMBERS = [
  { id: 'staff-chikwanha', name: 'Tariro Chikwanha', role: 'Senior Funeral Director & Case Lead', phone: '+263790499962' },
  { id: 'staff-gumbo', name: 'Farai Gumbo', role: 'Mortuary & Logistics Coordinator', phone: '+263772555666' },
  { id: 'staff-bmoyo', name: 'Blessing Moyo', role: 'Field Officer & Fleet Operations', phone: '+263771888999' },
  { id: 'staff-dube', name: 'Chipo Dube', role: 'Chapel & Ceremony Coordinator', phone: '+263773000222' },
  { id: 'staff-ndlovu', name: 'Nomsa Ndlovu', role: 'Head of Funeral Operations', phone: '+263773000333' },
]

function AssignForm({ request }: { request: AdminRequest }) {
  const assign = useAssignRequest()
  const [staffId, setStaffId] = useState('')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string>()

  const reassign = Boolean(request.assignment) && request.assignment?.status !== 'declined'

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!staffId) {
      setProblem('Choose a Fidelity Staff member.')
      return
    }
    setProblem(undefined)
    const chosenStaff = FIDELITY_STAFF_MEMBERS.find((s) => s.id === staffId)
    assign.mutate({ id: request.id, providerId: staffId, note: note.trim() || undefined })
    if (chosenStaff) {
      void fetch('/api/whatsapp/notify-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReference: request.reference,
          coordinatorName: chosenStaff.name,
          customerName: request.customer?.name,
          customerPhone: request.customer?.phone,
          notes: note.trim() || undefined,
        }),
      }).catch(() => {})
    }
  }

  return (
    <form className="sheet-section" onSubmit={submit} noValidate aria-labelledby="assign-title">
      <h3 id="assign-title">{reassign ? 'Reassign to another staff member' : 'Assign Fidelity Staff Member'}</h3>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.825rem', color: '#991b1b', marginBottom: '0.75rem' }}>
        <strong>🔒 Policy:</strong> People assigned to cases must be verified Fidelity Staff members only.
      </div>
      {request.assignment?.status === 'declined' && (
        <Callout tone="warning" role="status">
          Previous assignment was declined. Choose another Fidelity staff member.
        </Callout>
      )}

      <div className="field">
        <label className="field__label" htmlFor="assign-staff">
          Fidelity Staff Member
        </label>
        <select
          id="assign-staff"
          className="select"
          value={staffId}
          onChange={(event) => setStaffId(event.target.value)}
          aria-invalid={problem ? true : undefined}
        >
          <option value="">Select Fidelity Staff member…</option>
          {FIDELITY_STAFF_MEMBERS.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.name} · {staff.role} ({staff.phone})
            </option>
          ))}
        </select>
        {problem && (
          <small className="field__error" role="alert">
            {problem}
          </small>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="assign-note">
          Task instructions / internal briefing <small className="field__tag">Optional</small>
        </label>
        <textarea
          id="assign-note"
          className="textarea"
          rows={3}
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Briefing notes for the assigned Fidelity officer."
        />
        <small className="field__hint">The family never sees this note.</small>
      </div>

      {assign.error && (
        <Callout tone="danger" role="alert">
          {getErrorMessage(assign.error)}
        </Callout>
      )}

      <div>
        <button type="submit" className="btn btn--primary btn--sm" disabled={assign.isPending}>
          {assign.isPending ? 'Assigning…' : reassign ? 'Reassign Staff' : 'Assign Fidelity Staff'}
        </button>
      </div>
    </form>
  )
}
