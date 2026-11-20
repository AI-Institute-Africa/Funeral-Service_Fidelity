import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '@/components/ui/Section'
import { paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import {
  getMyFuneralCases,
  inviteCaseRelative,
  type FuneralCaseRecord,
} from './cases-api'
import './cases.css'

function FuneralCasesPage() {
  const { user } = useAuth()
  const [cases, setCases] = useState<FuneralCaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyCaseId, setBusyCaseId] = useState('')

  const loadCases = async () => {
    try {
      setCases(await getMyFuneralCases())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your cases could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void Promise.resolve().then(loadCases)
  }, [user])

  const inviteRelative = async (event: FormEvent<HTMLFormElement>, item: FuneralCaseRecord) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const formElement = event.currentTarget
    if (form.get('confirmsConsent') !== 'on') {
      setError('Confirm that the relative agreed to join before sending an invitation.')
      return
    }
    setBusyCaseId(item.id)
    try {
      const result = await inviteCaseRelative(item.id, {
        name: String(form.get('name') ?? ''),
        relationship: String(form.get('relationship') ?? ''),
        phoneNumber: String(form.get('phoneNumber') ?? ''),
        confirmsConsent: true,
      })
      setNotice(`Relative invitation saved. WhatsApp group status: ${result.status}.`)
      formElement.reset()
      await loadCases()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The invitation could not be saved.')
    } finally {
      setBusyCaseId('')
    }
  }

  return (
    <Section containerClassName="cases-page">
      <div className="cases">
        <header className="page-head">
          <p className="eyebrow">Your account · funeral support</p>
          <h1>Your funeral cases</h1>
          <p className="muted page-head__lead">View case progress, Fidelity assignment and the consent-based WhatsApp coordination group.</p>
          <Link className="btn btn--primary" to={paths.funeralSupport}>Register a funeral case</Link>
        </header>
        {error && <p className="cases__error" role="alert">{error}</p>}
        {notice && <p className="cases__notice" role="status">{notice}</p>}
        {loading && <p role="status">Loading your cases…</p>}
        {!loading && !cases.length && <div className="card cases__empty"><h2>No cases registered</h2><p>When you register a funeral case, its reference and coordination status will appear here.</p></div>}
        <div className="cases__list">
          {cases.map((item) => (
            <article className="card cases__card" key={item.id}>
              <div className="cases__heading">
                <div><p className="eyebrow">{item.caseType === 'POLICY_COVERED' ? 'Policy-covered funeral' : 'Coverage consultation'}</p><h2>{item.reference}</h2></div>
                <span className="cases__status">{item.status.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
              {item.deceasedName && <p><strong>Deceased:</strong> {item.deceasedName} {item.dateOfDeath ? `· ${item.dateOfDeath}` : ''}</p>}
              {item.policyNumber && <p><strong>Policy:</strong> {item.policyNumber} · coverage review: {item.coverageReviewStatus.replaceAll('_', ' ').toLowerCase()}</p>}
              {item.requestedPlan && <p><strong>Plan to discuss:</strong> {item.requestedPlan}</p>}
              {item.requestedServices.length > 0 && <p><strong>Requested services:</strong> {item.requestedServices.join(', ')}</p>}
              <p><strong>Fidelity coordinator:</strong> {item.assignedStaff?.name || 'Awaiting assignment'}</p>
              <section className="cases__group">
                <h3>WhatsApp coordination</h3>
                {item.whatsappGroup?.status === 'ACTIVE'
                  ? <p role="status">Group active. Members: {item.whatsappGroup.participants.map((participant) => `${participant.name} (${participant.role.toLowerCase()})`).join(', ') || 'No participants listed'}.</p>
                  : item.whatsappGroup?.status === 'FAILED'
                    ? <p className="cases__error">Group creation could not complete: {item.whatsappGroup.error ?? 'Fidelity will retry or contact you.'}</p>
                    : <p>{item.whatsappGroup?.status === 'NOT_REQUESTED' ? 'You did not opt in to WhatsApp coordination for this case.' : `Group status: ${item.whatsappGroup?.status.toLowerCase() ?? 'not available'}.`}</p>}
                {item.whatsappGroup?.status !== 'NOT_REQUESTED' && (
                  <form className="cases__invite" onSubmit={(event) => void inviteRelative(event, item)}>
                    <h4>Invite a relative (their agreement is required)</h4>
                    <label className="field"><span className="field__label">Relative’s name</span><input className="input" name="name" required maxLength={120} /></label>
                    <label className="field"><span className="field__label">Relationship to the deceased</span><input className="input" name="relationship" required maxLength={80} /></label>
                    <label className="field"><span className="field__label">WhatsApp number with country code</span><input className="input" name="phoneNumber" required placeholder="+263…" /></label>
                    <label className="cases__consent"><input type="checkbox" name="confirmsConsent" required /><span>I confirm this relative has agreed to join this funeral coordination group.</span></label>
                    <button className="btn btn--outline" type="submit" disabled={busyCaseId === item.id}>{busyCaseId === item.id ? 'Saving…' : 'Add consented relative'}</button>
                  </form>
                )}
              </section>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}

export default FuneralCasesPage
