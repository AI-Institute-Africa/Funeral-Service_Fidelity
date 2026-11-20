import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAdminSession, requireSession } from '../middleware/session'
import { parsePolicyWorkbook, type ImportedPolicy, type PolicyImportLayout } from '../policies/importWorkbook'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const PREVIEW_TTL_MS = 30 * 60_000
const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2 },
})

function handleWorkbookUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('workbook')(req, res, (error) => {
    if (!error) {
      next()
      return
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE'
      res.status(tooLarge ? 413 : 422).json({
        code: tooLarge ? 'workbook_too_large' : 'invalid_upload',
        message: tooLarge ? 'Workbook files must be 8 MB or smaller.' : 'Upload one .xlsx workbook using the workbook field.',
      })
      return
    }
    next(error)
  })
}

const layoutSchema = z.enum(['policy-per-row', 'member-per-row'])

function safeFileName(fileName: string): string {
  return fileName.replace(/[^\w.-]/g, '_').slice(-120) || 'policies.xlsx'
}

function serializePolicy(policy: {
  policyNumber: string
  holderName: string
  phoneNumber: string
  status: string
  planName: string
  coverAmount: Prisma.Decimal
  monthlyPremium: Prisma.Decimal
  startDate: Date
  monthsPaid: number
  waitingPeriodMonths: number
  members: { name: string; relationship: string; share: Prisma.Decimal | null }[]
}) {
  return {
    number: policy.policyNumber,
    holderName: policy.holderName,
    phoneNumber: policy.phoneNumber,
    status: policy.status.toLowerCase(),
    planName: policy.planName,
    coverAmount: policy.coverAmount.toNumber(),
    monthlyPremium: policy.monthlyPremium.toNumber(),
    startDate: policy.startDate.toISOString().slice(0, 10),
    monthsPaid: policy.monthsPaid,
    waitingPeriodMonths: policy.waitingPeriodMonths,
    beneficiaries: policy.members.map((member) => ({
      name: member.name,
      relationship: member.relationship,
      ...(member.share ? { share: member.share.toNumber() } : {}),
    })),
  }
}

async function applyBatch(batchId: string, userId: string) {
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.policyImportBatch.findUnique({ where: { id: batchId } })
    if (!batch || batch.uploadedByUserId !== userId) return { error: 'not-found' as const }
    if (batch.status !== 'PREVIEW' || batch.expiresAt <= new Date()) return { error: 'expired' as const }
    const staged = batch.payload as unknown as { policies: ImportedPolicy[]; existingPolicyNumbers: string[] }
    const policies = staged.policies
    const policyNumbers = policies.map((item) => item.policyNumber)
    const existing = await transaction.policyRecord.findMany({
      where: { policyNumber: { in: policyNumbers } },
      select: { policyNumber: true },
    })
    const actualExisting = new Set(existing.map((item) => item.policyNumber))
    const expectedExisting = new Set(staged.existingPolicyNumbers)
    if (
      policies.length !== batch.policiesAdded + batch.policiesUpdated ||
      actualExisting.size !== expectedExisting.size ||
      [...actualExisting].some((number) => !expectedExisting.has(number))
    ) {
      return { error: 'changed' as const }
    }
    const claimed = await transaction.policyImportBatch.updateMany({
      where: { id: batch.id, status: 'PREVIEW', expiresAt: { gt: new Date() } },
      data: { status: 'PROCESSING' },
    })
    if (claimed.count !== 1) return { error: 'expired' as const }

    for (const policy of policies) {
      await transaction.policyRecord.upsert({
        where: { policyNumber: policy.policyNumber },
        create: {
          policyNumber: policy.policyNumber,
          holderName: policy.holderName,
          phoneNumber: policy.phoneNumber,
          status: policy.status,
          planName: policy.planName,
          coverAmount: policy.coverAmount,
          monthlyPremium: policy.monthlyPremium,
          startDate: new Date(`${policy.startDate}T00:00:00.000Z`),
          monthsPaid: policy.monthsPaid,
          waitingPeriodMonths: policy.waitingPeriodMonths,
          sourceBatchId: batch.id,
        },
        update: {
          holderName: policy.holderName,
          phoneNumber: policy.phoneNumber,
          status: policy.status,
          planName: policy.planName,
          coverAmount: policy.coverAmount,
          monthlyPremium: policy.monthlyPremium,
          startDate: new Date(`${policy.startDate}T00:00:00.000Z`),
          monthsPaid: policy.monthsPaid,
          waitingPeriodMonths: policy.waitingPeriodMonths,
          sourceBatchId: batch.id,
        },
      })
      await transaction.policyCoveredMember.deleteMany({ where: { policyNumber: policy.policyNumber } })
      if (policy.members.length) {
        await transaction.policyCoveredMember.createMany({
          data: policy.members.map((member) => ({
            policyNumber: policy.policyNumber,
            name: member.name,
            relationship: member.relationship,
            share: member.share,
          })),
        })
      }
    }

    await transaction.policyImportBatch.update({
      where: { id: batch.id },
      data: { status: 'COMMITTED', committedAt: new Date(), payload: Prisma.JsonNull },
    })
    await transaction.auditLog.create({
      data: {
        actorUserId: userId,
        entityType: 'policy_import_batch',
        entityId: batch.id,
        actionType: 'CREATE',
        detailsJson: {
          fileName: batch.fileName,
          rowsRead: batch.rowsRead,
          policiesAdded: batch.policiesAdded,
          policiesUpdated: batch.policiesUpdated,
        },
      },
    })
    return { policiesAdded: batch.policiesAdded, policiesUpdated: batch.policiesUpdated }
  }, { maxWait: 10_000, timeout: 120_000 })
}

