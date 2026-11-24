import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/Icon'
import { anchor, paths } from '@/config/routes'
import { LinkPolicyForm } from './LinkPolicyForm'

type Action = { icon: IconName; title: string; text: string; to: string }

function actionsFor(hasPolicy: boolean): Action[] {
  if (!hasPolicy) {
    return [
      { icon: 'shield', title: 'Link your policy', text: 'Already insured with us? Add it in under a minute.', to: paths.accountPolicy },
      { icon: 'file', title: 'Get a quote', text: 'See what a funeral plan would cost for your family.', to: anchor('quote-form') },
      { icon: 'phone', title: 'Talk to an adviser', text: 'We’ll call you back, on the channel you prefer.', to: `${paths.accountRequests}?new=general` },
    ]
  }
  return [
    { icon: 'users', title: 'Review your beneficiaries', text: 'Make sure the right people are named.', to: `${paths.accountPolicy}#beneficiaries` },
    { icon: 'calendar', title: 'Book a consultation', text: 'Plan ahead with an adviser, at your pace.', to: `${paths.accountRequests}?new=general` },
    { icon: 'file', title: 'Download your policy schedule', text: 'Keep a copy where your family can find it.', to: `${paths.accountPolicy}#documents` },
  ]
}

export function NextActions({ hasPolicy }: { hasPolicy: boolean }) {
  return (
    <section className="card panel" aria-labelledby="next-actions-title">
      <h2 id="next-actions-title" className="panel__title">
        Next best steps
      </h2>
      <ul className="actions">
        {actionsFor(hasPolicy).map((action) => (
          <li key={action.title}>
            <Link className="action" to={action.to}>
              <span className="icon-tile">
                <Icon name={action.icon} size={20} />
              </span>
              <span className="action__text">
                <strong>{action.title}</strong>
                <span>{action.text}</span>
              </span>
              <Icon name="arrow-right" size={18} className="action__arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Card shown in place of the policy when none is linked yet. */
export function NoPolicyCard() {
  return (
    <article className="card no-policy" aria-labelledby="no-policy-title">
      <span className="icon-tile icon-tile--lg">
        <Icon name="shield" size={26} />
      </span>
      <h2 id="no-policy-title" className="panel__title">
        Link a policy you already have
      </h2>
      <p className="muted">
        Add your policy number and ID and we’ll show your cover, premiums and beneficiaries here. No policy yet? You can
        <Link to={anchor('quote-form')}> get a quote</Link> at any time.
      </p>
      <LinkPolicyForm />
    </article>
  )
}

export function ChemaWalletAccountCard({ phone }: { phone?: string }) {
  const ssoUrl = `http://localhost:7600/auth/fidelity-sso?phone=${encodeURIComponent(phone || '')}&target=/new`
  return (
    <article className="card panel" style={{ borderLeft: '4px solid #b91c1c' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span className="icon-tile" style={{ background: '#fef2f2', color: '#b91c1c' }}>
          <Icon name="wallet" size={20} />
        </span>
        <h2 className="panel__title" style={{ margin: 0, fontSize: '1.05rem' }}>
          Chema Wallet � Family Fund
        </h2>
      </div>
      <p className="muted" style={{ fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1rem' }}>
        Single sign-on active. Collect contributions from relatives and friends worldwide. Funds settle directly into verified digital rails.
      </p>
      <a
        href={ssoUrl}
        target="_blank"
        rel="noreferrer"
        className="btn btn--primary btn--sm"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Icon name="wallet" size={16} /> Open Chema Wallet (Auto-SSO) ?
      </a>
    </article>
  )
}
