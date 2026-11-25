import { z } from 'zod'
import { isValidPhone } from '../whatsapp/phone'

export const funeralServiceOptions = [
  'Body removal / collection',
  'Mortuary / overnight care',
  'Coffin / casket',
  'Hearse / transport',
  'Tent and chairs',
  'Burial setup and equipment',
] as const

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const caseDocumentSchema = z.object({
  type: z.enum(['BURIAL_ORDER', 'POLICE_CLEARANCE']),
  fileName: z.string().trim().min(1).max(240),
  dataUrl: z.string().max(5_000_000).optional(),
})

export const caseInputSchema = z.object({
  caseType: z.enum(['POLICY_COVERED', 'WALK_IN_COVERAGE']),
  reporterName: z.string().trim().min(2).max(120),
  deceasedName: z.string().trim().min(2).max(120).optional(),
  dateOfDeath: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, 'Enter a valid date of death.').optional(),
  serviceLocation: z.string().trim().max(200).optional(),
  funeralAt: z.string().datetime().optional().or(z.literal('')),
  funeralLocation: z.string().trim().max(200).optional(),
  policyNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9/-]{1,39}$/).optional().or(z.literal('')),
  contactPhone: z.string().trim().optional(),
  requestedPlan: z.string().trim().max(120).optional(),
  applicationChannel: z.enum(['online', 'at-fidelity']).optional(),
  applicationLocation: z.string().trim().max(200).optional(),
  requestedServices: z.array(z.enum(funeralServiceOptions)).min(1).max(funeralServiceOptions.length),
  whatsappConsent: z.boolean(),
  documents: z.array(caseDocumentSchema).max(4).optional(),
}).superRefine((value, context) => {
  if (value.caseType === 'POLICY_COVERED') {
    if (!value.deceasedName) context.addIssue({ code: 'custom', path: ['deceasedName'], message: 'Enter the deceased person’s name.' })
    if (!value.dateOfDeath) context.addIssue({ code: 'custom', path: ['dateOfDeath'], message: 'Enter the date of death.' })
    if (!value.serviceLocation) context.addIssue({ code: 'custom', path: ['serviceLocation'], message: 'Enter the service location.' })
  } else {
    if (!value.requestedPlan) context.addIssue({ code: 'custom', path: ['requestedPlan'], message: 'Choose a plan to discuss with Fidelity.' })
    if (!value.applicationChannel) context.addIssue({ code: 'custom', path: ['applicationChannel'], message: 'Choose to apply online or at a Fidelity office.' })
    if (value.applicationChannel === 'at-fidelity' && !value.applicationLocation) {
      context.addIssue({ code: 'custom', path: ['applicationLocation'], message: 'Choose the Fidelity office or area you will visit.' })
    }
  }
})

export const relativeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().refine(isValidPhone, 'Enter a complete WhatsApp number with country code.'),
  confirmsConsent: z.literal(true),
})

export const assignmentSchema = z.object({ staffUserId: z.string().uuid() })
export const caseIdSchema = z.string().uuid()
