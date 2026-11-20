import { findPolicyByNumber, type Policy } from '@/features/account'
import { plans } from '@/features/plans'
import {
  createCaseStages,
  makeReference,
  type FuneralCase,
  type OperationsState,
  type PolicyApplication,
} from './data'

export const FUNERAL_SERVICE_OPTIONS = [
  { name: 'Body removal / collection', category: 'Collection' },
  { name: 'Mortuary / overnight care', category: 'Mortuary' },
  { name: 'Coffin / casket', category: 'Equipment' },
  { name: 'Hearse / transport', category: 'Transport' },
  { name: 'Tent and chairs', category: 'Equipment' },
  { name: 'Burial setup and equipment', category: 'Burial' },
] as const

export type OnlineCaseInput = {
  policyNumber: string
  reporterName: string
  phone: string
  deceasedName: string
  dateOfDeath: string
  serviceLocation: string
  funeralAt: string
  funeralLocation: string
  services: string[]
}

export type OnlinePolicyInput = {
  customerName: string
  phone: string
  members: string[]
  productId: string
  services: string[]
  channel: 'online' | 'at-fidelity'
  location: string
}

const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`

export function lookupOnlinePolicy(policyNumber: string): Policy | undefined {
  return findPolicyByNumber(policyNumber.trim())
}

export function createOnlineFuneralCase(
  input: OnlineCaseInput,
  state: OperationsState,
  now = new Date().toISOString(),
): FuneralCase {
  const policy = lookupOnlinePolicy(input.policyNumber)
  if (!policy) throw new Error('We could not find that sample policy number. Check it or contact Fidelity for help.')
  if (!policy.beneficiaries.some((member) => member.name === input.deceasedName)) {
    throw new Error('Choose the person shown in the policy record, or contact Fidelity to check their cover.')
  }
  if (input.services.length === 0) throw new Error('Select at least one service you need help with.')

  const reference = makeReference('CASE-POLICY', state.cases.map((item) => item.reference))
  return {
    id: createId('case'),
    reference,
    type: 'policy-covered',
    customerName: input.reporterName.trim(),
    phone: input.phone.trim(),
    deceasedName: input.deceasedName,
    dateOfDeath: input.dateOfDeath,
    serviceLocation: input.serviceLocation.trim(),
    branch: input.serviceLocation.trim(),
    funeralAt: input.funeralAt || undefined,
    funeralLocation: input.funeralLocation.trim(),
    coordinator: '',
    priority: 'standard',
    priorityReason: '',
    status: 'intake',
    policyReference: policy.number,
    intakeChannel: 'online',
    postMortem: 'pending',
    stages: createCaseStages(),
    checklist: input.services.map((name) => {
      const option = FUNERAL_SERVICE_OPTIONS.find((service) => service.name === name)
      if (!option) throw new Error('One of the selected service options is no longer available. Refresh and try again.')
      return {
        id: createId('checklist'),
        name: option.name,
        category: option.category,
        quantity: 1,
        status: 'requested',
        assignedTo: '',
        notes: '',
        createdAt: now,
      }
    }),
    documents: [],
    movements: [],
    quotes: [],
    payments: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
    demo: true,
  }
}

export function createOnlinePolicyApplication(
  input: OnlinePolicyInput,
  state: OperationsState,
  now = new Date().toISOString(),
): PolicyApplication {
  const plan = plans.find((item) => item.id === input.productId)
  if (!plan) throw new Error('Choose one of the available sample plans.')
  if (input.services.length === 0) throw new Error('Select at least one service you would like to discuss.')
  if (input.channel === 'at-fidelity' && !input.location) throw new Error('Choose the Fidelity branch or area you would like to visit.')

  return {
    id: createId('policy'),
    reference: makeReference('DEMO-POL', state.policies.map((item) => item.reference)),
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    product: plan.name,
    coveredMembers: input.members.map((member) => member.trim()).filter(Boolean),
    requestedServices: [...input.services],
    applicationChannel: input.channel,
    applicationLocation: input.location,
    status: 'submitted',
    checks: { identityVerified: false, documentsVerified: false, eligibilityConfirmed: false },
    responsibleStaff: 'Fidelity Life team (assignment pending)',
    notes: 'Online sample intake. Requested services and plan are preferences for Fidelity Life review; no cover is active.',
    createdAt: now,
    updatedAt: now,
    demo: true,
  }
}
