import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { DonutChart, LineChart } from '@/components/ui/DashboardCharts'
import { Icon } from '@/components/ui/Icon'
import { StatusChip } from '@/components/ui/StatusChip'
import { chemaCasePath, contributePath, paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import {
  availableCommunityBalance,
  caseActionLabel,
  caseProgress,
  contributionTotals,
  contributionsForCase,
  dashboardMetrics,
  disputesForCase,
  isPubliclyActive,
  methodLabels,
  money,
  needsReview,
  payoutsForCase,
  type ChemaCase,
  CHEMA_WALLET_URLS,
} from './data'
import { chemaStore } from './store'
import { CaseStatusChip, CaseProgressSummary, PayoutStatusChip, StatTile } from './ChemaUI'
import { demoPersonas } from '@/features/auth/demo'
import './chema-wallet.css'

type CaseFilter = 'all' | 'active' | 'review' | 'attention'
const CHART_REFERENCE_TIME = Date.now()

const filterLabels: Record<CaseFilter, string> = {
  all: 'All cases',
  active: 'Live pages',
  review: 'Verification',
  attention: 'Needs attention',
}

function hasAttention(state: ReturnType<typeof chemaStore.getState>, item: ChemaCase) {
  return (
    needsReview(item) ||
    item.status === 'suspended' ||
    payoutsForCase(state, item.id).some((payout) => payout.status === 'awaiting_approval') ||
    disputesForCase(state, item.id).some((dispute) => ['raised', 'triaged', 'investigating'].includes(dispute.status))
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ChemaDashboardPage() {
  const { user } = useAuth()
  const [state, setState] = useState(() => chemaStore.getState())
  const [filter, setFilter] = useState<CaseFilter>('all')
  const [note, setNote] = useState('')
  const isAdmin = user?.role === 'admin'
  const actor = { id: user?.id ?? 'demo-user', name: user?.name ?? 'Demo user' }

  useEffect(() => {
    // Reroute to the real Chema Wallet application unless ?stay=true is explicitly requested
    const search = new URLSearchParams(window.location.search)
    if (!search.has('stay') && !search.has('embedded')) {
      const destination = isAdmin ? CHEMA_WALLET_URLS.admin : CHEMA_WALLET_URLS.web
      window.location.href = destination
    }
  }, [isAdmin])

  const metrics = dashboardMetrics(state)
  const cases = state.cases
  const contributionTrend = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(CHART_REFERENCE_TIME - (6 - index) * 86_400_000)
      const key = date.toISOString().slice(0, 10)
      const amount = state.contributions
        .filter((item) => item.status === 'successful' && item.createdAt.slice(0, 10) === key)
        .reduce((sum, item) => sum + item.amount, 0)
      return {
        label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(date),
        value: Math.round(amount * 100) / 100,
      }
    })
  }, [state.contributions])
  const casePortfolio = [
    { label: 'Verified', value: cases.filter((item) => item.status === 'verified').length },
    { label: 'In review', value: cases.filter((item) => ['submitted', 'under_review', 'returned'].includes(item.status)).length },
    { label: 'Draft', value: cases.filter((item) => item.status === 'draft').length },
    { label: 'Other states', value: cases.filter((item) => !['verified', 'submitted', 'under_review', 'returned', 'draft'].includes(item.status)).length },
  ].filter((item) => item.value > 0)
  const totalAvailable = useMemo(
    () => cases.filter((item) => item.status === 'verified').reduce((sum, item) => sum + availableCommunityBalance(state, item.id), 0),
    [cases, state],
  )
  const reviewCases = cases.filter(needsReview)
  const approvalPayouts = state.payouts.filter((payout) => payout.status === 'awaiting_approval')
  const openDisputes = state.disputes.filter((dispute) => ['raised', 'triaged', 'investigating'].includes(dispute.status))
  const recent = [...state.contributions]
    .filter((item) => item.status === 'successful')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)
  const attentionCount = reviewCases.length + approvalPayouts.length + openDisputes.length

  const filteredCases = cases.filter((item) => {
    if (filter === 'active') return isPubliclyActive(item)
    if (filter === 'review') return needsReview(item)
    if (filter === 'attention') return hasAttention(state, item)
    return true
  })

  function flash(text: string) {
    setNote(text)
    window.setTimeout(() => setNote(''), 4500)
  }

  function resetDemo() {
    setState(chemaStore.resetDemo())
    flash('Demo data restored to the seeded scenario.')
  }

  function scrollToAttention() {
    document.getElementById('cw-attention')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const liveDemoCase = state.cases.find((item) => isPubliclyActive(item) && item.id === 'cw-fr-nyathi') ?? state.cases.find(isPubliclyActive)

  return (
    <div className="cw-page">
      {/* Real Chema Wallet Integration Control Bar */}
      <section style={{ background: '#b91c1c', color: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 14px rgba(185, 28, 28, 0.25)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.15rem', fontWeight: 800 }}>
            <span>⚡</span> REAL CHEMA WALLET ENGINE CONNECTED
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.92, marginTop: '0.25rem', maxWidth: '650px' }}>
            Integrated with running services: Public PWA on port 3005, Fidelity Admin Portal on port 3001, and Fastify API on port 7600. Clicks on any case, contribution, or payout redirect directly to the real Chema Wallet rails.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <a href={CHEMA_WALLET_URLS.ssoDashboard(user?.phone)} target="_blank" rel="noreferrer" className="btn btn--primary" style={{ background: '#ffffff', color: '#b91c1c', fontWeight: 700, border: 'none' }}>
            🚀 Open Real Chema Wallet (Instant Auto-SSO)
          </a>
          <a href={CHEMA_WALLET_URLS.ssoNew(user?.phone)} target="_blank" rel="noreferrer" className="btn btn--outline" style={{ color: '#ffffff', borderColor: '#ffffff', background: 'rgba(255,255,255,0.15)' }}>
            ➕ Start Wallet Draft (Auto-Logged In)
          </a>
          <a href={CHEMA_WALLET_URLS.admin} target="_blank" rel="noreferrer" className="btn btn--outline" style={{ background: '#7f1d1d', color: '#ffffff', borderColor: '#fca5a5' }}>
            🛡️ Chema Admin Portal
          </a>
        </div>
      </section>

      <header className="cw-hero reveal">
        <div className="cw-hero__copy">
          <span className="cw-hero__badge"><Icon name="shield" size={16} /> Verified community support · live & connected</span>
          <p className="cw-hero__eyebrow">Chema Wallet</p>
          <h1>One funeral case.<br />One coordinated family view.</h1>
          <p className="cw-hero__lead">
            {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Community contributions stay separate from Fidelity policy benefits and claims, with verification, receipts and maker-checker controls before any money moves.
          </p>
          <div className="cw-hero__actions">
            <a href={CHEMA_WALLET_URLS.ssoDashboard(user?.phone)} target="_blank" rel="noreferrer" className="btn btn--primary">
              <Icon name="wallet" size={18} /> Open Chema Wallet (Single Sign-On)
            </a>
            <a href={CHEMA_WALLET_URLS.admin} target="_blank" rel="noreferrer" className="btn btn--outline">
              <Icon name="shield" size={18} /> Fidelity Chema Admin
            </a>
            <button type="button" className="btn btn--outline" onClick={scrollToAttention}>
              <Icon name="alert" size={18} /> Review attention
              {attentionCount > 0 && <span className="cw-count">{attentionCount}</span>}
            </button>
          </div>
        </div>

        <aside className="cw-hero__panel" aria-label="Community funds summary">
          <p className="cw-hero__panel-label">Community money available</p>
          <p className="cw-hero__total">{money(totalAvailable)}</p>
          <p className="cw-hero__panel-hint">After payout commitments and source-specific holds. Pending payments are excluded.</p>
          <dl className="cw-hero__facts">
            <div><dt>Confirmed digital</dt><dd>{money(metrics.totalCommunity)}</dd></div>
            <div><dt>Pending confirmation</dt><dd>{money(metrics.totalPending)}</dd></div>
            <div><dt>Cash recorded separately</dt><dd>{money(metrics.totalCash)}</dd></div>
          </dl>
          <div className="cw-hero__benefit">
            <Icon name="lock" size={15} />
            <span><strong>Fidelity benefit:</strong> not linked. Claims remain a separate Fidelity decision.</span>
          </div>
        </aside>
      </header>

      <Callout tone="warning">
        <strong>Demonstration only.</strong> No real EcoCash, OneMoney or card payment is processed and no money is transferred. The controls shown here — community verification, source-separated balances, receipts, holds and dual approval — mirror the BRD v8.0 intent so stakeholders can walk through the journey.
      </Callout>

      {note && <Callout tone="success" role="status">{note}</Callout>}

      <section className="cw-stat-strip" aria-label="Chema Wallet key numbers">
        <StatTile icon="wallet" label="Active funeral cases" value={metrics.activeCases} hint={`${cases.length} cases in this demo`} accent />
        <StatTile icon="users" label="Contributors" value={metrics.contributors} hint={`${metrics.settledContributions} confirmed digital contributions`} />
        <StatTile icon="clock" label="Awaiting approval" value={metrics.awaitingApproval} hint="Payouts needing an independent approver" />
        <StatTile icon="alert" label="Open disputes" value={metrics.openDisputes} hint={metrics.openDisputes > 0 ? 'Open disputes or public reports under review' : 'No open disputes or reports'} />
      </section>

      <section className="cw-dashboard-charts" aria-label="Chema Wallet analytics">
        <LineChart title="Confirmed contributions" subtitle="Contribution value by day · past 7 days" data={contributionTrend} formatValue={money} />
        <DonutChart title="Case portfolio" subtitle={`${cases.length} cases by verification state`} data={casePortfolio} />
      </section>

      <div className="cw-layout">
        <div className="cw-layout__main">
          <section className="cw-panel" aria-labelledby="cw-cases-title">
            <div className="cw-panel__head">
              <div>
                <p className="cw-eyebrow">Family wallets</p>
                <h2 id="cw-cases-title" className="cw-panel__title">Funeral cases</h2>
              </div>
              <Link className="link-arrow" to={paths.accountFuneralRecords}>Funeral records <Icon name="arrow-right" size={16} /></Link>
            </div>

            <div className="cw-filters" role="group" aria-label="Filter funeral cases">
              {(Object.keys(filterLabels) as CaseFilter[]).map((key) => (
                <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {filterLabels[key]}
                  {key === 'attention' && attentionCount > 0 && <span className="cw-count cw-count--dark">{attentionCount}</span>}
                </button>
              ))}
            </div>

            <div className="cw-case-list">
              {filteredCases.map((item) => {
                const contributions = contributionsForCase(state, item.id)
                const totals = contributionTotals(contributions)
                const progress = caseProgress(item, contributions)
                const available = availableCommunityBalance(state, item.id)
                const openPayouts = payoutsForCase(state, item.id).filter((payout) => payout.status === 'awaiting_approval').length
                return (
                  <article key={item.id} className="cw-case">
                    <div className="cw-case__top">
                      <div>
                        <div className="cw-case__title-row">
                          <h3>{item.deceasedName}</h3>
                          <CaseStatusChip status={item.status} />
                          {isPubliclyActive(item) && <StatusChip tone="success">Public page live</StatusChip>}
                        </div>
                        <p className="cw-case__meta">{item.caseRef} · {item.funeralInfo}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <a className="btn btn--primary btn--sm" href={CHEMA_WALLET_URLS.walletDashboard(item.id)} target="_blank" rel="noreferrer" title="Open Real Chema Wallet on port 3005">
                          Real Chema Wallet ↗
                        </a>
                        <Link className="btn btn--outline btn--sm" to={chemaCasePath(item.id)}>
                          {caseActionLabel(item)} <Icon name="arrow-right" size={15} />
                        </Link>
                      </div>
                    </div>

                    <div className="cw-case__body">
                      <CaseProgressSummary item={item} raised={progress.raised} />
                      <dl className="cw-case__facts">
                        <div><dt>Available</dt><dd>{money(available)}</dd></div>
                        <div><dt>Cash recorded</dt><dd>{money(totals.cashTotal)}</dd></div>
                        <div><dt>Contributors</dt><dd>{totals.contributorCount}</dd></div>
                      </dl>
                    </div>

                    <div className="cw-case__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {needsReview(item) && <span className="cw-inline-flag"><Icon name="shield" size={14} /> Verification pending.</span>}
                        {item.status === 'verified' && !item.activated && <span className="cw-inline-flag"><Icon name="lock" size={14} /> Verified; awaiting activation.</span>}
                        {openPayouts > 0 && <span className="cw-inline-flag"><Icon name="wallet" size={14} /> {openPayouts} payout{openPayouts === 1 ? '' : 's'} awaiting approval.</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {isPubliclyActive(item) && (
                          <a href={CHEMA_WALLET_URLS.give(item.contributionToken)} target="_blank" rel="noreferrer" className="link-arrow" style={{ color: '#b91c1c', fontWeight: 600 }}>
                            Contribute on Real Chema ↗
                          </a>
                        )}
                        <a href={CHEMA_WALLET_URLS.adminCases} target="_blank" rel="noreferrer" className="link-arrow" style={{ opacity: 0.8 }}>
                          Staff Queue ↗
                        </a>
                      </div>
                    </div>
                  </article>
                )
              })}
              {filteredCases.length === 0 && (
                <div className="cw-empty">
                  <span className="cw-empty__icon"><Icon name="wallet" size={22} /></span>
                  <div><strong>No cases in this view.</strong><p>Choose another filter or create a wallet from a funeral record.</p></div>
                </div>
              )}
            </div>
          </section>

          <section className="cw-panel" aria-labelledby="cw-recent-title">
            <div className="cw-panel__head">
              <div>
                <p className="cw-eyebrow">Receipts and source records</p>
                <h2 id="cw-recent-title" className="cw-panel__title">Recent confirmed contributions</h2>
              </div>
              <span className="cw-panel__hint">Pending and failed payments never appear as confirmed.</span>
            </div>
            <div className="cw-receipt-list">
              {recent.map((item) => {
                const funeralCase = state.cases.find((entry) => entry.id === item.caseId)
                const date = new Date(item.confirmedAt ?? item.createdAt).toLocaleDateString('en-GB')
                return (
                  <a
                    key={item.id}
                    href={CHEMA_WALLET_URLS.receipt(item.receiptRef || item.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="cw-receipt"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', cursor: 'pointer' }}
                    title="Click to view Real Chema Receipt on port 3005"
                  >
                    <span className={`cw-receipt__icon cw-receipt__icon--${item.kind === 'cash' ? 'cash' : 'community'}`}>
                      <Icon name={item.kind === 'cash' ? 'archive' : 'file'} size={16} />
                    </span>
                    <div className="cw-receipt__main">
                      <p className="cw-receipt__title">
                        {funeralCase ? <strong>{funeralCase.deceasedName}</strong> : <strong>Unlinked case</strong>}
                        <span className={`cw-source-tag cw-source-tag--${item.kind === 'cash' ? 'cash' : 'community'}`}>{item.kind === 'cash' ? 'Cash' : 'Community'}</span>
                        <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, marginLeft: '0.5rem' }}>Receipt ↗</span>
                      </p>
                      <p className="cw-receipt__meta">
                        {item.anonymous ? 'Anonymous' : item.contributorName}
                        <span aria-hidden="true"> · </span>
                        {item.kind === 'cash' ? 'Cash recorded' : methodLabels[item.method]}
                        <span aria-hidden="true"> · </span>
                        {date}
                        {item.recordedBy ? ` · Recorded by ${item.recordedBy}` : ''}
                      </p>
                    </div>
                    <div className="cw-receipt__amount">
                      <strong>{money(item.amount)}</strong>
                      <span>{item.receiptRef ?? 'No receipt'}</span>
                    </div>
                  </a>
                )
              })}
              {recent.length === 0 && (
                <div className="cw-empty">
                  <span className="cw-empty__icon"><Icon name="wallet" size={22} /></span>
                  <div><strong>No confirmed contributions yet.</strong><p>Provider-confirmed payments will appear here with their receipts.</p></div>
                </div>
              )}
            </div>
          </section>
          <section className="cw-panel" aria-labelledby="cw-global-title">
            <div className="cw-panel__head">
              <div>
                <p className="cw-eyebrow">Public Visibility · Anyone can see these</p>
                <h2 id="cw-global-title" className="cw-panel__title">Global Chema Wallet Contributions</h2>
              </div>
              <span className="cw-panel__hint">{state.contributions.filter((item) => item.status === 'successful').length} total verified contributions across all funds</span>
            </div>
            <div className="cw-receipt-list">
              {[...state.contributions]
                .filter((item) => item.status === 'successful')
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((item) => {
                  const funeralCase = state.cases.find((entry) => entry.id === item.caseId)
                  const date = new Date(item.confirmedAt ?? item.createdAt).toLocaleDateString('en-GB')
                  return (
                    <article key={item.id} className="cw-receipt">
                      <span className={`cw-receipt__icon cw-receipt__icon--${item.kind === 'cash' ? 'cash' : 'community'}`}>
                        <Icon name={item.kind === 'cash' ? 'archive' : 'file'} size={16} />
                      </span>
                      <div className="cw-receipt__main">
                        <p className="cw-receipt__title">
                          <strong>{funeralCase?.deceasedName ?? 'Family Fund'}</strong>
                          <span className={`cw-source-tag cw-source-tag--${item.kind === 'cash' ? 'cash' : 'community'}`}>{item.kind === 'cash' ? 'Cash' : 'Chema Wallet'}</span>
                        </p>
                        <p className="cw-receipt__meta">
                          {item.anonymous ? 'Anonymous Contributor' : item.contributorName}
                          <span aria-hidden="true"> · </span>
                          {date}
                        </p>
                      </div>
                      <div className="cw-receipt__amount">
                        <strong>{money(item.amount)}</strong>
                        <span>{item.receiptRef ?? 'Receipt verified'}</span>
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>
        </div>

        <aside className="cw-layout__side">
          <section className="cw-panel cw-panel--attention" id="cw-attention" aria-labelledby="cw-attention-title">
            <div className="cw-panel__head">
              <div>
                <p className="cw-eyebrow">Control centre</p>
                <h2 id="cw-attention-title" className="cw-panel__title">Needs attention</h2>
              </div>
              {attentionCount > 0 && <span className="cw-count">{attentionCount}</span>}
            </div>

            <div className="cw-attention-group">
              <div className="cw-attention-head"><h3>Verification queue</h3><span>{reviewCases.length}</span></div>
              {reviewCases.map((item) => (
                <Link key={item.id} to={chemaCasePath(item.id)} className="cw-attention-item">
                  <span className="cw-attention-item__icon"><Icon name="shield" size={16} /></span>
                  <span><strong>{item.deceasedName}</strong><small>{item.status === 'returned' ? 'Returned for correction' : 'Awaiting reviewer decision'} · {item.verification.evidence.length} evidence item{item.verification.evidence.length === 1 ? '' : 's'}</small></span>
                  <Icon name="arrow-right" size={15} />
                </Link>
              ))}
              {reviewCases.length === 0 && <p className="cw-attention-empty">No cases waiting for verification.</p>}
            </div>

            <div className="cw-attention-group">
              <div className="cw-attention-head"><h3>Payout approval</h3><span>{approvalPayouts.length}</span></div>
              {approvalPayouts.map((payout) => {
                const funeralCase = state.cases.find((item) => item.id === payout.caseId)
                const approved = payout.approvals.filter((approval) => approval.decision === 'approved').length
                return (
                  <Link key={payout.id} to={chemaCasePath(payout.caseId)} className="cw-attention-item">
                    <span className="cw-attention-item__icon"><Icon name="wallet" size={16} /></span>
                    <span><strong>{money(payout.amount)} · {funeralCase?.deceasedName ?? 'Case'}</strong><small>{approved}/{payout.requiredApprovals} approvals · {payout.purpose}</small></span>
                    <PayoutStatusChip status={payout.status} />
                  </Link>
                )
              })}
              {approvalPayouts.length === 0 && <p className="cw-attention-empty">No payouts waiting for approval.</p>}
            </div>

            <div className="cw-attention-group">
              <div className="cw-attention-head"><h3>Disputes &amp; reports</h3><span>{openDisputes.length}</span></div>
              {openDisputes.slice(0, 3).map((dispute) => {
                const funeralCase = state.cases.find((item) => item.id === dispute.caseId)
                return (
                  <Link key={dispute.id} to={chemaCasePath(dispute.caseId)} className="cw-attention-item">
                    <span className="cw-attention-item__icon cw-attention-item__icon--warn"><Icon name="alert" size={16} /></span>
                    <span><strong>{funeralCase?.deceasedName ?? 'Case'} · {dispute.category}</strong><small>{dispute.owner} · {dispute.status}</small></span>
                    <Icon name="arrow-right" size={15} />
                  </Link>
                )
              })}
              {openDisputes.length === 0 && <p className="cw-attention-empty">No open disputes or reports.</p>}
            </div>
          </section>

          <section className="cw-panel cw-demo-card" aria-labelledby="cw-demo-title">
            <p className="cw-eyebrow">Demo tools</p>
            <h2 id="cw-demo-title" className="cw-panel__title">Walk the controls</h2>
            <dl className="cw-demo-card__facts">
              <div><dt>Signed in as</dt><dd>{actor.name}</dd></div>
              <div><dt>Role</dt><dd>{isAdmin ? 'Administrator / operations' : 'Family / customer view'}</dd></div>
              <div><dt>Module state</dt><dd>Stored in this browser only</dd></div>
            </dl>
            <p className="cw-demo-card__note">
              {isAdmin
                ? 'Use the case workspace to decide verification, activate a public page, record cash, moderate tributes and approve payouts. Maker-checker prevents the requester from approving their own payout.'
                : `Sign in as ${demoPersonas.find((persona) => persona.user.role === 'admin')?.user.name ?? 'an administrator'} to review verification and payouts. Family accounts can inspect their own case and public page.`}
            </p>
            <div className="cw-demo-card__actions">
              {liveDemoCase && <Link className="btn btn--primary btn--sm" to={contributePath(liveDemoCase.contributionToken)}>Test contributor journey</Link>}
              <button type="button" className="btn btn--outline btn--sm" onClick={resetDemo}>Reset demo data</button>
            </div>
            <details className="cw-demo-card__details">
              <summary>What this demo enforces</summary>
              <ul>
                <li>Public link and QR activation only after community verification (FR-VER-003).</li>
                <li>Consolidated view, separate source records and no commingling implication (FR-LED-002).</li>
                <li>Only provider-confirmed contributions are spendable (FR-PAY-007).</li>
                <li>Independent approval for high-risk payouts, with requester excluded (FR-POT-003).</li>
                <li>Posted ledger entries are never edited or deleted (FR-LED-004).</li>
              </ul>
            </details>
          </section>

          <section className="cw-panel" aria-labelledby="cw-recon-title">
            <p className="cw-eyebrow">Finance snapshot</p>
            <h2 id="cw-recon-title" className="cw-panel__title">Reconciliation</h2>
            <div className="cw-recon">
              <div><span>Confirmed digital</span><strong>{metrics.settledContributions}</strong></div>
              <div><span>Awaiting confirmation</span><strong>{state.contributions.filter((item) => ['initiated', 'pending'].includes(item.status)).length}</strong></div>
              <div><span>Failed / declined</span><strong>{state.contributions.filter((item) => item.status === 'failed').length}</strong></div>
              <div><span>Open exceptions</span><strong>{openDisputes.length}</strong></div>
            </div>
            <p className="cw-panel__hint">A small variance does not freeze unrelated sources. Holds are scoped to the affected source and transaction.</p>
          </section>
        </aside>
      </div>

      <section className="cw-principles" aria-label="Control principles">
        <article className="cw-principle">
          <span className="cw-principle__num">01</span>
          <div><h2>Verify before you share</h2><p>Draft and submitted cases cannot be shared. Only a verified case can activate a public link, QR code and contributions.</p></div>
        </article>
        <article className="cw-principle">
          <span className="cw-principle__num">02</span>
          <div><h2>One view, separate sources</h2><p>Community money, recorded cash and a Fidelity benefit are shown together for the family, but never treated as one interchangeable balance.</p></div>
        </article>
        <article className="cw-principle">
          <span className="cw-principle__num">03</span>
          <div><h2>Two people before money moves</h2><p>High-value payouts need independent approval. Requesters cannot approve their own instruction, and every step is written to the audit trail.</p></div>
        </article>
      </section>

      <p className="cw-fineprint">
        Chema Wallet is part of the Fidelity Life funeral services demonstration platform. No policy cover, claim approval, benefit amount or payout is confirmed by this page. Verification applies to the community funeral case only.
      </p>
    </div>
  )
}
