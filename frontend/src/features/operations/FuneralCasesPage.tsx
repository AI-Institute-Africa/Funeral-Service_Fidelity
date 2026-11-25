import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '@/components/ui/Section'
import { StatusChip } from '@/components/ui/StatusChip'
import { paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import {
  getMyFuneralCases,
  inviteCaseRelative,
  uploadCaseDocument,
  type FuneralCaseRecord,
  type TrackingEventRecord,
} from './cases-api'
import { loadOperationsState } from './store'
import './cases.css'

function buildClientTimeline(item: FuneralCaseRecord): TrackingEventRecord[] {
  const opsState = loadOperationsState()
  const matchedOps = opsState.cases.find((c) => c.reference === item.reference || c.id === item.id)
  if (matchedOps && matchedOps.stages.length > 0) {
    return matchedOps.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      detail: stage.blocker
        ? `Attention needed: ${stage.blocker}`
        : stage.notes || (stage.assignedTo ? `Assigned to ${stage.assignedTo}` : 'Managed by Fidelity Operations'),
      status: stage.status === 'completed' ? 'completed' : stage.status === 'in-progress' || stage.status === 'pending' ? 'in_progress' : 'pending',
      at: stage.actualAt ?? stage.plannedAt ?? null,
    }))
  }
  return item.trackingEvents ?? [
    {
      id: `${item.id}-1`,
      label: 'Funeral case submitted',
      detail: 'Your case has been registered with Fidelity Operations.',
      status: 'completed',
      at: item.createdAt,
    },
    {
      id: `${item.id}-2`,
      label: 'Fidelity coordinator assignment',
      detail: item.assignedStaff?.name ? `Assigned to ${item.assignedStaff.name}` : 'Awaiting Fidelity staff coordinator.',
      status: item.assignedStaff?.name ? 'completed' : 'in_progress',
      at: null,
    },
    {
      id: `${item.id}-3`,
      label: 'Burial order & police clearance',
      detail: 'Upload both statutory documents below to proceed.',
      status: (item.documents?.length ?? 0) >= 2 ? 'completed' : 'in_progress',
      at: null,
    },
    {
      id: `${item.id}-4`,
      label: 'Case completed',
      detail: 'Tracked until burial and final settlement are completed.',
      status: item.status === 'COMPLETED' || item.status === 'CLOSED' ? 'completed' : 'pending',
      at: null,
    },
  ]
}

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

  const handleDocumentUpload = async (
    caseId: string,
    type: 'BURIAL_ORDER' | 'POLICE_CLEARANCE',
    file: File | undefined,
  ) => {
    if (!file) return
    setError('')
    setNotice('')
    setBusyCaseId(caseId)
    try {
      const dataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
        reader.readAsDataURL(file)
      })
      await uploadCaseDocument(caseId, { type, fileName: file.name, dataUrl })
      setNotice(`${type === 'BURIAL_ORDER' ? 'Burial Order' : 'Police Clearance'} (${file.name}) uploaded successfully.`)
      await loadCases()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Document could not be uploaded.')
    } finally {
      setBusyCaseId('')
    }
  }

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
          <p className="eyebrow">Your account · funeral support & live tracking</p>
          <h1>Your funeral cases</h1>
          <p className="muted page-head__lead">Track every stage from intake to burial completion, upload required clearance documents, and coordinate with your Fidelity team.</p>
          <Link className="btn btn--primary" to={paths.funeralSupport}>Register a funeral case</Link>
        </header>
        {error && <p className="cases__error" role="alert">{error}</p>}
        {notice && <p className="cases__notice" role="status">{notice}</p>}
        {loading && <p role="status">Loading your cases…</p>}
        {!loading && !cases.length && <div className="card cases__empty"><h2>No cases registered</h2><p>When you register a funeral case, its tracking dashboard and coordination status will appear here.</p></div>}
        <div className="cases__list">
          {cases.map((item) => {
            const timeline = buildClientTimeline(item)
            const completedCount = timeline.filter((evt) => evt.status === 'completed').length
            const progressPct = timeline.length ? Math.round((completedCount / timeline.length) * 100) : 0
            const burialDoc = item.documents?.find((d) => d.type === 'BURIAL_ORDER')
            const policeDoc = item.documents?.find((d) => d.type === 'POLICE_CLEARANCE')

            return (
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

                {/* Live Tracking Events Dashboard */}
                <section style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} aria-label="Case tracking events">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Tracking Events Dashboard</h3>
                    <StatusChip tone={progressPct === 100 ? 'success' : 'info'}>{completedCount} of {timeline.length} completed ({progressPct}%)</StatusChip>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', marginBottom: '0.9rem' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#16a34a' : '#b91c1c', transition: 'width 0.3s ease' }} />
                  </div>
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
                    {timeline.map((evt) => (
                      <li key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
                        <div>
                          <strong style={{ fontSize: '0.92rem' }}>
                            {evt.status === 'completed' ? '✓ ' : evt.status === 'in_progress' ? '● ' : '○ '}
                            {evt.label}
                          </strong>
                          <div className="muted" style={{ fontSize: '0.84rem', marginTop: '0.15rem' }}>{evt.detail}</div>
                        </div>
                        <StatusChip tone={evt.status === 'completed' ? 'success' : evt.status === 'in_progress' ? 'warning' : 'neutral'}>
                          {evt.status === 'completed' ? 'Completed' : evt.status === 'in_progress' ? 'In progress' : 'Pending'}
                        </StatusChip>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Required Documents: Burial Order & Police Clearance */}
                <section style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a' }} aria-label="Required funeral documents">
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Required Documents (Burial Order &amp; Police Clearance)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong>Burial Order</strong>
                        <StatusChip tone={burialDoc ? 'success' : 'warning'}>{burialDoc ? burialDoc.status.toLowerCase() : 'required'}</StatusChip>
                      </div>
                      {burialDoc ? <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 0.4rem' }}>File: {burialDoc.fileName}</p> : <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 0.4rem' }}>Not uploaded yet</p>}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busyCaseId === item.id} onChange={(e) => void handleDocumentUpload(item.id, 'BURIAL_ORDER', e.target.files?.[0])} />
                    </div>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong>Police Clearance</strong>
                        <StatusChip tone={policeDoc ? 'success' : 'warning'}>{policeDoc ? policeDoc.status.toLowerCase() : 'required'}</StatusChip>
                      </div>
                      {policeDoc ? <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 0.4rem' }}>File: {policeDoc.fileName}</p> : <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 0.4rem' }}>Not uploaded yet</p>}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busyCaseId === item.id} onChange={(e) => void handleDocumentUpload(item.id, 'POLICE_CLEARANCE', e.target.files?.[0])} />
                    </div>
                  </div>
                </section>

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
            )
          })}
        </div>
      </div>
    </Section>
  )
}

export default FuneralCasesPage
