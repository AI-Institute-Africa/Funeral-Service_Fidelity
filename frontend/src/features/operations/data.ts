export type CaseType = 'policy-covered' | 'cash-walk-in'
export type CaseStatus =
  | 'new'
  | 'intake'
  | 'awaiting-information'
  | 'ready'
  | 'in-progress'
  | 'delayed'
  | 'completed'
  | 'reconciliation'
  | 'closed'
export type StageStatus = 'not-started' | 'pending' | 'in-progress' | 'blocked' | 'completed' | 'cancelled'
export type ChecklistStatus =
  | 'not-requested'
  | 'requested'
  | 'confirmed'
  | 'assigned'
  | 'ready'
  | 'completed'
  | 'cancelled'
export type DocumentStatus = 'missing' | 'received' | 'under-review' | 'verified' | 'rejected'
export type PolicyStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'awaiting-information'
  | 'approved'
  | 'active'
  | 'declined'
  | 'cancelled'
  | 'suspended'
export type ContributionStatus =
  | 'recorded'
  | 'pending-confirmation'
  | 'confirmed'
  | 'reconciled'
  | 'needs-review'
  | 'duplicate'
  | 'rejected'
  | 'reversed'
export type QuoteStatus =
  | 'draft'
  | 'issued'
  | 'accepted'
  | 'rejected'
  | 'revised'
  | 'payment-pending'
  | 'partially-paid'
  | 'paid'
  | 'adjustment-pending'
  | 'reconciled'
export type TransportStatus = 'planned' | 'assigned' | 'in-progress' | 'completed' | 'cancelled'

export type Money = { amount: number; currency: string }

export type PolicyApplication = {
  id: string
  reference: string
  customerName: string
  phone: string
  product: string
  coveredMembers: string[]
  requestedServices?: string[]
  applicationChannel?: 'online' | 'at-fidelity'
  applicationLocation?: string
  status: PolicyStatus
  checks: { identityVerified: boolean; documentsVerified: boolean; eligibilityConfirmed: boolean }
  effectiveDate?: string
  responsibleStaff: string
  notes: string
  createdAt: string
  updatedAt: string
  demo: boolean
}

export type TaskStep = {
  id: string
  label: string
  done: boolean
  completedAt?: string
  completedBy?: string
}

export type TaskLogEntry = {
  id: string
  at: string
  author: string
  stepLabel?: string
  note: string
  whatsappSynced?: boolean
}

