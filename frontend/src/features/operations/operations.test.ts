import { describe, expect, it } from 'vitest'
import {
  canActivatePolicy,
  caseBalance,
  caseClosureBlockers,
  contributionTotal,
  createDefaultTokenCharges,
  EXHUMATION_REQUIREMENTS,
  makeReference,
  nextContributionStatuses,
  nextPaymentStatuses,
  nextPolicyStatuses,
  nextQuoteStatuses,
  quoteTotal,
  type FuneralCase,
  type PolicyApplication,
} from './data'
import { createInitialOperationsState, isOperationsState, migrateLegacyOperationsState } from './store'
import { createOnlineFuneralCase, createOnlinePolicyApplication } from './intake'

const policy: PolicyApplication = {
  id: 'policy-1',
  reference: 'DEMO-POL-0001',
  customerName: 'Sample Customer',
  phone: '+263770000000',
  product: 'Sample product',
  coveredMembers: [],
  status: 'approved',
  checks: { identityVerified: true, documentsVerified: true, eligibilityConfirmed: true },
  responsibleStaff: 'Demo administrator',
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  demo: true,
}

const funeralCase: FuneralCase = {
  id: 'case-1',
  reference: 'CASE-CASH-0001',
  type: 'cash-walk-in',
  customerName: 'Sample',
  phone: '+263770000000',
  deceasedName: 'Sample Deceased',
  dateOfDeath: '2026-01-01',
  serviceLocation: 'Sample',
  branch: 'Sample',
  funeralLocation: 'Sample',
  coordinator: 'Sample',
  priority: 'standard',
  priorityReason: '',
  status: 'in-progress',
  postMortem: 'pending',
  stages: [],
  checklist: [],
  documents: [],
  movements: [],
  quotes: [
    { id: 'quote-1', reference: 'QUOTE-0001', status: 'accepted', lines: [{ id: 'line-1', description: 'Item', amount: 100 }], currency: 'USD', createdAt: '', notes: '' },
    { id: 'quote-2', reference: 'QUOTE-0002', status: 'draft', lines: [{ id: 'line-2', description: 'Draft item', amount: 50 }], currency: 'USD', createdAt: '', notes: '' },
  ],
  payments: [
    { id: 'payment-1', amount: 25, currency: 'USD', channel: 'Cash', reference: '', status: 'confirmed', receivedAt: '', receivedBy: '', notes: '' },
    { id: 'payment-2', amount: 10, currency: 'USD', channel: 'Cash', reference: '', status: 'reversed', receivedAt: '', receivedBy: '', notes: '' },
  ],
  contributions: [
    { id: 'contribution-1', consentToContact: false, amount: 20, currency: 'USD', channel: 'Cash', reference: '', status: 'confirmed', contributedAt: '', recordedBy: '', confirmedBy: '', notes: '' },
    { id: 'adjustment-1', consentToContact: false, amount: 5, currency: 'USD', channel: 'Adjustment', reference: '', status: 'confirmed', contributedAt: '', recordedBy: '', confirmedBy: '', notes: '', adjustmentOf: 'contribution-1' },
  ],
  createdAt: '',
  updatedAt: '',
  demo: true,
}

