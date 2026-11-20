import {
  createDefaultTokenCharges,
  createCaseStages,
  EXHUMATION_REQUIREMENTS,
  type FuneralCase,
  type ExhumationCase,
  type OperationsState,
  type PolicyApplication,
} from './data'

export const OPERATIONS_STORAGE_KEY = 'fidelity.operations.demo.v1'

const plusDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function createInitialOperationsState(now = new Date().toISOString()): OperationsState {
  const sampleStages = createCaseStages()
  sampleStages[0] = { ...sampleStages[0], status: 'completed', actualAt: now, assignedTo: 'Demo coordinator' }
  sampleStages[1] = {
    ...sampleStages[1],
    status: 'in-progress',
    plannedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    assignedTo: 'Demo operations team',
  }
  sampleStages[2] = { ...sampleStages[2], status: 'pending', assignedTo: 'Demo transport team' }

  const sampleCase: FuneralCase = {
    id: 'demo-case-0001',
    reference: 'CASE-CASH-0001',
    type: 'cash-walk-in',
    customerName: 'Tariro Demo',
    phone: '+263770000101',
    deceasedName: 'Kundai Demo',
    dateOfDeath: plusDays(-1),
    serviceLocation: 'Harare (sample)',
    branch: 'Harare (sample)',
    funeralAt: plusDays(2),
    funeralLocation: 'Borrowdale (sample)',
    coordinator: 'Demo operations team',
    priority: 'urgent',
    priorityReason: 'Sample case for workflow demonstration',
    status: 'in-progress',
    postMortem: 'pending',
    stages: sampleStages,
    checklist: [
      {
        id: 'demo-item-1',
        name: 'Hearse / transport',
        category: 'Transport',
        quantity: 1,
        status: 'assigned',
        assignedTo: 'Demo transport team',
        notes: '',
        createdAt: now,
      },
      {
        id: 'demo-item-2',
        name: 'Tent and seating',
        category: 'Equipment',
        quantity: 1,
        status: 'requested',
        assignedTo: '',
        notes: 'Sample request',
        createdAt: now,
      },
    ],
    documents: [{ id: 'demo-document-1', type: 'Police clearance', status: 'missing', receivedBy: '', verifiedBy: '', notes: '' }],
    movements: [],
    quotes: [],
    payments: [],
    contributions: [
      {
        id: 'demo-contribution-1',
        contributorName: 'Sample contributor',
        consentToContact: false,
        amount: 25,
        currency: 'USD',
        channel: 'Other (sample)',
        reference: 'SAMPLE-REF-001',
        status: 'pending-confirmation',
        contributedAt: now,
        recordedBy: 'Demo administrator',
        confirmedBy: '',
        notes: 'Simulated contribution; not a payment.',
      },
    ],
    createdAt: now,
    updatedAt: now,
    demo: true,
  }

  const samplePolicy: PolicyApplication = {
    id: 'demo-policy-0001',
    reference: 'DEMO-POL-0001',
    customerName: 'Rutendo Sample',
    phone: '+263770000102',
    product: 'Sample plan (not a real product)',
    coveredMembers: ['Sample member'],
    status: 'under-review',
    checks: { identityVerified: false, documentsVerified: false, eligibilityConfirmed: false },
    responsibleStaff: 'Demo policy team',
    notes: 'Synthetic application for demonstration only. No eligibility rules or premium requirements are configured.',
    createdAt: now,
    updatedAt: now,
    demo: true,
  }

  const sampleExhumation: ExhumationCase = {
    id: 'demo-exhumation-0001',
    reference: 'EXH-0001',
    customerName: 'Demo Applicant',
    phone: '+263770000103',
    deceasedName: 'Sample Relative',
    address: 'Sample cemetery and grave address',
    destinationAddress: 'Sample reinterment address',
    currency: 'USD',
    requestedAt: plusDays(14),
    status: 'awaiting-documents',
    permitReference: '',
    permitStatus: 'pending',
    requirements: EXHUMATION_REQUIREMENTS.map((name, index) => ({
      id: `demo-exhumation-requirement-${index + 1}`,
      name,
      status: 'pending',
      notes: '',
    })),
    notes: 'Synthetic record for demonstration only. Confirm all requirements with the relevant authorities.',
    createdAt: now,
    updatedAt: now,
    demo: true,
  }

  return {
    version: 2,
    policies: [samplePolicy],
    cases: [sampleCase],
    catalogue: [
      { id: 'demo-service-1', name: 'Body removal', category: 'Collection', description: 'Sample catalogue item', active: true, createdAt: now },
      { id: 'demo-service-2', name: 'Mortuary / overnight', category: 'Mortuary', description: 'Sample catalogue item', active: true, createdAt: now },
      { id: 'demo-service-3', name: 'Coffin / casket', category: 'Equipment', description: 'Sample catalogue item', active: true, createdAt: now },
      { id: 'demo-service-4', name: 'Hearse / transport', category: 'Transport', description: 'Sample catalogue item', active: true, createdAt: now },
      { id: 'demo-service-5', name: 'Tent and chairs', category: 'Equipment', description: 'Sample catalogue item', active: true, createdAt: now },
    ],
    exhumations: [sampleExhumation],
    tokenCharges: createDefaultTokenCharges(),
    audit: [
      {
        id: 'demo-audit-1',
        at: now,
        actor: 'Demo administrator',
        action: 'Seeded sample workspace',
        entity: 'Operations workspace',
        summary: 'Synthetic records loaded. Data is stored in this browser only.',
        demo: true,
      },
    ],
  }
}

export function loadOperationsState(): OperationsState {
  if (typeof window === 'undefined') return createInitialOperationsState()
  const serialized = window.localStorage.getItem(OPERATIONS_STORAGE_KEY)
  if (!serialized) return createInitialOperationsState()

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new Error('Saved demo operations data could not be read. Clear this site’s local storage to restart the sample workspace.', {
      cause: error,
    })
  }
  if (isLegacyOperationsState(parsed)) {
    return migrateLegacyOperationsState(parsed)
  }
  if (!isOperationsState(parsed)) {
    throw new Error('Saved demo operations data has an unsupported format. Export it before clearing this site’s local storage.')
  }
  return parsed
}

export function saveOperationsState(state: OperationsState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(state))
}

export function migrateLegacyOperationsState(
  state: Omit<OperationsState, 'version' | 'exhumations' | 'tokenCharges'> & { version: 1 },
): OperationsState {
  return {
    ...state,
    version: 2,
    exhumations: [],
    tokenCharges: createDefaultTokenCharges(),
  }
}

export function isOperationsState(value: unknown): value is OperationsState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OperationsState>
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.policies) &&
    Array.isArray(candidate.cases) &&
    Array.isArray(candidate.catalogue) &&
    Array.isArray(candidate.audit) &&
    Array.isArray(candidate.exhumations) &&
    Array.isArray(candidate.tokenCharges)
  )
}

function isLegacyOperationsState(value: unknown): value is Omit<OperationsState, 'version' | 'exhumations' | 'tokenCharges'> & { version: 1 } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { version?: unknown; policies?: unknown; cases?: unknown; catalogue?: unknown; audit?: unknown }
  return candidate.version === 1 &&
    Array.isArray(candidate.policies) &&
    Array.isArray(candidate.cases) &&
    Array.isArray(candidate.catalogue) &&
    Array.isArray(candidate.audit)
}