const TASK_STEP_PRESETS: Array<{ match: RegExp; steps: string[] }> = [
  {
    match: /body removal|collection/i,
    steps: [
      'Confirm exact pickup address (hospital, mortuary, or residence) & family contact',
      'Dispatch removal vehicle with stretcher, PPE, and identification tag',
      'Verify deceased identity & log condition on removal transfer sheet',
      'Admit body into Fidelity / partner mortuary cold room & notify family',
    ],
  },
  {
    match: /mortuary|overnight/i,
    steps: [
      'Log mortuary cold-room admission & assign storage bay tag',
      'Verify Burial Order and Police Clearance before preparation',
      'Complete hygienic washing, dressing, and embalming as instructed',
      'Prepare viewing room & confirm presentation time with family',
    ],
  },
  {
    match: /coffin|casket/i,
    steps: [
      'Confirm selected casket model, dimensions, and interior finish with family',
      'Inspect casket shell, handles, and lining in workshop / store',
      'Engrave and mount brass nameplate with full name and dates',
      'Stage casket for hearse loading and sign off dispatch checklist',
    ],
  },
  {
    match: /hearse|transport to gravesite|burial-day transport/i,
    steps: [
      'Confirm church/chapel route, departure time, and cemetery coordinates',
      'Inspect hearse cleanliness, fuel level, and ceremonial fittings',
      'Load casket securely and lead family convoy on schedule',
      'Arrive at gravesite and coordinate pallbearer unloading',
    ],
  },
  {
    match: /tent|chairs/i,
    steps: [
      'Confirm expected guest count, tent size, and venue ground conditions',
      'Load marquee tent, chairs, tables, and sound/shade gear onto truck',
      'Erect tent, anchor guy-ropes, and arrange seating before mourners arrive',
      'Strike down, count, and collect all equipment after the service',
    ],
  },
  {
    match: /burial setup|lowering|equipment/i,
    steps: [
      'Confirm cemetery plot number and grave excavation readiness',
      'Stage lowering device, webbing straps, artificial turf, and gazebo',
      'Test lowering mechanism and brief pallbearers before committal',
      'Complete lowering, retrieve gear, and record graveside sign-off',
    ],
  },
  {
    match: /case intake|eligibility/i,
    steps: [
      'Verify reporter identity and registered contact phone number',
      'Check policy status, waiting period, or walk-in payment path',
      'Record deceased particulars, date of death, and requested services',
      'Assign Fidelity staff coordinator & activate family WhatsApp group',
    ],
  },
  {
    match: /post-mortem/i,
    steps: [
      'Confirm with family and medical/police authorities if post-mortem is required',
      'Schedule pathology examination and arrange mortuary transfer if needed',
      'Collect post-mortem report / cause-of-death certificate',
      'Update case file and clear body for final preparation',
    ],
  },
  {
    match: /burial order|police clearance/i,
    steps: [
      'Collect uploaded Burial Order and verify issuing registrar details',
      'Collect uploaded Police Clearance / Death Certificate and check stamps',
      'Cross-check deceased particulars against policy / intake record',
      'Mark statutory clearances verified and archive copies in case file',
    ],
  },
  {
    match: /service underway|burial \/ service/i,
    steps: [
      'Confirm officiant, family representatives, and pallbearers are in place',
      'Monitor chapel/graveside programme timing and sound/tent readiness',
      'Support committal rites and graveside lowering',
      'Confirm safe departure of family and crew from cemetery',
    ],
  },
  {
    match: /burial completed/i,
    steps: [
      'Confirm grave backfilling and floral placement completed',
      'Retrieve all Fidelity lowering gear, tents, chairs, and signage',
      'Confirm family acknowledgement and update case status to completed',
      'Send completion update to the family WhatsApp coordination group',
    ],
  },
  {
    match: /settlement|reconciliation/i,
    steps: [
      'Reconcile final service invoice against policy benefit or cash payments',
      'Verify any Chema Wallet contributions and approved payout disbursements',
      'Post final settlement and receipts to Fidelity Life ERP',
      'Resolve any outstanding balances or adjustments with family',
    ],
  },
  {
    match: /case closed/i,
    steps: [
      'Confirm all services, documents, and ERP financial entries are finalized',
      'Archive digital funeral record and memorial link for the family',
      'Close case WhatsApp coordination group with family consent',
      'Trigger aftercare & bereavement support follow-up',
    ],
  },
]

export function createDefaultTaskSteps(taskName: string): TaskStep[] {
  const preset = TASK_STEP_PRESETS.find((entry) => entry.match.test(taskName))
  const labels = preset
    ? preset.steps
    : [
        `Confirm scope & schedule for "${taskName}"`,
        `Assign Fidelity staff & prepare resources for "${taskName}"`,
        `Execute "${taskName}" and record field update in logbook`,
        `Verify completion of "${taskName}" & notify case WhatsApp group`,
      ]
  return labels.map((label, idx) => ({
    id: `step-${idx + 1}`,
    label,
    done: false,
  }))
}

export type CaseStage = {
  id: string
  label: string
  status: StageStatus
  assignedTo: string
  plannedAt?: string
  actualAt?: string
  notes: string
  blocker: string
  steps?: TaskStep[]
  logbook?: TaskLogEntry[]
}

export type ChecklistItem = {
  id: string
  name: string
  category: string
  quantity: number
  status: ChecklistStatus
  assignedTo: string
  notes: string
  estimate?: Money
  createdAt: string
  removedAt?: string
  removalReason?: string
  steps?: TaskStep[]
  logbook?: TaskLogEntry[]
}

export type CaseDocument = {
  id: string
  type: string
  status: DocumentStatus
  receivedAt?: string
  receivedBy: string
  verifiedAt?: string
  verifiedBy: string
  notes: string
}

export type TransportMovement = {
  id: string
  leg: string
  pickup: string
  destination: string
  vehicle: string
  driver: string
  status: TransportStatus
  plannedAt?: string
  actualAt?: string
  notes: string
}

export type CaseQuote = {
  id: string
  reference: string
  status: QuoteStatus
  lines: { id: string; description: string; checklistItemId?: string; amount: number }[]
  currency: string
  createdAt: string
  acceptedAt?: string
  notes: string
}

export type CasePayment = {
  id: string
  amount: number
  currency: string
  channel: string
  reference: string
  status: 'recorded' | 'confirmed' | 'reconciled' | 'reversed'
  receivedAt: string
  receivedBy: string
  notes: string
  reversalOf?: string
}

