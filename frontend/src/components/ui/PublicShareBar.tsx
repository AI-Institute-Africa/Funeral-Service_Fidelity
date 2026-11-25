import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type PublicShareBarProps = {
  url: string
  title: string
  message: string
  emailSubject?: string
  compact?: boolean
}

/** Reusable share bar for public pages: copy link, WhatsApp, Email, and native share. */
export function PublicShareBar({
  url,
  title,
  message,
  emailSubject,
  compact = false,
}: PublicShareBarProps) {
  const [copied, setCopied] = useState(false)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const whatsappText = encodeURIComponent(`${message} ${url}`)
  const mailSubject = encodeURIComponent(emailSubject ?? title)
  const mailBody = encodeURIComponent(`${message}\n\n${url}`)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback: focus/select handled by input onFocus
    }
  }

  return (
    <div
      role="region"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        marginTop: compact ? '0.5rem' : '0.85rem',
        padding: compact ? '0.75rem' : '0.85rem 1rem',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.94)',
        border: '1px solid var(--color-border, #e5e7eb)',
        color: '#1f2937',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        <input
          className="input"
          readOnly
          value={url}
          aria-label={title}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: '1 1 220px', minWidth: 0, fontSize: '0.875rem' }}
        />
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void copy()}>
          <Icon name="file" size={16} />
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a
          className="btn btn--primary btn--sm"
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="chat" size={16} />
          Share via WhatsApp
        </a>
        <a
          className="btn btn--outline btn--sm"
          href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
        >
          Share via Email
        </a>
        {canNativeShare && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => void navigator.share({ title, text: message, url }).catch(() => {})}
          >
            <Icon name="arrow-right" size={16} />
            More
          </button>
        )}
      </div>
    </div>
  )
}
