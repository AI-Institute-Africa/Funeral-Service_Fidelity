import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { caseInputSchema, relativeSchema } from './validation'

const policyCase = {
  caseType: 'POLICY_COVERED',
  reporterName: 'Tendai Moyo',
  deceasedName: 'Rudo Moyo',
  dateOfDeath: '2026-11-20',
  serviceLocation: 'Harare',
  policyNumber: 'FLA-123456',
  requestedServices: ['Hearse / transport'],
  whatsappConsent: true,
}

describe('funeral case intake validation', () => {
  it('accepts a policy case and rejects malformed dates and unknown services', () => {
    assert.equal(caseInputSchema.safeParse(policyCase).success, true)
    assert.equal(caseInputSchema.safeParse({ ...policyCase, dateOfDeath: '2026-02-31' }).success, false)
    assert.equal(caseInputSchema.safeParse({ ...policyCase, requestedServices: ['Unknown service'] }).success, false)
  })

  it('requires a plan, application route, and office for in-person applications', () => {
    assert.equal(caseInputSchema.safeParse({
      caseType: 'WALK_IN_COVERAGE',
      reporterName: 'Tendai Moyo',
      requestedPlan: 'Family plan',
      applicationChannel: 'online',
      requestedServices: ['Coffin / casket'],
      whatsappConsent: false,
    }).success, true)
    assert.equal(caseInputSchema.safeParse({
      caseType: 'WALK_IN_COVERAGE',
      reporterName: 'Tendai Moyo',
      requestedPlan: 'Family plan',
      applicationChannel: 'at-fidelity',
      requestedServices: ['Coffin / casket'],
      whatsappConsent: false,
    }).success, false)
  })
})

describe('consent-gated WhatsApp participants', () => {
  it('requires an explicit consent affirmation and a valid international phone number', () => {
    const invited = { name: 'Rudo Moyo', relationship: 'Daughter', phoneNumber: '+263771234567', confirmsConsent: true }
    assert.equal(relativeSchema.safeParse(invited).success, true)
    assert.equal(relativeSchema.safeParse({ ...invited, confirmsConsent: false }).success, false)
    assert.equal(relativeSchema.safeParse({ ...invited, phoneNumber: '0771234567' }).success, false)
  })
})
