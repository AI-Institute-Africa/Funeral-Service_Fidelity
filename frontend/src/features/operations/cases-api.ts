import { get, post } from '@/lib/http'

export type FuneralCaseRecord = {
  id: string
  reference: string
  caseType: 'POLICY_COVERED' | 'WALK_IN_COVERAGE'
  status: string
  reporterName: string
  contactPhone: string
  deceasedName: string | null
  dateOfDeath: string | null
  serviceLocation: string | null
  funeralAt: string | null
  funeralLocation: string | null
  requestedPlan: string | null
  applicationChannel: string | null
  applicationLocation: string | null
  requestedServices: string[]
  policyNumber: string | null
  coverageReviewStatus: string
  createdAt: string
  assignedStaff: { id: string; name: string; phoneNumber: string | null } | null
  whatsappGroup: {
    status: string
    error: string | null
    participants: { name: string; phoneNumber: string; role: string; added: boolean; relationship: string | null }[]
  } | null
}

export type FuneralCaseInput = {
  caseType: FuneralCaseRecord['caseType']
  reporterName: string
  deceasedName?: string
  dateOfDeath?: string
  serviceLocation?: string
  funeralAt?: string
  funeralLocation?: string
  policyNumber?: string
  requestedPlan?: string
  applicationChannel?: 'online' | 'at-fidelity'
  applicationLocation?: string
  requestedServices: string[]
  whatsappConsent: boolean
}

export type CaseStaff = { id: string; name: string; jobTitle?: string; phoneNumber: string | null }

export const getMyFuneralCases = () => get<FuneralCaseRecord[]>('/me/funeral-cases')
export const getAdminFuneralCases = () => get<FuneralCaseRecord[]>('/admin/funeral-cases')
export const getCaseStaff = () => get<CaseStaff[]>('/admin/funeral-cases/staff')
export const submitFuneralCase = (input: FuneralCaseInput) => post<FuneralCaseRecord>('/me/funeral-cases', input)
export const assignFuneralCase = (caseId: string, staffUserId: string) =>
  post<FuneralCaseRecord>(`/admin/funeral-cases/${encodeURIComponent(caseId)}/assign`, { staffUserId })
export const retryCaseWhatsAppGroup = (caseId: string) =>
  post<{ status: string; error: string | null }>(`/admin/funeral-cases/${encodeURIComponent(caseId)}/whatsapp/retry`, {})
export const inviteCaseRelative = (caseId: string, input: { name: string; relationship: string; phoneNumber: string; confirmsConsent: true }) =>
  post<{ status: string }>(`/me/funeral-cases/${encodeURIComponent(caseId)}/participants`, input)
