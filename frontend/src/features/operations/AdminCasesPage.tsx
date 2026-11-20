import { useEffect, useState } from 'react'
import { Section } from '@/components/ui/Section'
import {
  assignFuneralCase,
  getAdminFuneralCases,
  getCaseStaff,
  retryCaseWhatsAppGroup,
  type CaseStaff,
  type FuneralCaseRecord,
} from './cases-api'
import './cases.css'

function AdminCasesPage() {
  const [cases, setCases] = useState<FuneralCaseRecord[]>([])
  const [staff, setStaff] = useState<CaseStaff[]>([])
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    const [caseRows, staffRows] = await Promise.all([getAdminFuneralCases(), getCaseStaff()])
    setCases(caseRows)
    setStaff(staffRows)
  }

  useEffect(() => {
    void Promise.resolve().then(refresh).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Funeral cases could not be loaded.'))
  }, [])

  const assign = async (caseId: string, staffUserId: string) => {
    if (!staffUserId) return
    setBusyId(caseId)
    setError('')
    setNotice('')
    try {
      await assignFuneralCase(caseId, staffUserId)
      setNotice('Case assigned. The coordinator was added to the WhatsApp group where consent and gateway status allow.')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The case could not be assigned.')
    } finally {
      setBusyId('')
    }
  }

  const retryGroup = async (caseId: string) => {
    setBusyId(caseId)
    setError('')
    setNotice('')
    try {
      const result = await retryCaseWhatsAppGroup(caseId)
      setNotice(`WhatsApp group status: ${result.status}${result.error ? ` — ${result.error}` : ''}`)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'WhatsApp group creation could not be retried.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <Section containerClassName="cases-page">
      <div className="cases">
        <header className="page-head">
          <p className="eyebrow">Fidelity management · case coordination</p>
          <h1>Funeral cases</h1>
          <p className="muted page-head__lead">Review authenticated customer cases, assign a Fidelity coordinator and monitor consent-gated WhatsApp groups.</p>
        </header>
        {error && <p className="cases__error" role="alert">{error}</p>}
        {notice && <p className="cases__notice" role="status">{notice}</p>}
        {!cases.length && <div className="card cases__empty"><h2>No registered cases</h2><p>Cases submitted by signed-in customers will be listed here.</p></div>}
        <div className="cases__list">
          {cases.map((item) => (
            <article className="card cases__card" key={item.id}>
              <div className="cases__heading">
                <div><p className="eyebrow">{item.caseType === 'POLICY_COVERED' ? 'Policy-covered funeral' : 'Coverage consultation'}</p><h2>{item.reference}</h2></div>
                <span className="cases__status">{item.status.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
              <p><strong>Reporter:</strong> {item.reporterName} · {item.contactPhone}</p>
              {item.deceasedName && <p><strong>Deceased:</strong> {item.deceasedName} · {item.serviceLocation}</p>}
              {item.policyNumber && <p><strong>Policy:</strong> {item.policyNumber} · review: {item.coverageReviewStatus.toLowerCase()}</p>}
              {item.requestedPlan && <p><strong>Requested plan:</strong> {item.requestedPlan}</p>}
              <p><strong>Services:</strong> {item.requestedServices.join(', ')}</p>
              <div className="cases__assignment">
                <label className="field"><span className="field__label">Assigned Fidelity coordinator</span>
                  <select className="select" value={item.assignedStaff?.id ?? ''} disabled={busyId === item.id} onChange={(event) => void assign(item.id, event.target.value)}>
                    <option value="">Select a coordinator</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.name}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</option>)}
                  </select>
                </label>
                <div className="cases__group-status">
                  <strong>WhatsApp group: {item.whatsappGroup?.status.toLowerCase() ?? 'missing'}</strong>
                  {item.whatsappGroup?.error && <span className="cases__error">{item.whatsappGroup.error}</span>}
                  {item.whatsappGroup?.status !== 'NOT_REQUESTED' && (item.whatsappGroup?.status !== 'ACTIVE' || Boolean(item.whatsappGroup.error)) && (
                    <button className="btn btn--outline" type="button" disabled={busyId === item.id} onClick={() => void retryGroup(item.id)}>{busyId === item.id ? 'Retrying…' : 'Retry group creation'}</button>
                  )}
                  {item.whatsappGroup?.status === 'ACTIVE' && <span>Members: {item.whatsappGroup.participants.map((participant) => `${participant.name} (${participant.role.toLowerCase()})`).join(', ')}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}

export default AdminCasesPage
