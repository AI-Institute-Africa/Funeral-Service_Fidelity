import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAdminSession, requireSession } from '../middleware/session'
import { bridgeSyncCaseGroup } from '../whatsapp/bridgeClient'
import { assignmentSchema, caseIdSchema, caseInputSchema, relativeSchema } from '../cases/validation'

function reference(): string {
  return `FLA-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
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

export function createFuneralCaseRouter(): Router {
  const router = Router()

  router.get('/me/funeral-cases', requireSession, async (req, res, next) => {
    try {
      if (req.sessionUser!.role !== 'CUSTOMER') {
        res.status(403).json({ code: 'forbidden', message: 'Customer access is required.' })
        return
      }
      const cases = await prisma.funeralCase.findMany({
        where: { reporterUserId: req.sessionUser!.userId },
        include: { assignedStaff: { select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true } } } }, whatsappGroup: { include: { participants: true } } },
        orderBy: { createdAt: 'desc' },
      })
      res.json(cases.map(asPublicCase))
    } catch (error) {
      next(error)
    }
  })

  router.post('/me/funeral-cases', requireSession, async (req, res, next) => {
    try {
      if (req.sessionUser!.role !== 'CUSTOMER' || !req.sessionUser!.phoneNumber) {
        res.status(403).json({ code: 'forbidden', message: 'A customer account with a verified mobile number is required.' })
        return
      }
      const parsed = caseInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: parsed.error.issues[0]?.message ?? 'Check the case details.' })
        return
      }
      const input = parsed.data
      let policy: { policyNumber: string; status: 'ACTIVE' | 'GRACE' | 'LAPSED' } | null = null
      if (input.caseType === 'POLICY_COVERED') {
        policy = await prisma.policyRecord.findUnique({
          where: { policyNumber: input.policyNumber!.toUpperCase() },
          select: { policyNumber: true, status: true },
        })
        const member = policy
          ? await prisma.policyCoveredMember.findFirst({
              where: { policyNumber: policy.policyNumber, name: { equals: input.deceasedName!.trim(), mode: 'insensitive' } },
              select: { id: true },
            })
          : null
        if (!policy || !member) {
          res.status(422).json({ code: 'policy_coverage_not_verified', message: 'Fidelity could not verify this policy and covered person. Check the details or contact the Fidelity team; no policy information has been disclosed.' })
          return
        }
      }
      const profile = await prisma.customerProfile.findUnique({
        where: { userId: req.sessionUser!.userId },
        select: { firstName: true, lastName: true },
      })
      const reporterName = `${profile?.firstName ?? input.reporterName} ${profile?.lastName ?? ''}`.trim()
      const id = randomUUID()
      const caseReference = reference()
      const now = new Date()
      const coverageReviewStatus = policy?.status ?? 'NOT_APPLICABLE'
      const item = await prisma.$transaction(async (transaction) => {
        const created = await transaction.funeralCase.create({
          data: {
            id,
            reference: caseReference,
            caseType: input.caseType,
            status: input.caseType === 'POLICY_COVERED' ? 'UNDER_REVIEW' : 'NEW',
            reporterUserId: req.sessionUser!.userId,
            reporterName,
            contactPhone: req.sessionUser!.phoneNumber!,
            deceasedName: input.deceasedName?.trim(),
            dateOfDeath: input.dateOfDeath ? new Date(`${input.dateOfDeath}T00:00:00.000Z`) : undefined,
            serviceLocation: input.serviceLocation?.trim(),
            funeralAt: input.funeralAt ? new Date(input.funeralAt) : undefined,
            funeralLocation: input.funeralLocation?.trim(),
            requestedPlan: input.requestedPlan?.trim(),
            applicationChannel: input.applicationChannel,
            applicationLocation: input.applicationLocation?.trim(),
            requestedServices: input.requestedServices,
            policyNumber: policy?.policyNumber,
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
              phoneNumber: req.sessionUser!.phoneNumber!,
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

      if (input.whatsappConsent) await syncWhatsAppGroup(item.id)
      const updated = await prisma.funeralCase.findUniqueOrThrow({
        where: { id: item.id },
        include: { whatsappGroup: { include: { participants: true } } },
      })
      res.status(201).json(asPublicCase(updated))
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

  router.get('/admin/funeral-cases', requireAdminSession, async (_req, res, next) => {
    try {
      const cases = await prisma.funeralCase.findMany({
        include: {
          assignedStaff: { select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true } } } },
          whatsappGroup: { include: { participants: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      res.json(cases.map(asPublicCase))
    } catch (error) {
      next(error)
    }
  })

  router.get('/admin/funeral-cases/staff', requireAdminSession, async (_req, res, next) => {
    try {
      const staff = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, phoneNumber: true, adminProfile: { select: { firstName: true, lastName: true, jobTitle: true } } },
        orderBy: { createdAt: 'asc' },
      })
      res.json(staff.map((item) => ({
        id: item.id,
        name: `${item.adminProfile?.firstName ?? ''} ${item.adminProfile?.lastName ?? ''}`.trim(),
        jobTitle: item.adminProfile?.jobTitle,
        phoneNumber: item.phoneNumber,
      })))
    } catch (error) {
      next(error)
    }
  })

  router.post('/admin/funeral-cases/:caseId/assign', requireAdminSession, async (req, res, next) => {
    try {
      const parsed = assignmentSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Choose an active Fidelity staff account.' })
        return
      }
      const staff = await prisma.user.findFirst({
        where: { id: parsed.data.staffUserId, role: 'ADMIN', isActive: true },
        include: { adminProfile: true },
      })
      if (!staff) {
        res.status(422).json({ code: 'invalid_staff', message: 'That Fidelity staff account is not active.' })
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
              displayName: `${staff.adminProfile?.firstName ?? ''} ${staff.adminProfile?.lastName ?? ''}`.trim() || 'Fidelity staff',
              participantType: 'STAFF',
            },
            update: { participantType: 'STAFF', addedAt: null, removedAt: null },
          })
        }
        await transaction.auditLog.create({
          data: {
            actorUserId: req.sessionUser!.userId,
            entityType: 'funeral_case',
            entityId: funeralCase.id,
            actionType: 'ASSIGN',
            detailsJson: { assignedStaffUserId: staff.id },
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
