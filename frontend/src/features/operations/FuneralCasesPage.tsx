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
} from './cases-api'
import {
  createCaseStages,
  createDefaultTaskSteps,
  getStaffContact,
  type CaseStage,
} from './data'
import { loadOperationsState } from './store'
import './cases.css'

function buildClientStages(item: FuneralCaseRecord): CaseStage[] {
  const opsState = loadOperationsState()
  const matchedOps = opsState.cases.find((c) => c.reference === item.reference || c.id === item.id)
  if (matchedOps && matchedOps.stages.length > 0) {
    return matchedOps.stages.map((stage, idx) => ({
      ...stage,
      assignedTo: stage.assignedTo || createCaseStages()[idx]?.assignedTo || '',
      steps: stage.steps && stage.steps.length > 0 ? stage.steps : createDefaultTaskSteps(stage.label),
      logbook: stage.logbook ?? [],
    }))
  }

  const defaults = createCaseStages()
  const hasDocs = (item.documents?.length ?? 0) >= 2
  const isCompleted = item.status === 'COMPLETED' || item.status === 'CLOSED'
  return defaults.map((stage, idx) => {
    let status = stage.status
    if (isCompleted) {
      status = 'completed'
    } else if (idx === 0) {
      status = item.assignedStaff?.name ? 'completed' : 'in-progress'
    } else if (idx === 4 && hasDocs) {
      status = 'completed'
    }
    return {
      ...stage,
      status,
      actualAt: idx === 0 && status === 'completed' ? item.createdAt : stage.actualAt,
    }
  })
}

