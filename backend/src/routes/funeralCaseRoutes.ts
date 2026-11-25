import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAdminSession, requireSession } from '../middleware/session'
import { bridgeSyncCaseGroup } from '../whatsapp/bridgeClient'
import { createWhatsAppFuneralGroup, sendToCaseWhatsAppGroup } from '../services/whatsappGateway'
import { assignmentSchema, caseDocumentSchema, caseIdSchema, caseInputSchema, relativeSchema } from '../cases/validation'
import { dispatchWorkflowNotifications } from '../services/multiChannelNotifier'

function reference(): string {
  return `FLA-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
}

type StoredCaseDocument = {
  id: string
  type: 'BURIAL_ORDER' | 'POLICE_CLEARANCE'
  fileName: string
  status: 'RECEIVED' | 'VERIFIED'
  uploadedAt: string
  dataUrl?: string
}

type StoredTrackingEvent = {
  id: string
  label: string
  detail: string
  status: 'completed' | 'in_progress' | 'pending'
  at: string | null
}

const inMemoryCaseDocuments = new Map<string, StoredCaseDocument[]>()
const inMemoryTrackingEvents = new Map<string, StoredTrackingEvent[]>()

function buildDefaultTrackingEvents(item: {
  id: string
  status: string
  createdAt: Date
  assignedStaff?: unknown
  funeralAt?: Date | null
  whatsappGroup?: { status: string } | null
}, docs: StoredCaseDocument[]): StoredTrackingEvent[] {
  const custom = inMemoryTrackingEvents.get(item.id) ?? []
  const hasBurialOrder = docs.some((d) => d.type === 'BURIAL_ORDER')
  const hasPoliceClearance = docs.some((d) => d.type === 'POLICE_CLEARANCE')
  const isAssigned = Boolean(item.assignedStaff) || item.status === 'ASSIGNED' || item.status === 'COMPLETED'
  const isCompleted = item.status === 'COMPLETED' || item.status === 'CLOSED'
  const events: StoredTrackingEvent[] = [
    {
      id: `${item.id}-evt-1`,
      label: 'Funeral case submitted',
      detail: 'Your case has been registered with Fidelity Operations.',
      status: 'completed',
      at: item.createdAt.toISOString(),
    },
    {
      id: `${item.id}-evt-2`,
      label: 'Fidelity coordinator assigned',
      detail: isAssigned ? 'A Fidelity staff coordinator is actively managing this case.' : 'Awaiting Fidelity staff coordinator assignment.',
      status: isAssigned ? 'completed' : 'in_progress',
      at: isAssigned ? new Date().toISOString() : null,
    },
    {
      id: `${item.id}-evt-3`,
      label: 'Burial order & police clearance',
      detail: hasBurialOrder && hasPoliceClearance
        ? 'Both Burial Order and Police Clearance have been uploaded.'
        : hasBurialOrder || hasPoliceClearance
          ? 'One document uploaded. Please upload the remaining clearance document.'
          : 'Upload Burial Order and Police Clearance to proceed.',
      status: hasBurialOrder && hasPoliceClearance ? 'completed' : 'in_progress',
      at: docs[0]?.uploadedAt ?? null,
    },
    {
      id: `${item.id}-evt-4`,
      label: 'WhatsApp coordination group',
      detail: item.whatsappGroup?.status === 'ACTIVE' ? 'Private WhatsApp coordination group is active.' : 'WhatsApp group setup pending.',
      status: item.whatsappGroup?.status === 'ACTIVE' ? 'completed' : 'pending',
      at: item.whatsappGroup?.status === 'ACTIVE' ? item.createdAt.toISOString() : null,
    },
    {
      id: `${item.id}-evt-5`,
      label: 'Service preparation & burial',
      detail: item.funeralAt ? `Scheduled for ${item.funeralAt.toLocaleDateString('en-GB')}` : 'Preparation and logistics underway.',
      status: isCompleted ? 'completed' : isAssigned ? 'in_progress' : 'pending',
      at: isCompleted ? new Date().toISOString() : null,
    },
    {
      id: `${item.id}-evt-6`,
      label: 'Case completed',
      detail: isCompleted ? 'All funeral services and documentation completed.' : 'Will be marked complete once burial and settlement finish.',
      status: isCompleted ? 'completed' : 'pending',
      at: isCompleted ? new Date().toISOString() : null,
    },
  ]
  return [...events, ...custom]
}

function asPublicCase(item: {
  id: string
  reference: string
  caseType: string
  status: string
  reporterName: string
  contactPhone: string
  deceasedName: string | null
  dateOfDeath: Date | null
  serviceLocation: string | null
  funeralAt: Date | null
  funeralLocation: string | null
  requestedPlan: string | null
  applicationChannel: string | null
  applicationLocation: string | null
  requestedServices: string[]
  policyNumber: string | null
  coverageReviewStatus: string
  createdAt: Date
  assignedStaff?: { id: string; phoneNumber: string | null; adminProfile: { firstName: string; lastName: string } | null } | null
  whatsappGroup?: { status: string; error: string | null; participants: { displayName: string; phoneNumber: string; relationship: string | null; participantType: string; addedAt: Date | null; removedAt: Date | null }[] } | null
}) {
  return {
    id: item.id,
    reference: item.reference,
    caseType: item.caseType,
    status: item.status,
    reporterName: item.reporterName,
    contactPhone: item.contactPhone,
    deceasedName: item.deceasedName,
    dateOfDeath: item.dateOfDeath?.toISOString().slice(0, 10) ?? null,
    serviceLocation: item.serviceLocation,
    funeralAt: item.funeralAt?.toISOString() ?? null,
    funeralLocation: item.funeralLocation,
    requestedPlan: item.requestedPlan,
    applicationChannel: item.applicationChannel,
    applicationLocation: item.applicationLocation,
    requestedServices: item.requestedServices,
    policyNumber: item.policyNumber,
    coverageReviewStatus: item.coverageReviewStatus,
    createdAt: item.createdAt.toISOString(),
    assignedStaff: item.assignedStaff ? {
      id: item.assignedStaff.id,
      name: `${item.assignedStaff.adminProfile?.firstName ?? ''} ${item.assignedStaff.adminProfile?.lastName ?? ''}`.trim(),
      phoneNumber: item.assignedStaff.phoneNumber,
    } : null,
    documents: (inMemoryCaseDocuments.get(item.id) ?? []).map(({ id, type, fileName, status, uploadedAt }) => ({ id, type, fileName, status, uploadedAt })),
    trackingEvents: buildDefaultTrackingEvents(item, inMemoryCaseDocuments.get(item.id) ?? []),
    whatsappGroup: item.whatsappGroup ? {
      status: item.whatsappGroup.status,
      error: item.whatsappGroup.error,
      participants: item.whatsappGroup.participants.filter((participant) => !participant.removedAt).map((participant) => ({
        name: participant.displayName,
        phoneNumber: participant.phoneNumber,
        role: participant.participantType,
        added: Boolean(participant.addedAt),
        relationship: participant.relationship,
      })),
    } : null,
  }
}

async function syncWhatsAppGroup(caseId: string): Promise<void> {
  const result = await bridgeSyncCaseGroup(caseId)
  if (result.ok) return
  const message = typeof result.data === 'object' && result.data !== null && 'error' in result.data
    ? String((result.data as { error: unknown }).error)
    : 'The WhatsApp gateway did not complete group synchronization.'
  await prisma.whatsAppCaseGroup.updateMany({
    where: { caseId, status: 'PENDING' },
    data: { status: 'FAILED', error: message.slice(0, 500) },
  })
}

const inMemoryStaff = [
  { id: 'staff-nomsa', name: 'Nomsa Ndlovu', jobTitle: 'Head of Funeral Operations', phoneNumber: '+263773000333' },
  { id: 'staff-tariro', name: 'Tariro Chikwanha', jobTitle: 'Senior Case Lead', phoneNumber: '+263790499962' },
  { id: 'staff-farai', name: 'Farai Gumbo', jobTitle: 'Mortuary & Logistics Lead', phoneNumber: '+263772555666' },
  { id: 'staff-blessing', name: 'Blessing Moyo', jobTitle: 'Transport & Fleet', phoneNumber: '+263771888999' },
  { id: 'staff-chipo', name: 'Chipo Dube', jobTitle: 'Chapel & Ceremonies', phoneNumber: '+263773000222' },
]

const inMemoryFuneralCases: any[] = [
  {
    id: 'fc-nyathi-001',
    reference: 'FLA-CASE-2025-091',
    caseType: 'POLICY_COVERED',
    status: 'ACTIVE_PREPARATION',
    reporterName: 'Sipho Moyo',
    contactPhone: '+263772123456',
    deceasedName: 'Grace Nyathi',
    dateOfDeath: new Date('2025-09-03'),
    serviceLocation: 'Brethren in Christ Church, Bulawayo',
    funeralAt: new Date('2025-09-10T10:00:00.000Z'),
    funeralLocation: 'West Park Cemetery, Bulawayo',
    requestedPlan: 'Executive Plan',
    applicationChannel: 'PORTAL',
    applicationLocation: 'Bulawayo',
    requestedServices: ['Hearse Transport', 'Casket Lowering Gear', 'Family Bus', 'Wreath Placement'],
    policyNumber: 'FLA-318227',
    coverageReviewStatus: 'VERIFIED',
    createdAt: new Date('2025-09-04T08:00:00.000Z'),
    assignedStaff: {
      id: 'staff-1',
      phoneNumber: '+263790499962',
      adminProfile: { firstName: 'Tariro', lastName: 'Chikwanha' },
    },
    whatsappGroup: {
      status: 'ACTIVE',
      error: null,
      participants: [
        { displayName: 'Sipho Moyo', phoneNumber: '+263772123456', participantType: 'REPORTER', addedAt: new Date(), removedAt: null, relationship: 'Son' },
        { displayName: 'Tariro Chikwanha', phoneNumber: '+263790499962', participantType: 'FUNERAL_DIRECTOR', addedAt: new Date(), removedAt: null, relationship: 'Coordinator' },
      ],
    },
  },
]
export function createFuneralCaseRouter(): Router {
  const router = Router()

  router.get('/me/funeral-cases', requireSession, async (req, res) => {
    try {
      const cases = await prisma.funeralCase.findMany({
        where: { reporterUserId: req.sessionUser!.userId },
        include: { assignedStaff: { select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true } } } }, whatsappGroup: { include: { participants: true } } },
        orderBy: { createdAt: 'desc' },
      })
      if (cases && cases.length) {
        res.json(cases.map(asPublicCase))
        return
      }
    } catch (dbErr) {
      // In-memory fallback
    }
    res.json(inMemoryFuneralCases.map(asPublicCase))
  })

  router.post('/me/funeral-cases', requireSession, async (req, res, next) => {
    try {
      const contactPhone = req.sessionUser?.phoneNumber || (typeof req.body?.contactPhone === 'string' && req.body.contactPhone.trim()) || '+263772000111'
      const parsed = caseInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: parsed.error.issues[0]?.message ?? 'Check the case details.' })
        return
      }
      const input = parsed.data
      const cleanPolicyNumber = input.policyNumber?.trim().toUpperCase() || undefined
      const initialDocs: StoredCaseDocument[] = (input.documents ?? []).map((doc) => ({
        id: randomUUID(),
        type: doc.type,
        fileName: doc.fileName,
        status: 'RECEIVED',
        uploadedAt: new Date().toISOString(),
        dataUrl: doc.dataUrl,
      }))
      const id = randomUUID()
      const caseReference = reference()
      const now = new Date()

      try {
        let policy: { policyNumber: string; status: 'ACTIVE' | 'GRACE' | 'LAPSED' } | null = null
        let member: { id: string } | null = null
        if (input.caseType === 'POLICY_COVERED' && cleanPolicyNumber) {
          policy = await prisma.policyRecord.findUnique({
            where: { policyNumber: cleanPolicyNumber },
            select: { policyNumber: true, status: true },
          })
          member = policy && input.deceasedName
            ? await prisma.policyCoveredMember.findFirst({
                where: { policyNumber: policy.policyNumber, name: { equals: input.deceasedName.trim(), mode: 'insensitive' } },
                select: { id: true },
              })
            : null
        }
        const profile = await prisma.customerProfile.findUnique({
          where: { userId: req.sessionUser!.userId },
          select: { firstName: true, lastName: true },
        })
        const reporterName = `${profile?.firstName ?? input.reporterName} ${profile?.lastName ?? ''}`.trim()
        const coverageReviewStatus = input.caseType === 'POLICY_COVERED'
          ? (policy && member ? policy.status : 'PENDING')
          : 'NOT_APPLICABLE'
        const item = await prisma.$transaction(async (transaction) => {
          const created = await transaction.funeralCase.create({
            data: {
              id,
              reference: caseReference,
              caseType: input.caseType,
              status: input.caseType === 'POLICY_COVERED' ? 'UNDER_REVIEW' : 'NEW',
              reporterUserId: req.sessionUser!.userId,
              reporterName,
              contactPhone,
              deceasedName: input.deceasedName?.trim(),
              dateOfDeath: input.dateOfDeath ? new Date(`${input.dateOfDeath}T00:00:00.000Z`) : undefined,
              serviceLocation: input.serviceLocation?.trim(),
              funeralAt: input.funeralAt ? new Date(input.funeralAt) : undefined,
              funeralLocation: input.funeralLocation?.trim(),
              requestedPlan: input.requestedPlan?.trim(),
              applicationChannel: input.applicationChannel,
              applicationLocation: input.applicationLocation?.trim(),
              requestedServices: input.requestedServices,
              policyNumber: policy?.policyNumber ?? cleanPolicyNumber,
              coverageReviewStatus,
              whatsappConsentAt: input.whatsappConsent ? now : null,
              whatsappGroup: {
                create: {
                  id: randomUUID(),
                  status: input.whatsappConsent ? 'PENDING' : 'NOT_REQUESTED',
                  groupName: `FLA ${caseReference}`,
                },
              },
            },
            include: { whatsappGroup: true },
          })
          if (input.whatsappConsent && created.whatsappGroup) {
            await transaction.whatsAppCaseParticipant.create({
              data: {
                id: randomUUID(),
                caseId: created.id,
                groupId: created.whatsappGroup.id,
                phoneNumber: contactPhone,
                displayName: reporterName,
                participantType: 'REPORTER',
                consentAt: now,
              },
            })
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: req.sessionUser!.userId,
              entityType: 'funeral_case',
              entityId: created.id,
              actionType: 'CREATE',
              detailsJson: { reference: created.reference, caseType: created.caseType, whatsappConsent: input.whatsappConsent },
            },
          })
          return created
        })

        void createWhatsAppFuneralGroup({
          caseReference: item.reference,
          deceasedName: item.deceasedName || undefined,
          customerName: item.reporterName,
          familyPhone: item.contactPhone,
        })

        if (input.whatsappConsent) await syncWhatsAppGroup(item.id)
        const updated = await prisma.funeralCase.findUniqueOrThrow({
          where: { id: item.id },
          include: { whatsappGroup: { include: { participants: true } } },
        })
        if (initialDocs.length) inMemoryCaseDocuments.set(item.id, initialDocs)
        res.status(201).json(asPublicCase(updated))
        return
      } catch (_dbErr) {
        const reporterName = input.reporterName.trim() || 'Fidelity Customer'
        const memoryItem = {
          id,
          reference: caseReference,
          caseType: input.caseType,
          status: input.caseType === 'POLICY_COVERED' ? 'UNDER_REVIEW' : 'NEW',
          reporterName,
          contactPhone,
          deceasedName: input.deceasedName?.trim() ?? null,
          dateOfDeath: input.dateOfDeath ? new Date(`${input.dateOfDeath}T00:00:00.000Z`) : null,
          serviceLocation: input.serviceLocation?.trim() ?? null,
          funeralAt: input.funeralAt ? new Date(input.funeralAt) : null,
          funeralLocation: input.funeralLocation?.trim() ?? null,
          requestedPlan: input.requestedPlan?.trim() ?? null,
          applicationChannel: input.applicationChannel ?? null,
          applicationLocation: input.applicationLocation?.trim() ?? null,
          requestedServices: input.requestedServices,
          policyNumber: cleanPolicyNumber ?? null,
          coverageReviewStatus: input.caseType === 'POLICY_COVERED' ? 'PENDING' : 'NOT_APPLICABLE',
          createdAt: now,
          assignedStaff: null,
          whatsappGroup: {
            status: input.whatsappConsent ? 'ACTIVE' : 'NOT_REQUESTED',
            error: null,
            participants: input.whatsappConsent
              ? [{ displayName: reporterName, phoneNumber: contactPhone, participantType: 'REPORTER', addedAt: now, removedAt: null, relationship: null }]
              : [],
          },
        }
        if (initialDocs.length) inMemoryCaseDocuments.set(memoryItem.id, initialDocs)
        inMemoryFuneralCases.unshift(memoryItem)

        void createWhatsAppFuneralGroup({
          caseReference: memoryItem.reference,
          deceasedName: memoryItem.deceasedName || undefined,
          customerName: memoryItem.reporterName,
          familyPhone: memoryItem.contactPhone,
        })

        res.status(201).json(asPublicCase(memoryItem))
      }
    } catch (error) {
      next(error)
    }
  })

  router.post('/me/funeral-cases/:caseId/documents', requireSession, async (req, res, next) => {
    try {
      const parsed = caseDocumentSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: parsed.error.issues[0]?.message ?? 'Provide a valid document file.' })
        return
      }
      const caseId = String(req.params.caseId)
      const existing = inMemoryCaseDocuments.get(caseId) ?? []
      const nextDoc: StoredCaseDocument = {
        id: randomUUID(),
        type: parsed.data.type,
        fileName: parsed.data.fileName,
        status: 'RECEIVED',
        uploadedAt: new Date().toISOString(),
        dataUrl: parsed.data.dataUrl,
      }
      const filtered = existing.filter((doc) => doc.type !== parsed.data.type)
      inMemoryCaseDocuments.set(caseId, [...filtered, nextDoc])

      const memCase = inMemoryFuneralCases.find((item) => item.id === caseId)
      if (memCase) {
        void sendToCaseWhatsAppGroup({
          caseReference: memCase.reference,
          familyPhone: memCase.contactPhone,
          message: `📄 Document uploaded for ${memCase.deceasedName || memCase.reference}: ${parsed.data.type === 'BURIAL_ORDER' ? 'Burial Order' : 'Police Clearance'} (${parsed.data.fileName})`,
        }).catch(() => {})
      }

      res.status(201).json({
        id: nextDoc.id,
        type: nextDoc.type,
        fileName: nextDoc.fileName,
        status: nextDoc.status,
        uploadedAt: nextDoc.uploadedAt,
      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/me/funeral-cases/:caseId/participants', requireSession, async (req, res, next) => {
    try {
      if (req.sessionUser!.role !== 'CUSTOMER' || !req.sessionUser!.phoneNumber) {
        res.status(403).json({ code: 'forbidden', message: 'Customer access is required.' })
        return
      }
      const input = relativeSchema.safeParse(req.body)
      if (!input.success) {
        res.status(422).json({ code: 'validation_failed', message: input.error.issues[0]?.message ?? 'Check the invite details.' })
        return
      }
      const caseId = caseIdSchema.safeParse(req.params.caseId)
      if (!caseId.success) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      const funeralCase = await prisma.funeralCase.findFirst({
        where: { id: caseId.data, reporterUserId: req.sessionUser!.userId },
        include: { whatsappGroup: true },
      })
      if (!funeralCase) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      if (!funeralCase.whatsappConsentAt || funeralCase.whatsappGroup?.status === 'NOT_REQUESTED') {
        res.status(409).json({ code: 'reporter_consent_required', message: 'The case reporter must first consent to WhatsApp coordination before relatives can be invited.' })
        return
      }
      if (input.data.phoneNumber === funeralCase.contactPhone) {
        res.status(422).json({ code: 'duplicate_participant', message: 'The reporter is already a group participant.' })
        return
      }
      const now = new Date()
      await prisma.$transaction(async (transaction) => {
        await transaction.funeralCase.update({
          where: { id: funeralCase.id },
          data: { updatedAt: now },
        })
        await transaction.whatsAppCaseParticipant.upsert({
          where: { caseId_phoneNumber: { caseId: funeralCase.id, phoneNumber: funeralCase.contactPhone } },
          create: {
            id: randomUUID(),
            caseId: funeralCase.id,
            groupId: funeralCase.whatsappGroup?.id,
            phoneNumber: funeralCase.contactPhone,
            displayName: funeralCase.reporterName,
            participantType: 'REPORTER',
            consentAt: now,
          },
          update: { participantType: 'REPORTER', consentAt: now, addedAt: null },
        })
        await transaction.whatsAppCaseParticipant.upsert({
          where: { caseId_phoneNumber: { caseId: funeralCase.id, phoneNumber: input.data.phoneNumber } },
          create: {
            id: randomUUID(),
            caseId: funeralCase.id,
            groupId: funeralCase.whatsappGroup?.id,
            phoneNumber: input.data.phoneNumber,
            displayName: input.data.name,
            relationship: input.data.relationship,
            participantType: 'RELATIVE',
            consentAt: now,
            addedByUserId: req.sessionUser!.userId,
          },
          update: {
            displayName: input.data.name,
            participantType: 'RELATIVE',
            consentAt: now,
            addedAt: null,
            removedAt: null,
            addedByUserId: req.sessionUser!.userId,
          },
        })
        await transaction.auditLog.create({
          data: {
            actorUserId: req.sessionUser!.userId,
            entityType: 'funeral_case',
            entityId: funeralCase.id,
            actionType: 'UPDATE',
            detailsJson: { action: 'whatsapp_relative_invited', relationship: input.data.relationship, consentConfirmed: true },
          },
        })
      })
      await syncWhatsAppGroup(funeralCase.id)
      const group = await prisma.whatsAppCaseGroup.findUnique({ where: { caseId: funeralCase.id } })
      res.status(201).json({ status: group?.status ?? 'PENDING' })
    } catch (error) {
      next(error)
    }
  })

  router.get('/admin/funeral-cases', requireAdminSession, async (_req, res) => {
    try {
      const cases = await prisma.funeralCase.findMany({
        include: {
          assignedStaff: { select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true } } } },
          whatsappGroup: { include: { participants: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      if (cases && cases.length) {
        res.json(cases.map(asPublicCase))
        return
      }
    } catch (_dbErr) {
      // In-memory fallback
    }
    res.json(inMemoryFuneralCases.map(asPublicCase))
  })

  router.get('/admin/funeral-cases/staff', requireAdminSession, async (_req, res) => {
    try {
      const staff = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true, jobTitle: true } } },
        orderBy: { createdAt: 'asc' },
      })
      if (staff && staff.length) {
        res.json(staff.map((item) => ({
          id: item.id,
          name: `${item.adminProfile?.firstName ?? ''} ${item.adminProfile?.lastName ?? ''}`.trim(),
          jobTitle: item.adminProfile?.jobTitle,
          phoneNumber: item.phoneNumber,
        })))
        return
      }
    } catch (_dbErr) {
      // In-memory staff fallback
    }
    res.json(inMemoryStaff)
  })

  router.post('/admin/funeral-cases/:caseId/assign', requireAdminSession, async (req, res, next) => {
    try {
      const staffUserId = typeof req.body?.staffUserId === 'string' ? req.body.staffUserId.trim() : ''
      if (!staffUserId) {
        res.status(422).json({ code: 'validation_failed', message: 'Choose an active Fidelity staff member. People assigned must be Fidelity Staff members only.' })
        return
      }
      const memStaff = inMemoryStaff.find((s) => s.id === staffUserId)
      const memCase = inMemoryFuneralCases.find((item) => item.id === req.params.caseId)
      if (memCase) {
        if (!memStaff) {
          res.status(422).json({ code: 'invalid_staff', message: 'That Fidelity staff account is not active. People assigned must be Fidelity Staff members only.' })
          return
        }
        const [firstName, ...rest] = memStaff.name.split(' ')
        memCase.assignedStaff = {
          id: memStaff.id,
          phoneNumber: memStaff.phoneNumber,
          adminProfile: { firstName, lastName: rest.join(' ') },
        }
        memCase.status = 'ASSIGNED'
        void dispatchWorkflowNotifications({
          event: 'case_assigned',
          caseReference: memCase.reference,
          deceasedName: memCase.deceasedName || undefined,
          customer: { name: memCase.reporterName, phone: memCase.contactPhone },
          assignedStaff: { name: memStaff.name, phone: memStaff.phoneNumber },
        })
        res.json(asPublicCase(memCase))
        return
      }

      const parsed = assignmentSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Choose an active Fidelity staff member. People assigned must be Fidelity Staff members only.' })
        return
      }
      const staff = await prisma.user.findFirst({
        where: { id: parsed.data.staffUserId, role: 'ADMIN', isActive: true },
        include: { adminProfile: true },
      })
      if (!staff) {
        res.status(422).json({ code: 'invalid_staff', message: 'That Fidelity staff account is not active. People assigned must be Fidelity Staff members only.' })
        return
      }
      const caseId = caseIdSchema.safeParse(req.params.caseId)
      if (!caseId.success) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      const funeralCase = await prisma.funeralCase.findUnique({
        where: { id: caseId.data },
        include: { whatsappGroup: true },
      })
      if (!funeralCase) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      await prisma.$transaction(async (transaction) => {
        await transaction.funeralCase.update({
          where: { id: funeralCase.id },
          data: { assignedStaffUserId: staff.id, status: 'ASSIGNED' },
        })
        if (funeralCase.whatsappConsentAt && staff.phoneNumber && staff.phoneNumber !== funeralCase.contactPhone) {
          await transaction.whatsAppCaseParticipant.updateMany({
            where: {
              caseId: funeralCase.id,
              participantType: 'STAFF',
              phoneNumber: { not: staff.phoneNumber },
              removedAt: null,
            },
            data: { removedAt: new Date() },
          })
          await transaction.whatsAppCaseParticipant.upsert({
            where: { caseId_phoneNumber: { caseId: funeralCase.id, phoneNumber: staff.phoneNumber } },
            create: {
              id: randomUUID(),
              caseId: funeralCase.id,
              groupId: funeralCase.whatsappGroup?.id,
              phoneNumber: staff.phoneNumber,
              displayName: `${staff.adminProfile?.firstName ?? ''} ${staff.adminProfile?.lastName ?? ''}`.trim() || 'Fidelity Coordinator',
              participantType: 'STAFF',
              consentAt: new Date(),
            },
            update: {
              displayName: `${staff.adminProfile?.firstName ?? ''} ${staff.adminProfile?.lastName ?? ''}`.trim() || 'Fidelity Coordinator',
              participantType: 'STAFF',
              removedAt: null,
              addedAt: null,
            },
          })
        }
        await transaction.auditLog.create({
          data: {
            actorUserId: req.sessionUser!.userId,
            entityType: 'funeral_case',
            entityId: funeralCase.id,
            actionType: 'UPDATE',
            detailsJson: { action: 'assign_staff', assignedStaffUserId: staff.id },
          },
        })
      })
      if (funeralCase.whatsappConsentAt) await syncWhatsAppGroup(funeralCase.id)
      const updated = await prisma.funeralCase.findUniqueOrThrow({
        where: { id: funeralCase.id },
        include: {
          assignedStaff: { select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true } } } },
          whatsappGroup: { include: { participants: true } },
        },
      })
      const staffName = `${staff.adminProfile?.firstName ?? ''} ${staff.adminProfile?.lastName ?? ''}`.trim() || 'Fidelity Coordinator'
      void dispatchWorkflowNotifications({
        event: 'case_assigned',
        caseReference: updated.reference,
        deceasedName: updated.deceasedName || undefined,
        customer: { name: updated.reporterName, phone: updated.contactPhone },
        assignedStaff: { name: staffName, phone: staff.phoneNumber || undefined },
      })
      res.json(asPublicCase(updated))
    } catch (error) {
      next(error)
    }
  })

  router.post('/admin/funeral-cases/:caseId/whatsapp/retry', requireAdminSession, async (req, res, next) => {
    try {
      const caseId = caseIdSchema.safeParse(req.params.caseId)
      if (!caseId.success) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      const item = await prisma.funeralCase.findUnique({ where: { id: caseId.data }, select: { id: true, whatsappConsentAt: true } })
      if (!item) {
        res.status(404).json({ code: 'not_found', message: 'Funeral case not found.' })
        return
      }
      if (!item.whatsappConsentAt) {
        res.status(409).json({ code: 'consent_required', message: 'The reporter has not consented to WhatsApp group coordination.' })
        return
      }
      await syncWhatsAppGroup(item.id)
      const group = await prisma.whatsAppCaseGroup.findUnique({ where: { caseId: item.id } })
      res.json({ status: group?.status ?? 'PENDING', error: group?.error ?? null })
    } catch (error) {
      next(error)
    }
  })

  return router
}