export type Contribution = {
  id: string
  contributorName?: string
  contributorContact?: string
  consentToContact: boolean
  amount: number
  currency: string
  channel: string
  reference: string
  status: ContributionStatus
  contributedAt: string
  recordedBy: string
  confirmedBy: string
  notes: string
  adjustmentOf?: string
  adjustmentType?: 'debit' | 'credit'
}

export type FuneralCase = {
  id: string
  reference: string
  type: CaseType
  customerName: string
  phone: string
  deceasedName: string
  dateOfDeath: string
  serviceLocation: string
  branch: string
  funeralAt?: string
  funeralLocation: string
  coordinator: string
  priority: 'standard' | 'urgent' | 'delayed'
  priorityReason: string
  closureReason?: string
  status: CaseStatus
  policyReference?: string
  intakeChannel?: 'online' | 'staff'
  postMortem: 'pending' | 'required' | 'not-required' | 'completed'
  stages: CaseStage[]
  checklist: ChecklistItem[]
  documents: CaseDocument[]
  movements: TransportMovement[]
  quotes: CaseQuote[]
  payments: CasePayment[]
  contributions: Contribution[]
  walletGoal?: Money
  createdAt: string
  updatedAt: string
  demo: boolean
}

export type CatalogueItem = {
  id: string
  name: string
  category: string
  description: string
  active: boolean
  createdAt: string
}

export type AuditEntry = {
  id: string
  at: string
  actor: string
  action: string
  entity: string
  summary: string
  demo: boolean
}

export type ExhumationStatus =
  | 'new'
  | 'awaiting-documents'
  | 'awaiting-permit'
  | 'approved'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'

export type ExhumationRequirementStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

export type ExhumationRequirement = {
  id: string
  name: string
  status: ExhumationRequirementStatus
  notes: string
}

export type ExhumationCase = {
  id: string
  reference: string
  customerName: string
  phone: string
  deceasedName: string
  address: string
  destinationAddress: string
  currency: string
  requestedAt: string
  status: ExhumationStatus
  estimatedCost?: number
  quotedPrice?: number
  permitReference: string
  permitStatus: ExhumationRequirementStatus
  requirements: ExhumationRequirement[]
  notes: string
  createdAt: string
  updatedAt: string
  demo: boolean
}

export type TokenFeature =
  | 'exhumation'
  | 'whatsapp-alerts'
  | 'llm-support'
  | 'grave-map'
  | 'flower-tribute'
  | 'biography-generation'
  | 'music-generation'
  | 'video-generation'
  | 'stream-replay'

export type TokenCharge = {
  feature: TokenFeature
  label: string
  enabled: boolean
  amount?: number
}

export type OperationsState = {
  version: 2
  policies: PolicyApplication[]
  cases: FuneralCase[]
  catalogue: CatalogueItem[]
  audit: AuditEntry[]
  exhumations: ExhumationCase[]
  tokenCharges: TokenCharge[]
}

export const EXHUMATION_STATUSES: { value: ExhumationStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'awaiting-documents', label: 'Awaiting documents' },
  { value: 'awaiting-permit', label: 'Awaiting permits' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const EXHUMATION_REQUIREMENTS = [
  'Applicant identity and proof of relationship',
  'Original burial record or grave location confirmation',
  'Written consent from the landowner / cemetery authority',
  'Exhumation permit from the relevant authority',
  'Destination burial or reinterment arrangements',
]

export const TOKEN_FEATURES: { feature: TokenFeature; label: string }[] = [
  { feature: 'exhumation', label: 'Exhumation service' },
  { feature: 'whatsapp-alerts', label: 'WhatsApp notifications' },
  { feature: 'llm-support', label: 'AI support assistant' },
  { feature: 'grave-map', label: 'Grave-map lookup' },
  { feature: 'flower-tribute', label: 'Virtual flower tribute' },
  { feature: 'biography-generation', label: 'Biography generation' },
  { feature: 'music-generation', label: 'Music generation' },
  { feature: 'video-generation', label: 'Video generation' },
  { feature: 'stream-replay', label: 'Funeral recording replay' },
]

export function createDefaultTokenCharges(): TokenCharge[] {
  return TOKEN_FEATURES.map(({ feature, label }) => ({ feature, label, enabled: false }))
}

export const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'intake', label: 'Intake in progress' },
  { value: 'awaiting-information', label: 'Awaiting information' },
  { value: 'ready', label: 'Ready for operations' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'delayed', label: 'Delayed / on hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'reconciliation', label: 'Reconciliation pending' },
  { value: 'closed', label: 'Closed' },
]

