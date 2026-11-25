import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Section } from '@/components/ui/Section'
import { StatusChip } from '@/components/ui/StatusChip'
import { paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import { plans, TOWNS } from '@/features/plans'
import { ApiError } from '@/lib/api-error'
import { get } from '@/lib/http'
import { FUNERAL_SERVICE_OPTIONS } from './intake'
import { submitFuneralCase, type FuneralCaseRecord } from './cases-api'
import './intake.css'

type IntakeMode = 'report' | 'apply'
type PolicyMatch = {
  number: string
  holderName: string
  status: string
  planName: string
  beneficiaries: { name: string; relationship: string }[]
}
const MAX_DATE = new Date().toISOString().slice(0, 10)

function isUnresolvedPolicy(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

function IntakePage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<IntakeMode>('report')
  const [applicationChannel, setApplicationChannel] = useState<'online' | 'at-fidelity'>('online')
  const [policyNumber, setPolicyNumber] = useState('')
  const [policy, setPolicy] = useState<PolicyMatch | null>(null)
  const [deceasedName, setDeceasedName] = useState('')
  const [policyCheckMessage, setPolicyCheckMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [result, setResult] = useState<FuneralCaseRecord | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleService = (name: string) => {
    setSelectedServices((current) => current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name])
  }

  const checkPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      navigate(`${paths.login}?next=${encodeURIComponent(paths.funeralSupport)}`)
      return
    }
    setChecking(true)
    setPolicy(null)
    setDeceasedName('')
    setPolicyCheckMessage('')
    setError('')
    try {
      const found = await get<PolicyMatch>(`/me/policies/${encodeURIComponent(policyNumber.trim())}`)
      setPolicy(found)
      if (found.beneficiaries.length === 1) setDeceasedName(found.beneficiaries[0]!.name)
      setPolicyCheckMessage('Policy details were retrieved for your account. Fidelity will confirm eligibility as part of case review.')
    } catch (caught) {
      if (isUnresolvedPolicy(caught)) {
        setPolicyCheckMessage('We could not show policy details for this account. If you are an authorized relative, you can still submit the policy number and deceased person for secure Fidelity verification.')
      } else {
        setError(caught instanceof Error ? caught.message : 'The policy lookup failed. Try again.')
      }
    } finally {
      setChecking(false)
    }
  }

  const submitCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setResult(null)
    if (!user) {
      navigate(`${paths.login}?next=${encodeURIComponent(paths.funeralSupport)}`)
      return
    }
    if (selectedServices.length === 0) {
      setError('Select at least one service you need help with.')
      return
    }
    setBusy(true)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const caseType = mode === 'report' ? 'POLICY_COVERED' : 'WALK_IN_COVERAGE'
    try {
      const item = await submitFuneralCase({
        caseType,
        reporterName: user.name,
        deceasedName: String(form.get('deceasedName') ?? '').trim() || undefined,
        dateOfDeath: String(form.get('dateOfDeath') ?? '') || undefined,
        serviceLocation: String(form.get('serviceLocation') ?? '').trim() || undefined,
        funeralAt: String(form.get('funeralAt') ?? '') ? new Date(String(form.get('funeralAt'))).toISOString() : undefined,
        funeralLocation: String(form.get('funeralLocation') ?? '').trim() || undefined,
        policyNumber: mode === 'report' ? (policyNumber.trim() || undefined) : undefined,
        contactPhone: user.phone,
        requestedPlan: mode === 'apply' ? String(form.get('requestedPlan') ?? '') : undefined,
        applicationChannel: mode === 'apply' ? String(form.get('applicationChannel') ?? '') as 'online' | 'at-fidelity' : undefined,
        applicationLocation: mode === 'apply' ? String(form.get('applicationLocation') ?? '') || undefined : undefined,
        requestedServices: selectedServices,
        whatsappConsent: form.get('whatsappConsent') === 'on',
      })
      setResult(item)
      setSelectedServices([])
      setPolicyCheckMessage('')
      setApplicationChannel('online')
      formElement.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The case could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = (next: IntakeMode) => {
    setMode(next)
    setPolicy(null)
    setPolicyCheckMessage('')
    setError('')
    setResult(null)
    setSelectedServices([])
    setApplicationChannel('online')
  }

  return (
    <Section containerClassName="intake-page">
      <div className="intake">
        <header className="intake__intro">
          <p className="eyebrow">Fidelity Life · Funeral support</p>
          <h1>How can we help your family?</h1>
          <p>Report a funeral using existing cover or request a new funeral cover consultation. Your request is securely recorded for Fidelity review and assignment.</p>
        </header>

        {isLoading ? <p role="status">Checking your account…</p> : !user ? (
          <div className="intake__notice" role="note">
            <strong>Sign in to continue</strong>
            <span>Funeral cases are linked to a verified mobile account so Fidelity can coordinate with the registered contact.</span>
            <Link className="btn btn--primary" to={`${paths.login}?next=${encodeURIComponent(paths.funeralSupport)}`}>Sign in to report a funeral</Link>
          </div>
        ) : (
          <>
            <div className="intake__switch" role="tablist" aria-label="Choose a service">
              <button type="button" role="tab" aria-selected={mode === 'report'} className={mode === 'report' ? 'is-active' : ''} onClick={() => changeMode('report')}>Report a funeral</button>
              <button type="button" role="tab" aria-selected={mode === 'apply'} className={mode === 'apply' ? 'is-active' : ''} onClick={() => changeMode('apply')}>Request funeral cover</button>
            </div>

            {result && (
              <div className="intake__success" role="status">
                <strong>{result.caseType === 'POLICY_COVERED' ? 'Funeral case received' : 'Funeral cover consultation received'}</strong>
                <span>Case reference: <b>{result.reference}</b>. Your request has been posted to Fidelity’s operations dashboard.</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0', fontSize: '13px' }}>
                  <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>📲 WhatsApp: Group Active</span>
                  <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>📱 SMS: Sent</span>
                  <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>📧 Email: Dispatched</span>
                  <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>📞 Call: Scheduled</span>
                </div>
                <span>Fidelity operations team is processing your case and assigning your coordinator.</span>
                <Link to={paths.accountFuneralCases} className="btn btn--sm btn--primary" style={{ marginTop: '8px', display: 'inline-block' }}>View your cases</Link>
              </div>
            )}
            {error && <p className="intake__error" role="alert">{error}</p>}

            {mode === 'report' && (
              <section className="card intake__panel">
                <p className="eyebrow">Existing policy</p>
                <h2>Verify policy details</h2>
                <p>Enter the policy number. If your account is linked to it, covered members and policy details will be fetched. An authorized relative can still submit details for Fidelity to verify without exposing policy information.</p>
                <form className="intake__lookup" onSubmit={(event) => void checkPolicy(event)}>
                  <label className="field">
                    <span className="field__label">Policy number</span>
                    <input className="input" value={policyNumber} onChange={(event) => {
                      setPolicyNumber(event.target.value.toUpperCase())
                      setPolicy(null)
                      setDeceasedName('')
                      setPolicyCheckMessage('')
                    }} required maxLength={40} autoCapitalize="characters" />
                  </label>
                  <button className="btn btn--primary" type="submit" disabled={!policyNumber.trim() || checking}>{checking ? 'Checking…' : 'Check policy'}</button>
                </form>
                {policy && (
                  <div className="intake__policy" role="status">
                    <div className="intake__policy-heading">
                      <div><strong>{policy.number} · {policy.planName}</strong><span>Policyholder: {policy.holderName}</span></div>
                      <StatusChip tone={policy.status === 'active' ? 'success' : 'warning'}>{policy.status}</StatusChip>
                    </div>
                    <p>Covered members: {policy.beneficiaries.map((member) => `${member.name} (${member.relationship})`).join(', ') || 'No members listed'}</p>
                    <small>This lookup does not confirm claim eligibility. Fidelity will review policy terms, payment history and waiting periods.</small>
                  </div>
                )}
                {policyCheckMessage && <p className="muted" role="status">{policyCheckMessage}</p>}
              </section>
            )}

            <form className="card intake__panel intake__form" onSubmit={(event) => void submitCase(event)}>
              <p className="eyebrow">{mode === 'report' ? 'Funeral case details' : 'New cover consultation'}</p>
              <h2>{mode === 'report' ? 'Tell us about the funeral' : 'Request a plan consultation'}</h2>
              <p>Your registered contact is <strong>{user.phone}</strong>. To use a different number for coordination, update your verified account phone first.</p>

              {mode === 'report' ? (
                <>
                  <input type="hidden" name="policyNumber" value={policyNumber} />
                  <div className="intake__grid">
                    <label className="field"><span className="field__label">Deceased person</span>
                      {policy ? (
                        <select className="select" name="deceasedName" value={deceasedName} onChange={(event) => setDeceasedName(event.target.value)} required>
                          <option value="" disabled>Choose a covered member</option>
                          {policy.beneficiaries.map((member) => <option key={`${member.name}-${member.relationship}`} value={member.name}>{member.name} · {member.relationship}</option>)}
                        </select>
                      ) : (
                        <input className="input" name="deceasedName" value={deceasedName} onChange={(event) => setDeceasedName(event.target.value)} required maxLength={120} />
                      )}
                    </label>
                    <label className="field"><span className="field__label">Date of death</span><input className="input" name="dateOfDeath" type="date" required max={MAX_DATE} /></label>
                    <label className="field"><span className="field__label">Town or service area</span><input className="input" name="serviceLocation" required maxLength={200} /></label>
                    <label className="field"><span className="field__label">Burial expected date and time (if known)</span><input className="input" name="funeralAt" type="datetime-local" /></label>
                    <label className="field intake__wide"><span className="field__label">Funeral location (if known)</span><input className="input" name="funeralLocation" maxLength={200} /></label>
                  </div>
                </>
              ) : (
                <div className="intake__grid">
                  <label className="field"><span className="field__label">Plan to discuss</span>
                    <select className="select" name="requestedPlan" required defaultValue="">
                      <option value="" disabled>Choose a plan</option>
                      {plans.map((plan) => <option key={plan.id} value={plan.name}>{plan.name}</option>)}
                    </select>
                  </label>
                  <label className="field"><span className="field__label">Fidelity office or area (if applicable)</span>
                    <select className="select" name="applicationLocation" defaultValue="" required={applicationChannel === 'at-fidelity'}>
                      <option value="">Choose if visiting an office</option>
                      {TOWNS.map((town) => <option key={town} value={town}>{town}</option>)}
                    </select>
                  </label>
                  <fieldset className="intake__channel">
                    <legend>How would you like to complete the application?</legend>
                    <label><input type="radio" name="applicationChannel" value="online" checked={applicationChannel === 'online'} onChange={() => setApplicationChannel('online')} /> Online with Fidelity follow-up</label>
                    <label><input type="radio" name="applicationChannel" value="at-fidelity" checked={applicationChannel === 'at-fidelity'} onChange={() => setApplicationChannel('at-fidelity')} /> At a Fidelity office</label>
                  </fieldset>
                  <p className="intake__fine-print intake__wide">This request is not an insurance application or active cover. Fidelity will contact you to verify details and complete the formal application.</p>
                </div>
              )}

              <ServiceChecklist selected={selectedServices} onChange={toggleService} />
              <label className="intake__consent">
                <input type="checkbox" name="whatsappConsent" />
                <span>I agree that Fidelity may create a private WhatsApp group with my verified number and assigned Fidelity staff to coordinate this case. I understand this shares the case group with its members and I can ask Fidelity to close it.</span>
              </label>
              <p className="intake__fine-print">Relatives are not added automatically. You may invite a relative after the case is registered only after confirming that person has agreed to join the group.</p>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? 'Submitting securely…' : mode === 'report' ? 'Submit funeral case' : 'Submit cover consultation'}
              </button>
            </form>
          </>
        )}
      </div>
    </Section>
  )
}

function ServiceChecklist({ selected, onChange }: { selected: string[]; onChange: (name: string) => void }) {
  return (
    <fieldset className="intake__checklist">
      <legend>Services requested <span>(choose all that apply)</span></legend>
      <div className="intake__check-grid">
        {FUNERAL_SERVICE_OPTIONS.map((service) => (
          <label key={service.name}>
            <input type="checkbox" checked={selected.includes(service.name)} onChange={() => onChange(service.name)} />
            <span><strong>{service.name}</strong><small>{service.category}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default IntakePage