function stageTone(status: CaseStage['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'in-progress' || status === 'pending') return 'warning'
  if (status === 'blocked') return 'danger'
  return 'neutral'
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
      setNotice(`${type === 'BURIAL_ORDER' ? 'Burial Order' : 'Police Clearance'} (${file.name}) uploaded successfully. Please check your phone and WhatsApp for further actions.`)
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
          <p className="eyebrow">Your account · funeral support &amp; live tracking</p>
          <h1>Your funeral cases</h1>
          <p className="muted page-head__lead">Track every stage from intake to burial completion, view your assigned Fidelity staff and contact numbers, upload required clearance documents, and coordinate with your Fidelity team.</p>
          <Link className="btn btn--primary" to={paths.funeralSupport}>Register a funeral case</Link>
        </header>
        {error && <p className="cases__error" role="alert">{error}</p>}
        {notice && <p className="cases__notice" role="status">{notice}</p>}
        {loading && <p role="status">Loading your cases…</p>}
        {!loading && !cases.length && <div className="card cases__empty"><h2>No cases registered</h2><p>When you register a funeral case, its tracking dashboard and coordination status will appear here.</p></div>}
        <div className="cases__list">
          {cases.map((item) => {
            const stages = buildClientStages(item)
            const completedCount = stages.filter((s) => s.status === 'completed').length
            const progressPct = stages.length ? Math.round((completedCount / stages.length) * 100) : 0
            const burialDoc = item.documents?.find((d) => d.type === 'BURIAL_ORDER')
            const policeDoc = item.documents?.find((d) => d.type === 'POLICE_CLEARANCE')
            const leadStaff = getStaffContact(item.assignedStaff?.name) ?? getStaffContact('Nomsa Ndlovu')

            return (
              <article className="card cases__card" key={item.id}>
                <div className="cases__heading">
                  <div><p className="eyebrow">{item.caseType === 'POLICY_COVERED' ? 'Policy-covered funeral' : 'Coverage consultation'}</p><h2>{item.reference}</h2></div>
                  <span className="cases__status">{item.status.replaceAll('_', ' ').toLowerCase()}</span>
                </div>
                {item.deceasedName && <p><strong>Deceased:</strong> {item.deceasedName} {item.dateOfDeath ? `· ${item.dateOfDeath}` : ''}</p>}
                {item.policyNumber && <p><strong>Policy:</strong> {item.policyNumber} · coverage review: {item.coverageReviewStatus.replaceAll('_', ' ').toLowerCase()}</p>}
                {item.requestedPlan && <p><strong>Funeral plan to discuss:</strong> {item.requestedPlan}</p>}
                {item.requestedServices.length > 0 && <p><strong>Requested services:</strong> {item.requestedServices.join(', ')}</p>}

                {/* Assigned Fidelity Staff Contact Card */}
                <div style={{ marginTop: '0.6rem', padding: '0.75rem 0.9rem', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.92rem' }}>Assigned Fidelity Coordinator:</strong>{' '}
                    <span>{leadStaff ? `${leadStaff.name} (${leadStaff.role})` : 'Awaiting assignment'}</span>
                  </div>
                  {leadStaff && (
                    <a href={`tel:${leadStaff.phone.replace(/\s+/g, '')}`} className="btn btn--sm btn--primary" style={{ textDecoration: 'none' }}>
                      📞 Call {leadStaff.phone}
                    </a>
                  )}
                </div>

                {/* Full 11-Stage Tracking Events Dashboard (Mirroring Fidelity Operations) */}
                <section style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} aria-label="Case tracking events">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Tracking Events Dashboard (Fidelity Operations Pipeline)</h3>
                    <StatusChip tone={progressPct === 100 ? 'success' : 'info'}>{completedCount} of {stages.length} completed ({progressPct}%)</StatusChip>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', marginBottom: '0.9rem' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#16a34a' : '#b91c1c', transition: 'width 0.3s ease' }} />
                  </div>
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
                    {stages.map((stage, index) => {
                      const staff = getStaffContact(stage.assignedTo)
                      const steps = stage.steps ?? []
                      const doneSteps = steps.filter((s) => s.done).length
                      const logs = stage.logbook ?? []

                      return (
                        <li key={stage.id} style={{ padding: '0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e5e7eb', display: 'grid', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div>
                              <strong style={{ fontSize: '0.96rem' }}>
                                {index + 1}. {stage.label}
                              </strong>
                              <div className="muted" style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>
                                {stage.actualAt
                                  ? `Actual time: ${new Date(stage.actualAt).toLocaleString('en-GB')}`
                                  : stage.plannedAt
                                    ? `Planned time: ${new Date(stage.plannedAt).toLocaleString('en-GB')}`
                                    : 'Actual time not recorded'}
                              </div>
                            </div>
                            <StatusChip tone={stageTone(stage.status)}>
                              {stage.status.replaceAll('-', ' ')}
                            </StatusChip>
                          </div>

                          <div style={{ fontSize: '0.86rem', padding: '0.45rem 0.65rem', borderRadius: '6px', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span>
                              <strong>Assigned staff:</strong>{' '}
                              {staff ? `${staff.name} (${staff.role} · ${staff.phone})` : 'Unassigned'}
                            </span>
                            {staff && (
                              <a href={`tel:${staff.phone.replace(/\s+/g, '')}`} style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1d4ed8', textDecoration: 'none' }}>
                                📞 {staff.phone}
                              </a>
                            )}
                          </div>

                          {stage.blocker && (
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#b91c1c', fontWeight: 600 }}>
                              Blocker: {stage.blocker}
                            </p>
                          )}
                          {stage.notes && (
                            <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                              Notes: {stage.notes}
                            </p>
                          )}

                          {steps.length > 0 && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                                Action steps {staff ? `for ${staff.name}` : ''} ({doneSteps} / {steps.length} completed)
                              </div>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
                                {steps.map((step, sIdx) => (
                                  <li key={step.id} style={{ color: step.done ? '#15803d' : '#475569' }}>
                                    {step.done ? '✓' : '○'} Step {sIdx + 1}: {step.label}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {logs.length > 0 && (
                            <div style={{ marginTop: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
                                Task Logbook &amp; WhatsApp Group Sync
                              </div>
                              {logs.slice(0, 3).map((entry) => (
                                <div key={entry.id} style={{ fontSize: '0.8rem', color: '#334155' }}>
                                  <strong>{entry.author}</strong> ({new Date(entry.at).toLocaleString('en-GB')}): {entry.note}
                                  {entry.whatsappSynced && <span style={{ color: '#047857', marginLeft: '6px' }}>· WhatsApp Group Sent</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
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