export const POLICY_STATUSES: { value: PolicyStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under-review', label: 'Under review' },
  { value: 'awaiting-information', label: 'Awaiting information' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'suspended', label: 'Suspended' },
]

export const STAGE_TEMPLATES = [
  'Case intake and eligibility / payment path',
  'Body removal / collection coordination',
  'Transport to mortuary / overnight facility',
  'Post-mortem decision and outcome',
  'Burial order and police clearance',
  'Burial setup and equipment readiness',
  'Burial-day transport to gravesite',
  'Burial / service underway',
  'Burial completed',
  'Final settlement / reconciliation',
  'Case closed',
]

export const CHECKLIST_STATUSES: { value: ChecklistStatus; label: string }[] = [
  { value: 'not-requested', label: 'Not requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Delivered / completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string }[] = [
  { value: 'missing', label: 'Missing' },
  { value: 'received', label: 'Received' },
  { value: 'under-review', label: 'Under review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
]

export const CONTRIBUTION_STATUSES: { value: ContributionStatus; label: string }[] = [
  { value: 'recorded', label: 'Recorded' },
  { value: 'pending-confirmation', label: 'Pending confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'needs-review', label: 'Needs review' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'reversed', label: 'Reversed / adjusted' },
]

export const QUOTE_STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revised', label: 'Revised' },
  { value: 'payment-pending', label: 'Payment pending' },
  { value: 'partially-paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'adjustment-pending', label: 'Adjustment pending' },
  { value: 'reconciled', label: 'Reconciled' },
]

export const STAFF_DIRECTORY: Record<string, { name: string; role: string; phone: string }> = {
  'Nomsa Ndlovu': { name: 'Nomsa Ndlovu', role: 'Head of Funeral Operations', phone: '+263 773 000 333' },
  'Tariro Chikwanha': { name: 'Tariro Chikwanha', role: 'Senior Case Lead', phone: '+263 790 499 962' },
  'Farai Gumbo': { name: 'Farai Gumbo', role: 'Mortuary & Logistics Lead', phone: '+263 772 555 666' },
  'Blessing Moyo': { name: 'Blessing Moyo', role: 'Transport & Fleet', phone: '+263 771 888 999' },
  'Chipo Dube': { name: 'Chipo Dube', role: 'Chapel & Ceremonies', phone: '+263 773 000 222' },
  'Operations Team': { name: 'Operations Team', role: 'Harare Desk', phone: '+263 790 499 962' },
}

export const DEFAULT_STAGE_STAFF: string[] = [
  'Farai Gumbo',
  'Nomsa Ndlovu',
  'Farai Gumbo',
  'Blessing Moyo',
  'Farai Gumbo',
  'Nomsa Ndlovu',
  'Farai Gumbo',
  'Blessing Moyo',
  'Chipo Dube',
  '',
  'Tariro Chikwanha',
]

export function getStaffContact(name?: string | null): { name: string; role: string; phone: string } | null {
  if (!name) return null
  const found = STAFF_DIRECTORY[name.trim()]
  if (found) return found
  return { name: name.trim(), role: 'Fidelity Coordinator', phone: '+263 790 499 962' }
}

export function createCaseStages(): CaseStage[] {
  return STAGE_TEMPLATES.map((label, index) => ({
    id: `stage-${index + 1}`,
    label,
    status: 'not-started',
    assignedTo: DEFAULT_STAGE_STAFF[index] ?? '',
    notes: '',
    blocker: '',
    steps: createDefaultTaskSteps(label),
    logbook: [],
  }))
}

export function canActivatePolicy(policy: PolicyApplication): boolean {
  return (
    policy.status === 'approved' &&
    policy.checks.identityVerified &&
    policy.checks.documentsVerified &&
    policy.checks.eligibilityConfirmed
  )
}

export function makeReference(prefix: string, references: string[]): string {
  const max = references.reduce((highest, reference) => {
    const match = reference.match(/-(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

export function formatMoney(amount: number, currency: string): string {
  const safeCurrency = currency.trim().toUpperCase()
  return `${safeCurrency || '—'} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)}`
}

export function quoteTotal(quote: CaseQuote): number {
  return quote.lines.reduce((total, line) => total + line.amount, 0)
}

export function caseBalance(funeralCase: FuneralCase, currency: string): number {
  const acceptedQuotes = funeralCase.quotes.filter(
    (quote) => quote.currency === currency && !['rejected', 'revised', 'draft'].includes(quote.status),
  )
  const quoted = acceptedQuotes.reduce((total, quote) => total + quoteTotal(quote), 0)
  const paid = funeralCase.payments
    .filter((payment) => payment.currency === currency && ['confirmed', 'reconciled', 'reversed'].includes(payment.status) && (payment.status !== 'reversed' || Boolean(payment.reversalOf)))
    .reduce((total, payment) => total + (payment.reversalOf ? -payment.amount : payment.amount), 0)
  return quoted - paid
}

export function contributionTotal(contributions: Contribution[], currency: string, statuses: ContributionStatus[]): number {
  return contributions
    .filter((contribution) => contribution.currency === currency && statuses.includes(contribution.status))
    .reduce((total, contribution) => {
      if (contribution.adjustmentOf) return total + (contribution.adjustmentType === 'credit' ? contribution.amount : -contribution.amount)
      return total + contribution.amount
    }, 0)
}

export function nextContributionStatuses(status: ContributionStatus): ContributionStatus[] {
    const transitions: Record<ContributionStatus, ContributionStatus[]> = {
      recorded: ['pending-confirmation', 'needs-review', 'duplicate', 'rejected'],
      'pending-confirmation': ['confirmed', 'needs-review', 'duplicate', 'rejected'],
      confirmed: ['reconciled', 'needs-review'],
      reconciled: [],
      'needs-review': ['pending-confirmation', 'confirmed', 'duplicate', 'rejected'],
      duplicate: ['needs-review', 'rejected'],
      rejected: [],
      reversed: [],
    }
    return transitions[status]
}

export function nextPaymentStatuses(status: CasePayment['status']): CasePayment['status'][] {
    const transitions: Record<CasePayment['status'], CasePayment['status'][]> = {
      recorded: ['confirmed'],
      confirmed: ['reconciled'],
      reconciled: [],
      reversed: [],
    }
    return transitions[status]
}

export function nextQuoteStatuses(status: QuoteStatus): QuoteStatus[] {
    const transitions: Record<QuoteStatus, QuoteStatus[]> = {
      draft: ['issued', 'revised'],
      issued: ['accepted', 'rejected', 'revised'],
      accepted: ['payment-pending', 'partially-paid', 'paid', 'adjustment-pending', 'revised'],
      rejected: [],
      revised: [],
      'payment-pending': ['partially-paid', 'paid', 'adjustment-pending', 'revised'],
      'partially-paid': ['paid', 'adjustment-pending', 'revised'],
      paid: ['reconciled', 'adjustment-pending'],
      'adjustment-pending': ['partially-paid', 'paid', 'reconciled', 'revised'],
      reconciled: [],
    }
    return transitions[status]
}

export function nextPolicyStatuses(status: PolicyStatus): PolicyStatus[] {
    const transitions: Record<PolicyStatus, PolicyStatus[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['under-review', 'awaiting-information', 'cancelled'],
      'under-review': ['awaiting-information', 'approved', 'declined', 'cancelled'],
      'awaiting-information': ['under-review', 'declined', 'cancelled'],
      approved: ['active', 'cancelled'],
      active: ['suspended', 'cancelled'],
      declined: [],
      cancelled: [],
      suspended: ['active', 'cancelled'],
    }
    return transitions[status]
}

export function caseClosureBlockers(funeralCase: FuneralCase): string[] {
    const blockers: string[] = []
    if (funeralCase.checklist.some((item) => !item.removedAt && !['completed', 'cancelled'].includes(item.status))) {
      blockers.push('Complete or cancel every active checklist item.')
    }
    if (funeralCase.stages.some((stage) => !['completed', 'cancelled'].includes(stage.status))) {
      blockers.push('Complete or cancel every operational stage, including close-out.')
    }
    if (funeralCase.documents.some((document) => document.status !== 'verified')) {
      blockers.push('Verify every tracked document.')
    }
    if (funeralCase.payments.some((payment) => !['reconciled', 'reversed'].includes(payment.status))) {
      blockers.push('Reconcile or reverse every payment entry.')
    }
    if (funeralCase.contributions.some((contribution) => !['reconciled', 'rejected', 'reversed'].includes(contribution.status))) {
      blockers.push('Reconcile, reject, or adjust every contribution entry.')
    }
    if (funeralCase.quotes.some((quote) => !['reconciled', 'rejected', 'revised'].includes(quote.status))) {
      blockers.push('Reconcile, reject, or revise every quotation.')
    }
    if (funeralCase.quotes.some((quote) => caseBalance(funeralCase, quote.currency) > 0)) {
      blockers.push('Resolve outstanding quotation balances before closure.')
    }
    return blockers
}
