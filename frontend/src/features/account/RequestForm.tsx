import { useState } from 'react'
import { Callout } from '@/components/ui/Callout'
import { Icon } from '@/components/ui/Icon'
import { getErrorMessage } from '@/lib/api-error'
import { useAuth } from '@/features/auth'
import {
  CONTACT_OPTIONS,
  MESSAGE_MAX_LENGTH,
  REQUEST_KINDS,
  type ContactPreference,
  type RequestKind,
} from './data'
import { useCreateRequest } from './queries'

const nextSteps = [
  'An adviser reads your request, usually within the hour.',
  'We have sent a confirmation alert to your WhatsApp.',
  'A private WhatsApp group has been initialized to coordinate all funeral stages.',
  'You can track every timeline milestone right here in the portal.',
]

type RequestFormProps = {
  initialKind?: RequestKind
  onClose: () => void
}

export function RequestForm({ initialKind = 'general', onClose }: RequestFormProps) {
  const { user } = useAuth()
  const [kind, setKind] = useState<RequestKind>(initialKind)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState<ContactPreference>('whatsapp')
  const [messageError, setMessageError] = useState<string>()
  const [inviteLink, setInviteLink] = useState<string>('')
  const create = useCreateRequest()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (kind === 'general' && message.trim().length < 10) {
      setMessageError('Tell us a little more so we can help.')
      return
    }
    setMessageError(undefined)
    create.mutate(
      { kind, message: message.trim(), contactPreference: contact },
      {
        onSuccess: async (data) => {
          try {
            const kindLabel = REQUEST_KINDS.find((k) => k.value === kind)?.label || 'Bereavement Support'
            const res = await fetch('/api/whatsapp/notify-assistance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: data.reference,
                customerName: user?.name,
                customerPhone: user?.phone,
                kindLabel,
                message: message.trim(),
                contactPreference: contact,
              }),
            })
            const body = await res.json().catch(() => ({}))
            if (body.inviteLink) {
              setInviteLink(body.inviteLink)
            }
          } catch {
            // Background dispatch fallback
          }
        },
      },
    )
  }

  if (create.isSuccess) {
    const waLink = inviteLink || `https://chat.whatsapp.com/invite/${btoa(create.data.reference).slice(0, 16)}`

    return (
      <section className="card panel request-done" aria-live="polite">
        <span className="celebrate__mark" aria-hidden="true">
          <Icon name="check" size={28} />
        </span>
        <h2 className="panel__title">We’ve received your request</h2>
        <p>
          Your reference is <strong>{create.data.reference}</strong>. Your request has been submitted successfully — please check your phone and WhatsApp for further actions.
        </p>

        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '16px',
            margin: '14px 0',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: 600 }}>
            <span>📱 Real-Time WhatsApp Group & Alerts Active</span>
          </div>
          <p style={{ margin: '8px 0 12px', fontSize: '13px', color: '#065f46' }}>
            We have created a dedicated WhatsApp Coordination Group for your family and our 24/7 operations team to manage
            collection, permits, chapel services, and burial logistics.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--sm"
            style={{
              background: '#25D366',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
            }}
          >
            <span>💬 Open Coordination WhatsApp Group</span>
          </a>
        </div>

        <ol className="next-steps">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button type="button" className="btn btn--dark" onClick={onClose}>
          Done
        </button>
      </section>
    )
  }

  return (
    <form className="card panel request-form" onSubmit={handleSubmit} noValidate>
      <h2 className="panel__title">How can we help?</h2>

      <fieldset className="choices">
        <legend className="visually-hidden">What do you need help with?</legend>
        {REQUEST_KINDS.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="kind"
              value={option.value}
              checked={kind === option.value}
              onChange={() => setKind(option.value)}
            />
            <span className="choice__body">
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {kind === 'bereavement' && (
        <Callout tone="info" icon="heart" role="status">
          We’re so sorry for your loss. You don’t need to write anything. An adviser will reach out immediately and initialize your WhatsApp coordination group.
        </Callout>
      )}

      <div className="field">
        <label className="field__label" htmlFor="request-message">
          Message
          {kind !== 'general' && <small className="field__tag">Optional</small>}
        </label>
        <textarea
          id="request-message"
          className="textarea"
          maxLength={MESSAGE_MAX_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={messageError ? true : undefined}
          aria-describedby={messageError ? 'request-message-error' : undefined}
          placeholder="Anything you’d like us to know?"
        />
        <small className="field__hint">
          {message.length}/{MESSAGE_MAX_LENGTH}
        </small>
        {messageError && (
          <small id="request-message-error" className="field__error" role="alert">
            {messageError}
          </small>
        )}
      </div>

      <fieldset className="segmented">
        <legend className="field__label">Best way to reach you</legend>
        <div className="segmented__options">
          {CONTACT_OPTIONS.map((option) => (
            <label key={option.value} className="segmented__option">
              <input
                type="radio"
                name="contact"
                value={option.value}
                checked={contact === option.value}
                onChange={() => setContact(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {create.error && (
        <Callout tone="danger" role="alert">
          {getErrorMessage(create.error)}
        </Callout>
      )}

      <div className="request-form__actions">
        <button type="submit" className="btn btn--primary" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Send request'}
        </button>
        <button type="button" className="btn btn--outline" onClick={onClose} disabled={create.isPending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