describe('operations workflow helpers', () => {
  it('only allows activation after approval and all required checks', () => {
    expect(canActivatePolicy(policy)).toBe(true)
    expect(canActivatePolicy({ ...policy, status: 'under-review' })).toBe(false)
    expect(canActivatePolicy({ ...policy, checks: { ...policy.checks, eligibilityConfirmed: false } })).toBe(false)
  })

  it('generates the next reference without reusing a deleted-looking sequence', () => {
    expect(makeReference('CASE-CASH', ['CASE-CASH-0001', 'CASE-CASH-0004'])).toBe('CASE-CASH-0005')
    expect(makeReference('POLICY', [])).toBe('POLICY-0001')
  })

  it('calculates only non-draft quote balances and ignores reversed payments', () => {
    expect(quoteTotal(funeralCase.quotes[0])).toBe(100)
    expect(caseBalance(funeralCase, 'USD')).toBe(75)
    expect(caseBalance(funeralCase, 'ZWL')).toBe(0)
  })

  it('subtracts linked adjustments from confirmed contribution totals', () => {
    expect(contributionTotal(funeralCase.contributions, 'USD', ['confirmed'])).toBe(15)
    expect(contributionTotal(funeralCase.contributions, 'USD', ['pending-confirmation'])).toBe(0)
  })

  it('keeps financial workflows on explicit status transitions', () => {
    expect(nextContributionStatuses('recorded')).toContain('pending-confirmation')
    expect(nextContributionStatuses('recorded')).not.toContain('reconciled')
    expect(nextContributionStatuses('confirmed')).toEqual(['reconciled', 'needs-review'])
    expect(nextPaymentStatuses('confirmed')).toEqual(['reconciled'])
    expect(nextQuoteStatuses('issued')).toContain('accepted')
    expect(nextQuoteStatuses('reconciled')).toEqual([])
    expect(nextPolicyStatuses('draft')).toEqual(['submitted', 'cancelled'])
    expect(nextPolicyStatuses('approved')).toEqual(['active', 'cancelled'])
    expect(nextPolicyStatuses('active')).not.toContain('declined')
  })

  it('subtracts a linked payment reversal without deleting the original record', () => {
    const reversed: FuneralCase = {
      ...funeralCase,
      payments: [
        { id: 'payment-original', amount: 25, currency: 'USD', channel: 'Cash', reference: 'PAY-1', status: 'confirmed', receivedAt: '', receivedBy: '', notes: '' },
        { id: 'payment-reversal', amount: 25, currency: 'USD', channel: 'Manual reversal', reference: 'REV-1', status: 'reversed', receivedAt: '', receivedBy: '', notes: 'Correction', reversalOf: 'payment-original' },
      ],
    }
    expect(caseBalance(reversed, 'USD')).toBe(100)
  })

  it('does not count unconfirmed payment records against an outstanding balance', () => {
    const pending: FuneralCase = {
      ...funeralCase,
      payments: [
        { id: 'payment-pending', amount: 25, currency: 'USD', channel: 'Cash', reference: 'PAY-1', status: 'recorded', receivedAt: '', receivedBy: '', notes: '' },
      ],
    }
    expect(caseBalance(pending, 'USD')).toBe(100)
  })

  it('requires operational and financial close-out before case closure', () => {
    expect(caseClosureBlockers({
      ...funeralCase,
      stages: [{ id: 'stage-open', label: 'Case close-out', status: 'pending', assignedTo: '', notes: '', blocker: '' }],
    })).toContain('Complete or cancel every operational stage, including close-out.')
    const readyToClose: FuneralCase = {
      ...funeralCase,
      checklist: [],
      stages: [{ id: 'close', label: 'Case closed', status: 'completed', assignedTo: '', notes: '', blocker: '' }],
      documents: [{ id: 'doc', type: 'Clearance', status: 'verified', receivedBy: 'Admin', verifiedBy: 'Admin', notes: '' }],
      quotes: [{ id: 'quote-done', reference: 'QUOTE-1', status: 'reconciled', lines: [{ id: 'line', description: 'Service', amount: 10 }], currency: 'USD', createdAt: '', notes: '' }],
      payments: [{ id: 'payment-done', amount: 10, currency: 'USD', channel: 'Manual', reference: '', status: 'reconciled', receivedAt: '', receivedBy: 'Admin', notes: '' }],
      contributions: [],
    }
    expect(caseClosureBlockers(readyToClose)).toEqual([])
  })

  it('seeds and validates a clearly versioned operations workspace', () => {
    expect(isOperationsState(createInitialOperationsState('2026-01-01T00:00:00.000Z'))).toBe(true)
    expect(isOperationsState({ version: 1, policies: [], cases: [], catalogue: [], audit: [] })).toBe(false)
    expect(isOperationsState({ version: 2, policies: [], cases: [], catalogue: [], audit: [] })).toBe(false)
    expect(createInitialOperationsState().exhumations[0].requirements).toHaveLength(EXHUMATION_REQUIREMENTS.length)
  })

  it('migrates existing local operations data without discarding its records', () => {
    const previous = createInitialOperationsState()
    const migrated = migrateLegacyOperationsState({
      version: 1,
      policies: previous.policies,
      cases: previous.cases,
      catalogue: previous.catalogue,
      audit: previous.audit,
    })
    expect(migrated.version).toBe(2)
    expect(migrated.cases).toEqual(previous.cases)
    expect(migrated.exhumations).toEqual([])
    expect(migrated.tokenCharges.every((charge) => !charge.enabled && charge.amount === undefined)).toBe(true)
    expect(isOperationsState(migrated)).toBe(true)
  })

  it('starts every Kuwana feature charge disabled and without an assumed price', () => {
    const charges = createDefaultTokenCharges()
    expect(charges.length).toBeGreaterThan(0)
    expect(charges.every((charge) => charge.enabled === false && charge.amount === undefined)).toBe(true)
  })

  it('creates an online policy funeral case with selected work for staff assignment', () => {
    const state = createInitialOperationsState('2026-01-01T00:00:00.000Z')
    const item = createOnlineFuneralCase({
      policyNumber: 'FLA-318227',
      reporterName: 'Sample Reporter',
      phone: '+263770000000',
      deceasedName: 'Rudo Ncube',
      dateOfDeath: '2026-01-01',
      serviceLocation: 'Harare',
      funeralAt: '',
      funeralLocation: '',
      services: ['Body removal / collection', 'Hearse / transport'],
    }, state, '2026-01-01T12:00:00.000Z')

    expect(item.type).toBe('policy-covered')
    expect(item.policyReference).toBe('FLA-318227')
    expect(item.intakeChannel).toBe('online')
    expect(item.status).toBe('intake')
    expect(item.checklist.map((entry) => entry.status)).toEqual(['requested', 'requested'])
    expect(item.stages.every((stage) => stage.assignedTo === '')).toBe(true)
  })

  it('does not claim cover for an unknown policy or submit a policy request without choices', () => {
    const state = createInitialOperationsState()
    expect(() => createOnlineFuneralCase({
      policyNumber: 'FLA-000000',
      reporterName: 'Sample Reporter',
      phone: '+263770000000',
      deceasedName: 'Sample Deceased',
      dateOfDeath: '2026-01-01',
      serviceLocation: 'Harare',
      funeralAt: '',
      funeralLocation: '',
      services: ['Hearse / transport'],
    }, state)).toThrow('We could not find that sample policy number.')
    expect(() => createOnlinePolicyApplication({
      customerName: 'Sample Applicant',
      phone: '+263770000000',
      members: ['Sample Member'],
      productId: 'essential',
      services: [],
      channel: 'online',
      location: '',
    }, state)).toThrow('Select at least one service')
  })

  it('stores online walk-in coverage choices for review, not as active cover', () => {
    const state = createInitialOperationsState()
    const application = createOnlinePolicyApplication({
      customerName: 'Sample Applicant',
      phone: '+263770000000',
      members: ['Sample Member'],
      productId: 'comfort',
      services: ['Tent and chairs'],
      channel: 'at-fidelity',
      location: 'Harare',
    }, state, '2026-01-01T12:00:00.000Z')

    expect(application.status).toBe('submitted')
    expect(application.applicationChannel).toBe('at-fidelity')
    expect(application.applicationLocation).toBe('Harare')
    expect(application.requestedServices).toEqual(['Tent and chairs'])
    expect(application.checks.eligibilityConfirmed).toBe(false)
  })
})
