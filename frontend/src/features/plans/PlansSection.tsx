import { useState } from 'react'
import { QueryState } from '@/components/ui/QueryState'
import { Section } from '@/components/ui/Section'
import { SectionHead } from '@/components/ui/SectionHead'
import { formatUsd } from '@/lib/format'
import { DEFAULT_PLAN_ID, type Plan } from './data'
import { usePlans } from './queries'
import { QuoteForm } from './QuoteForm'
import './plans.css'

export function PlansSection() {
  const { data: plans, isPending, error, refetch } = usePlans()

  return (
    <Section id="plans" containerClassName="split">
      {plans ? (
        <PlansContent plans={plans} />
      ) : (
        <QueryState isPending={isPending} error={error} onRetry={() => void refetch()} noun="funeral plans" skeleton />
      )}
    </Section>
  )
}

function PlansContent({ plans }: { plans: Plan[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID)
  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]

  if (!activePlan) return <p className="muted">No funeral plans are available right now. Please check back soon.</p>

  function goToQuote(planId: string) {
    setSelectedPlanId(planId)
    document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div>
        <SectionHead eyebrow="Funeral Plans" title="Sample funeral plans and quotation guidance." align="left" />

        <div className="grid grid--3 plan-grid">
          {plans.map((plan) => {
            const isSelected = plan.id === activePlan.id
            return (
              <article
                key={plan.id}
                className={`card card--interactive stack plan-card ${isSelected ? 'plan-card--selected' : ''} ${plan.popular ? 'plan-card--popular' : ''}`}
                onClick={() => setSelectedPlanId(plan.id)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div className="stack">
                  {plan.popular && <span className="badge">Most chosen</span>}
                  <div className="plan-card__header">
                    <h3>{plan.name}</h3>
                    <div className="plan-card__price">
                      {formatUsd(plan.price)}
                      <small>starting estimate</small>
                    </div>
                  </div>
                  <p>{plan.description}</p>
                  <ul className="check-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <a
                  href="#quote-form"
                  className={`btn btn--sm ${isSelected ? 'btn--primary' : 'btn--outline'}`}
                  style={{ marginTop: '1rem', width: '100%', textAlign: 'center' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    goToQuote(plan.id)
                  }}
                >
                  Get a Quick Quote
                </a>
              </article>
            )
          })}
        </div>
      </div>

      <QuoteForm plan={activePlan} />
    </>
  )
}