export function createPolicyRouter(): Router {
  const router = Router()

  router.get('/me/policies/:number', requireSession, async (req, res, next) => {
    try {
      if (req.sessionUser!.role !== 'CUSTOMER' || !req.sessionUser!.phoneNumber) {
        res.status(404).json({ code: 'policy_not_found', message: 'No policy matched that number and account.' })
        return
      }
      const number = typeof req.params.number === 'string' ? req.params.number.trim().toUpperCase() : ''
      if (!number) {
        res.status(404).json({ code: 'policy_not_found', message: 'No policy matched that number and account.' })
        return
      }
      const policy = await prisma.policyRecord.findUnique({
        where: { policyNumber: number },
        include: { members: { orderBy: { name: 'asc' } } },
      })
      if (!policy || policy.phoneNumber.replace(/\D/g, '') !== req.sessionUser!.phoneNumber.replace(/\D/g, '')) {
        res.status(404).json({ code: 'policy_not_found', message: 'No policy matched that number and account.' })
        return
      }
      res.json(serializePolicy(policy))
    } catch (error) {
      next(error)
    }
  })

  router.post(
    '/admin/policies/import/preview',
    requireAdminSession,
    handleWorkbookUpload,
    async (req, res, next) => {
      try {
        const layout = layoutSchema.safeParse(req.body.layout)
        const file = req.file
        if (!layout.success) {
          res.status(422).json({ code: 'validation_failed', message: 'Choose a supported workbook layout.' })
          return
        }
        if (!file || !file.originalname.toLowerCase().endsWith('.xlsx') || file.mimetype !== xlsxMime) {
          res.status(422).json({ code: 'invalid_workbook', message: 'Upload a valid .xlsx workbook.' })
          return
        }
        let preview
        try {
          preview = await parsePolicyWorkbook(file.buffer, layout.data as PolicyImportLayout)
        } catch (error) {
          console.warn('[policies/import] Workbook parse failed:', error instanceof Error ? error.message : String(error))
          res.status(422).json({ code: 'invalid_workbook', message: 'The workbook could not be read. Use the supplied Excel template.' })
          return
        }
        if (preview.issues.length) {
          res.status(422).json({ code: 'import_validation_failed', message: 'Fix the workbook issues and upload it again.', rowsRead: preview.rowsRead, issues: preview.issues })
          return
        }
        if (!preview.policies.length) {
          res.status(422).json({ code: 'empty_workbook', message: 'The workbook contains no policy records.' })
          return
        }
        await prisma.policyImportBatch.deleteMany({
          where: { status: 'PREVIEW', expiresAt: { lt: new Date() } },
        })
        const numbers = preview.policies.map((item) => item.policyNumber)
        const existing = await prisma.policyRecord.findMany({
          where: { policyNumber: { in: numbers } },
          select: { policyNumber: true },
        })
        const existingNumbers = new Set(existing.map((item) => item.policyNumber))
        const policiesAdded = numbers.filter((number) => !existingNumbers.has(number)).length
        const policiesUpdated = numbers.length - policiesAdded
        const batch = await prisma.policyImportBatch.create({
          data: {
            id: randomUUID(),
            uploadedByUserId: req.sessionUser!.userId,
            fileName: safeFileName(file.originalname),
            layout: layout.data,
            rowsRead: preview.rowsRead,
            policiesAdded,
            policiesUpdated,
            payload: {
              policies: preview.policies,
              existingPolicyNumbers: [...existingNumbers],
            } as unknown as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
          },
        })
        res.status(201).json({
          batchId: batch.id,
          fileName: batch.fileName,
          layout: batch.layout,
          rowsRead: batch.rowsRead,
          policiesAdded,
          policiesUpdated,
          expiresAt: batch.expiresAt.toISOString(),
          preview: preview.policies.slice(0, 20).map((policy) => ({
            policyNumber: policy.policyNumber,
            holderName: policy.holderName,
            planName: policy.planName,
            status: policy.status,
            coveredMembers: policy.members.length,
            action: existingNumbers.has(policy.policyNumber) ? 'update' : 'add',
          })),
        })
      } catch (error) {
        next(error)
      }
    },
  )

  router.get('/admin/policies/import/template', requireAdminSession, async (req, res, next) => {
    try {
      const layout = layoutSchema.safeParse(req.query.layout)
      if (!layout.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Choose a supported workbook layout.' })
        return
      }
      const workbook = new (await import('exceljs')).default.Workbook()
      const sheet = workbook.addWorksheet('Policies')
      if (layout.data === 'policy-per-row') {
        sheet.addRow([
          'policy_number', 'holder_name', 'phone_number', 'status', 'plan_name', 'cover_amount',
          'monthly_premium', 'start_date', 'months_paid', 'waiting_period_months', 'covered_members',
        ])
        sheet.addRow([
          'FLA-123456', 'Sample Policyholder', '+263771234567', 'ACTIVE', 'Sample family plan', 7800,
          14, '2025-01-15', 12, 6, 'Sample Member|Child|100',
        ])
      } else {
        sheet.addRow([
          'policy_number', 'holder_name', 'phone_number', 'status', 'plan_name', 'cover_amount',
          'monthly_premium', 'start_date', 'months_paid', 'waiting_period_months', 'member_name',
          'member_relationship', 'member_share',
        ])
        sheet.addRow([
          'FLA-123456', 'Sample Policyholder', '+263771234567', 'ACTIVE', 'Sample family plan', 7800,
          14, '2025-01-15', 12, 6, 'Sample Member', 'Child', 100,
        ])
      }
      sheet.getRow(1).font = { bold: true }
      const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="fidelity-policy-template-${layout.data}.xlsx"`)
      res.send(bytes)
    } catch (error) {
      next(error)
    }
  })

  router.post('/admin/policies/import/:batchId/commit', requireAdminSession, async (req, res, next) => {
    try {
      const batchId = z.string().uuid().safeParse(req.params.batchId)
      if (!batchId.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Invalid import preview reference.' })
        return
      }
      const result = await applyBatch(batchId.data, req.sessionUser!.userId)
      if (result.error === 'not-found') {
        res.status(404).json({ code: 'not_found', message: 'That import preview does not exist.' })
        return
      }
      if (result.error === 'expired') {
        res.status(409).json({ code: 'preview_expired', message: 'The import preview expired. Upload the workbook again.' })
        return
      }
      if (result.error === 'changed') {
        res.status(409).json({ code: 'preview_stale', message: 'Policy records changed since the preview. Upload the workbook again.' })
        return
      }
      res.json({ success: true, ...result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
