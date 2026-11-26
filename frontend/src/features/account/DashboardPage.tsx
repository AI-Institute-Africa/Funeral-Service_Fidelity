import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { contributePath, paths } from '@/config/routes'
import { chemaStore } from '@/features/chema-wallet/store'
import { useAuth } from '@/features/auth'
import { OrdersSummaryCard } from '@/features/marketplace'
import { MemorialsSummaryCard } from '@/features/memorials'
import { greeting, statusDisplay } from './cover'
import { NextActions, NoPolicyCard, ChemaWalletAccountCard } from './DashboardPanels'
import { LinkedCelebration } from './LinkedCelebration'
import { PolicyCard } from './PolicyCard'
import { usePolicy, useRequests } from './queries'
import { RequestCard } from './RequestCard'
import { useJustLinked } from './useJustLinked'
import './account.css'

const RECENT_REQUESTS = 3

export default function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const welcome = Boolean((location.state as { welcome?: boolean } | null)?.welcome)

  const policyQuery = usePolicy()
  const requestsQuery = useRequests()
  const policy = policyQuery.data
  const justLinked = useJustLinked(policy)

  const firstName = user?.name.split(' ')[0] ?? ''
  const [shareOpen, setShareOpen] = useState(false)
  const [copiedChema, setCopiedChema] = useState(false)
  const chemaCases = chemaStore.getState().cases
  const activeChema = chemaCases.find((entry) => entry.activated && entry.contributionToken) ?? chemaCases.find((entry) => Boolean(entry.contributionToken))
  const chemaShareUrl = activeChema?.contributionToken ? `${window.location.origin}${contributePath(activeChema.contributionToken)}` : ''

  const statusLine = (() => {
    if (policy === undefined) return null
    if (!policy) return 'Let’s get you covered. Link a policy you already have, or get a quote.'
    return `Your ${policy.planName} is ${statusDisplay[policy.status].label.toLowerCase()}. We’re here whenever you need us.`
  })()

  return (
    <div className="dashboard">
      <header className="account-hero reveal">
        <p className="account-hero__eyebrow">{welcome ? 'Welcome to your account' : greeting()}</p>
        <h1>{firstName ? `${firstName}, ` : ''}here’s where things stand.</h1>
        {statusLine ? <p className="account-hero__lead">{statusLine}</p> : <Skeleton width="60%" height="1.2rem" className="account-hero__skeleton" />}
        <div className="account-hero__actions">
          <Link className="btn btn--primary" to={`${paths.accountRequests}?new=claim`}>
            <Icon name="phone" size={18} />
            Claims &amp; support
          </Link>
          <Link className="btn btn--outline" to={paths.accountPolicy}>
            {policy ? 'View my policy' : 'Link a policy'}
          </Link>
          {chemaShareUrl ? (
            <button type="button" className="btn btn--outline" onClick={() => setShareOpen((open) => !open)}>
              <Icon name="wallet" size={18} />
              Share Chema link
            </button>
          ) : (
            <Link className="btn btn--outline" to={paths.accountChemaWallet}>
              <Icon name="wallet" size={18} />
              Share Chema link
            </Link>
          )}
        </div>
        {shareOpen && chemaShareUrl && (
          <div
            role="region"
            aria-label="Share Chema Wallet contribution link"
            style={{
              marginTop: '0.85rem',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(185, 28, 28, 0.25)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#1f2937',
            }}
          >
            <input
              className="input"
              readOnly
              value={chemaShareUrl}
              aria-label="Chema contribution link"
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: '1 1 240px', minWidth: 0 }}
            />
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(chemaShareUrl)
                  setCopiedChema(true)
                  window.setTimeout(() => setCopiedChema(false), 3000)
                } catch {}
              }}
            >
              {copiedChema ? '✓ Copied' : 'Copy link'}
            </button>
            <a
              className="btn btn--primary btn--sm"
              href={`https://wa.me/?text=${encodeURIComponent(`You can support the family through this verified Chema Wallet contribution page: ${chemaShareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="chat" size={16} /> Share via WhatsApp
            </a>
            <a
              className="btn btn--outline btn--sm"
              href={`mailto:?subject=${encodeURIComponent('Support the family — Chema Wallet Contribution Link')}&body=${encodeURIComponent(`Hello,\n\nYou can send a bereavement contribution (Chema) to support the family through this verified Chema Wallet page:\n\n${chemaShareUrl}\n\nThank you for your kindness and support.`)}`}
            >
              ✉️ Share via Email
            </a>
            <Link className="btn btn--outline btn--sm" to={contributePath(activeChema!.contributionToken)}>
              Open page →
            </Link>
          </div>
        )}
      </header>

      <div className="dashboard__grid">
        <div className="dashboard__main">
          {justLinked && <LinkedCelebration policyNumber={justLinked.number} />}

          <div className="reveal" style={{ '--i': 1 } as React.CSSProperties}>
            {policy ? (
              <PolicyCard policy={policy} />
            ) : policy === null ? (
              <NoPolicyCard />
            ) : policyQuery.isPending ? (
              <Skeleton height="17rem" className="skeleton--card" />
            ) : (
              <QueryState isPending={false} error={policyQuery.error} onRetry={() => void policyQuery.refetch()} noun="your policy" />
            )}
          </div>

          <section className="card panel reveal" style={{ '--i': 2 } as React.CSSProperties} aria-labelledby="recent-title">
            <div className="panel__head">
              <h2 id="recent-title" className="panel__title">
                Recent requests
              </h2>
              <Link className="link-arrow" to={paths.accountRequests}>
                View all <Icon name="arrow-right" size={16} />
              </Link>
            </div>

            {requestsQuery.data ? (
              requestsQuery.data.length > 0 ? (
                <div className="request-list">
                  {requestsQuery.data.slice(0, RECENT_REQUESTS).map((request) => (
                    <RequestCard key={request.id} request={request} compact />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <span className="icon-tile icon-tile--lg">
                    <Icon name="chat" size={24} />
                  </span>
                  <p>
                    <strong>Nothing here yet.</strong>
                    <span className="muted"> When you ask us for help, you can follow it here, step by step.</span>
                  </p>
                  <Link className="btn btn--outline btn--sm" to={`${paths.accountRequests}?new=general`}>
                    Ask for help
                  </Link>
                </div>
              )
            ) : requestsQuery.isPending ? (
              <div className="request-list" role="status" aria-busy="true">
                <span className="visually-hidden">Loading your requests…</span>
                <Skeleton height="4rem" />
                <Skeleton height="4rem" />
              </div>
            ) : (
              <QueryState isPending={false} error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} noun="your requests" />
            )}
          </section>
        </div>

        <div className="dashboard__side">
          <div className="reveal" style={{ '--i': 3 } as React.CSSProperties}>
            <ChemaWalletAccountCard phone={user?.phone} />
          </div>
          <div className="reveal" style={{ '--i': 6 } as React.CSSProperties}>
            <NextActions hasPolicy={Boolean(policy)} />
          </div>
          <div className="reveal" style={{ '--i': 6 } as React.CSSProperties}>
            <MemorialsSummaryCard />
          </div>
          <div className="reveal" style={{ '--i': 6 } as React.CSSProperties}>
            <OrdersSummaryCard />
          </div>
        </div>
      </div>
    </div>
  )
}
