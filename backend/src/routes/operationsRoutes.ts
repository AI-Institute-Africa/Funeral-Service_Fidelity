import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { listFallbackUsers, findFallbackUserById } from '../lib/fallbackUsers'
import {
  listStoredOrders,
  listStoredRequests,
  loadPersistedOpsState,
  savePersistedOpsState,
  saveStoredOrders,
  saveStoredRequests,
  type StoredOrder,
  type StoredRequest,
} from '../lib/fallbackPortalStore'
import { requireAdminSession } from '../middleware/session'
import { createWhatsAppFuneralGroup, notifyDual, sendWhatsAppAlert } from '../services/whatsappGateway'
import { dispatchWorkflowNotifications, KNOWN_STAFF } from '../services/multiChannelNotifier'
import { createSmsProvider } from '../alerts/providers/sms'

const STAGE_TEMPLATES = [
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

const EXHUMATION_REQUIREMENTS = [
  'Applicant identity and proof of relationship',
  'Original burial record or grave location confirmation',
  'Written consent from the landowner / cemetery authority',
  'Exhumation permit from the relevant authority',
  'Destination burial or reinterment arrangements',
]

const TOKEN_FEATURES = [
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

function createCaseStages(): Array<{
  id: string
  label: string
  status: string
  assignedTo: string
  notes: string
  blocker: string
  actualAt?: string
  plannedAt?: string
  completedAt?: string
}> {
  return STAGE_TEMPLATES.map((label, index) => ({
    id: `stage-${index + 1}`,
    label,
    status: 'not-started',
    assignedTo: '',
    notes: '',
    blocker: '',
  }))
}

const plusDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function seedInitialOperationsData(): Promise<void> {
  const caseCount = await prisma.operationCase.count()
  if (caseCount > 0) return

  const now = new Date().toISOString()
  const sampleStages = createCaseStages()
  sampleStages[0] = { ...sampleStages[0], status: 'completed', actualAt: now, assignedTo: 'Operations coordinator' }
  sampleStages[1] = {
    ...sampleStages[1],
    status: 'in-progress',
    plannedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    assignedTo: 'Operations team',
  }
  sampleStages[2] = { ...sampleStages[2], status: 'pending', assignedTo: 'Transport team' }

  await prisma.operationCase.create({
    data: {
      id: 'case-demo-0001',
      reference: 'CASE-CASH-0001',
      caseType: 'cash-walk-in',
      customerName: 'Tariro Demo',
      phone: '+263770000101',
      deceasedName: 'Kundai Demo',
      dateOfDeath: plusDays(-1),
      serviceLocation: 'Harare (sample)',
      branch: 'Harare',
      funeralAt: plusDays(2),
      funeralLocation: 'Borrowdale (sample)',
      coordinator: 'Operations team',
      priority: 'urgent',
      priorityReason: 'Sample case for workflow demonstration',
      status: 'in-progress',
      postMortem: 'pending',
      stages: sampleStages,
      checklist: [
        {
          id: 'item-demo-1',
          name: 'Hearse / transport',
          category: 'Transport',
          quantity: 1,
          status: 'assigned',
          assignedTo: 'Transport team',
          notes: '',
          createdAt: now,
        },
        {
          id: 'item-demo-2',
          name: 'Tent and seating',
          category: 'Equipment',
          quantity: 1,
          status: 'requested',
          assignedTo: '',
          notes: 'Sample request',
          createdAt: now,
        },
      ],
      documents: [{ id: 'doc-demo-1', type: 'Police clearance', status: 'missing', receivedBy: '', verifiedBy: '', notes: '' }],
      movements: [
        {
          id: 'mov-demo-1',
          leg: 'Collection to Mortuary',
          pickup: 'Harare Hospital',
          destination: 'Fidelity Mortuary',
          vehicle: 'FLA Hearse 01 (ABZ-4122)',
          driver: 'T. Moyo',
          status: 'in-progress',
          plannedAt: now,
          notes: 'Standard collection',
        },
      ],
      quotes: [
        {
          id: 'quote-demo-1',
          reference: 'Q-0001',
          status: 'accepted',
          lines: [
            { id: 'ql-1', description: 'Standard Hearse & Transport', amount: 350 },
            { id: 'ql-2', description: 'Tent (100-seater) and 100 Chairs', amount: 200 },
          ],
          currency: 'USD',
          createdAt: now,
          acceptedAt: now,
          notes: 'Agreed with family representative',
        },
      ],
      payments: [
        {
          id: 'pay-demo-1',
          amount: 250,
          currency: 'USD',
          channel: 'Cash',
          reference: 'REC-00192',
          status: 'confirmed',
          receivedAt: now,
          receivedBy: 'Fidelity Cashier',
          notes: 'Initial deposit paid at intake',
        },
      ],
      contributions: [
        {
          id: 'contrib-demo-1',
          contributorName: 'Farai Demo',
          contributorContact: '+263772111222',
          consentToContact: true,
          amount: 50,
          currency: 'USD',
          channel: 'EcoCash',
          reference: 'MP261120.1001.H12345',
          status: 'confirmed',
          contributedAt: now,
          recordedBy: 'Admin',
          confirmedBy: 'Admin',
          notes: 'Family contribution',
        },
      ],
      walletGoal: { amount: 600, currency: 'USD' },
      demo: true,
    },
  })

  await prisma.operationPolicy.create({
    data: {
      id: 'pol-demo-0001',
      reference: 'POL-APP-0001',
      customerName: 'Rutendo Sample',
      phone: '+263770000102',
      product: 'Fidelity Executive Funeral Plan',
      coveredMembers: ['Rutendo Sample (Self)', 'Tendai Sample (Spouse)'],
      status: 'under-review',
      checks: { identityVerified: true, documentsVerified: false, eligibilityConfirmed: false },
      responsibleStaff: 'Policy Team',
      notes: 'Customer submitted national ID copy; awaiting proof of residence.',
      demo: true,
    },
  })

  const catalogueDefaults = [
    { id: 'cat-1', name: 'Body removal & collection', category: 'Collection', description: 'Collection from hospital or residence', active: true },
    { id: 'cat-2', name: 'Mortuary / overnight storage', category: 'Mortuary', description: 'Cold storage facility per day', active: true },
    { id: 'cat-3', name: 'Coffin / casket selection', category: 'Equipment', description: 'Wood veneer or solid wood casket', active: true },
    { id: 'cat-4', name: 'Hearse / procession transport', category: 'Transport', description: 'Standard or executive hearse vehicle', active: true },
    { id: 'cat-5', name: 'Tent (100 seater) & chairs', category: 'Equipment', description: 'Complete outdoor setup for memorial', active: true },
    { id: 'cat-6', name: 'Mobile restrooms', category: 'Equipment', description: 'Sanitation unit for gravesite or home', active: true },
    { id: 'cat-7', name: 'Burial programmes & printing', category: 'Stationery', description: 'Printed service order brochures', active: true },
    { id: 'cat-8', name: 'Floral tributes & wreaths', category: 'Flowers', description: 'Fresh floral arrangements for casket and grave', active: true },
  ]
  for (const item of catalogueDefaults) {
    await prisma.operationCatalogueItem.create({ data: item })
  }

  await prisma.operationExhumation.create({
    data: {
      id: 'exh-demo-0001',
      reference: 'EXH-0001',
      customerName: 'Grace Munemo',
      phone: '+263774888999',
      deceasedName: 'Sekuru Munemo',
      address: 'Granville Cemetery, Plot 14-B',
      destinationAddress: 'Rural Homestead, Mutare',
      currency: 'USD',
      requestedAt: plusDays(21),
      status: 'awaiting-documents',
      permitReference: '',
      permitStatus: 'pending',
      requirements: EXHUMATION_REQUIREMENTS.map((name, index) => ({
        id: `exh-req-${index + 1}`,
        name,
        status: index === 0 ? 'verified' : 'pending',
        notes: index === 0 ? 'National ID and affidavit verified' : '',
      })),
      notes: 'Family wishes to re-inter deceased at ancestral rural grounds.',
      demo: true,
    },
  })

  for (const feature of TOKEN_FEATURES) {
    await prisma.operationTokenCharge.upsert({
      where: { feature: feature.feature },
      create: { feature: feature.feature, label: feature.label, enabled: false },
      update: {},
    })
  }

  await prisma.operationAuditEntry.create({
    data: {
      id: `audit-${randomUUID()}`,
      actor: 'System Admin',
      action: 'Seeded operations workspace',
      entity: 'Operations System',
      summary: 'Initial operational records and catalogue populated.',
      demo: true,
    },
  })
}

/**
 * Synchronize any intake cases submitted via /me/funeral-cases into OperationCase if not already present.
 */
async function syncCustomerCases(): Promise<void> {
  try {
    const rawCases = await prisma.funeralCase.findMany({
      include: { assignedStaff: { include: { adminProfile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    for (const raw of rawCases) {
      const existing = await prisma.operationCase.findUnique({ where: { reference: raw.reference } })
      if (!existing) {
        const stages = createCaseStages()
        if (raw.status === 'ASSIGNED' || raw.status === 'IN_PROGRESS') {
          stages[0] = { ...stages[0], status: 'completed', actualAt: raw.createdAt.toISOString() }
        }
        const assignedName = raw.assignedStaff?.adminProfile
          ? `${raw.assignedStaff.adminProfile.firstName} ${raw.assignedStaff.adminProfile.lastName}`.trim()
          : ''

        await prisma.operationCase.create({
          data: {
            id: raw.id,
            reference: raw.reference,
            caseType: raw.caseType === 'POLICY_COVERED' ? 'policy-covered' : 'cash-walk-in',
            customerName: raw.reporterName,
            phone: raw.contactPhone,
            deceasedName: raw.deceasedName || 'Not specified',
            dateOfDeath: raw.dateOfDeath?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10),
            serviceLocation: raw.serviceLocation || 'Harare',
            branch: 'Harare',
            funeralAt: raw.funeralAt?.toISOString() || null,
            funeralLocation: raw.funeralLocation || '',
            coordinator: assignedName,
            priority: 'standard',
            priorityReason: '',
            status: raw.status === 'ASSIGNED' ? 'in-progress' : raw.status === 'COMPLETED' ? 'completed' : 'new',
            policyReference: raw.policyNumber || null,
            intakeChannel: raw.applicationChannel || 'online',
            postMortem: 'pending',
            stages,
            checklist: (raw.requestedServices || []).map((name, i) => ({
              id: `item-req-${i + 1}`,
              name,
              category: 'General',
              quantity: 1,
              status: 'requested',
              assignedTo: assignedName,
              notes: 'Requested during customer intake',
              createdAt: raw.createdAt.toISOString(),
            })),
            documents: [
              { id: `doc-b-${raw.id}`, type: 'Burial order', status: 'missing', receivedBy: '', verifiedBy: '', notes: '' },
              { id: `doc-p-${raw.id}`, type: 'Police clearance', status: 'missing', receivedBy: '', verifiedBy: '', notes: '' },
            ],
            movements: [],
            quotes: [],
            payments: [],
            contributions: [],
            demo: false,
          },
        })
      }
    }
  } catch (err) {
    console.error('[syncCustomerCases error]', err)
  }
}

const createSeedOperationsStore = (): any => ({
  version: 2,
  cases: [
    {
      id: 'case-demo-0001',
      reference: 'CASE-CASH-0001',
      caseType: 'cash-walk-in',
      customerName: 'Tariro Demo',
      phone: '+263770000101',
      deceasedName: 'Kundai Demo',
      dateOfDeath: plusDays(-1),
      serviceLocation: 'Harare (sample)',
      branch: 'Harare',
      funeralAt: plusDays(2),
      funeralLocation: 'Borrowdale (sample)',
      coordinator: 'Operations team',
      priority: 'urgent',
      priorityReason: 'Sample case for workflow demonstration',
      status: 'in-progress',
      postMortem: 'pending',
      stages: createCaseStages(),
      checklist: [
        {
          id: 'item-demo-1',
          name: 'Hearse / transport',
          category: 'Transport',
          quantity: 1,
          status: 'assigned',
          assignedTo: 'Transport team',
          notes: '',
          createdAt: new Date().toISOString(),
        },
      ],
      documents: [{ id: 'doc-demo-1', type: 'Police clearance', status: 'missing', receivedBy: '', verifiedBy: '', notes: '' }],
      movements: [],
      quotes: [],
      payments: [],
      contributions: [],
      walletGoal: { amount: 600, currency: 'USD' },
      demo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  policies: [
    {
      id: 'pol-demo-0001',
      reference: 'POL-APP-0001',
      customerName: 'Rutendo Sample',
      phone: '+263770000102',
      product: 'Fidelity Executive Funeral Plan',
      coveredMembers: ['Rutendo Sample (Self)', 'Tendai Sample (Spouse)'],
      status: 'under-review',
      checks: { identityVerified: true, documentsVerified: false, eligibilityConfirmed: false },
      responsibleStaff: 'Policy Team',
      notes: 'Customer submitted national ID copy; awaiting proof of residence.',
      demo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  catalogue: [
    { id: 'cat-1', name: 'Body removal & collection', category: 'Collection', description: 'Collection from hospital or residence', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-2', name: 'Mortuary / overnight storage', category: 'Mortuary', description: 'Cold storage facility per day', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-3', name: 'Coffin / casket selection', category: 'Equipment', description: 'Wood veneer or solid wood casket', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-4', name: 'Hearse / procession transport', category: 'Transport', description: 'Standard or executive hearse vehicle', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-5', name: 'Tent (100 seater) & chairs', category: 'Equipment', description: 'Complete outdoor setup for memorial', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-6', name: 'Mobile restrooms', category: 'Equipment', description: 'Sanitation unit for gravesite or home', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-7', name: 'Burial programmes & printing', category: 'Stationery', description: 'Printed service order brochures', active: true, createdAt: new Date().toISOString() },
    { id: 'cat-8', name: 'Floral tributes & wreaths', category: 'Flowers', description: 'Fresh floral arrangements for casket and grave', active: true, createdAt: new Date().toISOString() },
  ],
  exhumations: [
    {
      id: 'exh-demo-0001',
      reference: 'EXH-2025-001',
      customerName: 'Tendai Moyo',
      phone: '+263772123456',
      deceasedName: 'Sekuru Moyo',
      address: 'Granville Cemetery (Mbudzi), Harare',
      destinationAddress: 'Zororo Memorial Park, Harare',
      currency: 'USD',
      requestedAt: new Date().toISOString().slice(0, 10),
      status: 'permits-in-progress',
      estimatedCost: 1200,
      quotedPrice: 1200,
      permitReference: 'HCC-EXH-2025-19',
      permitStatus: 'submitted',
      requirements: EXHUMATION_REQUIREMENTS.map((name, idx) => ({
        id: `req-${idx + 1}`,
        name,
        status: idx < 2 ? 'verified' : 'pending',
        notes: '',
      })),
      notes: 'Initial consultations done with Warren Hills & Zororo authorities.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demo: true,
    },
  ],
  tokenCharges: [
    { feature: 'exhumation', label: 'Exhumation service', amount: 50 },
    { feature: 'whatsapp-alerts', label: 'WhatsApp notifications', amount: 5 },
    { feature: 'llm-support', label: 'AI support assistant', amount: 2 },
    { feature: 'grave-map', label: 'Grave-map lookup', amount: 5 },
    { feature: 'flower-tribute', label: 'Virtual flower tribute', amount: 10 },
    { feature: 'biography-generation', label: 'Biography generation', amount: 15 },
    { feature: 'music-generation', label: 'Music generation', amount: 25 },
    { feature: 'video-generation', label: 'Video generation', amount: 30 },
    { feature: 'stream-replay', label: 'Funeral recording replay', amount: 10 },
  ],
  audit: [
    {
      id: 'aud-demo-1',
      at: new Date().toISOString(),
      actor: 'Admin',
      action: 'SYSTEM_STARTUP',
      summary: 'Fidelity Operations Workspace initialized',
    },
  ],
})

const inMemoryOperationsStore: any = loadPersistedOpsState(createSeedOperationsStore)
// Normalize legacy seed exhumations if an older operations.json is on disk
if (Array.isArray(inMemoryOperationsStore.exhumations)) {
  inMemoryOperationsStore.exhumations = inMemoryOperationsStore.exhumations.map((e: any) => ({
    ...e,
    address: e.address || e.originCemetery || 'Not entered',
    destinationAddress: e.destinationAddress || e.destinationCemetery || '',
    currency: e.currency || 'USD',
    requestedAt: e.requestedAt || (e.createdAt ? String(e.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
    permitReference: e.permitReference ?? '',
    permitStatus: e.permitStatus || 'pending',
    requirements: Array.isArray(e.requirements)
      ? e.requirements
      : EXHUMATION_REQUIREMENTS.map((name, idx) => ({
          id: `req-${idx + 1}`,
          name,
          status: 'pending',
          notes: '',
        })),
  }))
}
export function createOperationsRouter(): Router {
  const router = Router()

  // All endpoints require admin session
  router.use(requireAdminSession)

  // GET /api/admin/operations/state
  router.get('/operations/state', async (_req, res, next) => {
    try {
      await seedInitialOperationsData()
      await syncCustomerCases()

      const [cases, policies, catalogue, exhumations, tokenCharges, audit] = await Promise.all([
        prisma.operationCase.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.operationPolicy.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.operationCatalogueItem.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.operationExhumation.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.operationTokenCharge.findMany({ orderBy: { feature: 'asc' } }),
        prisma.operationAuditEntry.findMany({ orderBy: { at: 'desc' }, take: 200 }),
      ])

      res.json({
        version: 2,
        cases: cases.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        policies: policies.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        catalogue: catalogue.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
        exhumations: exhumations.map((e) => ({
          ...e,
          estimatedCost: e.estimatedCost ? Number(e.estimatedCost) : undefined,
          quotedPrice: e.quotedPrice ? Number(e.quotedPrice) : undefined,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
        tokenCharges: tokenCharges.map((tc) => ({
          ...tc,
          amount: tc.amount ? Number(tc.amount) : undefined,
        })),
        audit: audit.map((a) => ({
          ...a,
          at: a.at.toISOString(),
        })),
      })
    } catch (error) {
      res.json(inMemoryOperationsStore)
    }
  })

  // POST /api/admin/operations/cases
  router.post('/operations/cases', async (req, res, next) => {
    try {
      const body = req.body
      const actor = req.sessionUser?.phoneNumber || 'Admin'
      const id = body.id || `case-${randomUUID()}`

      const created = await prisma.operationCase.create({
        data: {
          id,
          reference: body.reference,
          caseType: body.caseType || 'cash-walk-in',
          customerName: body.customerName,
          phone: body.phone,
          deceasedName: body.deceasedName,
          dateOfDeath: body.dateOfDeath,
          serviceLocation: body.serviceLocation,
          branch: body.branch || 'Harare',
          funeralAt: body.funeralAt || null,
          funeralLocation: body.funeralLocation || '',
          coordinator: body.coordinator || '',
          priority: body.priority || 'standard',
          priorityReason: body.priorityReason || '',
          status: body.status || 'new',
          policyReference: body.policyReference || null,
          intakeChannel: body.intakeChannel || 'staff',
          postMortem: body.postMortem || 'pending',
          stages: body.stages || createCaseStages(),
          checklist: body.checklist || [],
          documents: body.documents || [],
          movements: body.movements || [],
          quotes: body.quotes || [],
          payments: body.payments || [],
          contributions: body.contributions || [],
          walletGoal: body.walletGoal || null,
          demo: Boolean(body.demo),
        },
      })

      await prisma.operationAuditEntry.create({
        data: {
          id: `audit-${randomUUID()}`,
          actor,
          action: 'Created case',
          entity: created.reference,
          summary: `${created.caseType === 'cash-walk-in' ? 'Cash walk-in' : 'Policy-covered'} case opened.`,
          demo: created.demo,
        },
      })

      // Automatic Multi-channel notifications for walk-in / new request
      if (created.phone) {
        void createWhatsAppFuneralGroup({
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customerName: created.customerName,
          familyPhone: created.phone,
        })

        void dispatchWorkflowNotifications({
          event: created.caseType === 'cash-walk-in' ? 'walkin_request' : 'customer_self_request',
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customer: {
            name: created.customerName,
            phone: created.phone,
          },
          assignedStaff: created.coordinator ? { name: created.coordinator } : undefined,
          notes: `Funeral case logged. Service location: ${created.serviceLocation || 'Harare'}.`,
        })

        if (created.coordinator) {
          void dispatchWorkflowNotifications({
            event: 'case_assigned',
            caseReference: created.reference,
            deceasedName: created.deceasedName,
            customer: {
              name: created.customerName,
              phone: created.phone,
            },
            assignedStaff: { name: created.coordinator },
            notes: 'Coordinator assigned at case intake.',
          })
        }
      }

      res.status(201).json(created)
    } catch {
      const body = req.body
      const now = new Date().toISOString()
      const created = {
        id: body.id || `case-${randomUUID()}`,
        reference: body.reference || `CASE-${Math.floor(1000 + Math.random() * 9000)}`,
        caseType: body.caseType || 'cash-walk-in',
        customerName: body.customerName || 'Walk-in Customer',
        phone: body.phone || '',
        deceasedName: body.deceasedName || 'Not specified',
        dateOfDeath: body.dateOfDeath || now.slice(0, 10),
        serviceLocation: body.serviceLocation || 'Harare',
        branch: body.branch || 'Harare',
        funeralAt: body.funeralAt || null,
        funeralLocation: body.funeralLocation || '',
        coordinator: body.coordinator || '',
        priority: body.priority || 'standard',
        priorityReason: body.priorityReason || '',
        status: body.status || 'new',
        policyReference: body.policyReference || null,
        intakeChannel: body.intakeChannel || 'staff',
        postMortem: body.postMortem || 'pending',
        stages: body.stages || createCaseStages(),
        checklist: body.checklist || [],
        documents: body.documents || [],
        movements: body.movements || [],
        quotes: body.quotes || [],
        payments: body.payments || [],
        contributions: body.contributions || [],
        walletGoal: body.walletGoal || null,
        demo: Boolean(body.demo),
        createdAt: now,
        updatedAt: now,
      }
      inMemoryOperationsStore.cases = [created, ...(inMemoryOperationsStore.cases || [])]
      savePersistedOpsState(inMemoryOperationsStore)
      if (created.phone) {
        void createWhatsAppFuneralGroup({
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customerName: created.customerName,
          familyPhone: created.phone,
        })
        void dispatchWorkflowNotifications({
          event: created.caseType === 'cash-walk-in' ? 'walkin_request' : 'customer_self_request',
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customer: { name: created.customerName, phone: created.phone },
          assignedStaff: created.coordinator ? { name: created.coordinator } : undefined,
          notes: `Funeral case logged. Service location: ${created.serviceLocation || 'Harare'}.`,
        })
      }
      res.status(201).json(created)
    }
  })

  // PUT & PATCH /api/admin/operations/cases/:id
  const handleUpdateCase = async (req: any, res: any, next: any) => {
    try {
      const { id } = req.params
      const body = req.body
      const actor = req.sessionUser?.phoneNumber || 'Admin'

      const existing = await prisma.operationCase.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ code: 'not_found', message: 'Operation case not found.' })
        return
      }

      const updated = await prisma.operationCase.update({
        where: { id },
        data: {
          reference: body.reference ?? existing.reference,
          caseType: body.caseType ?? existing.caseType,
          customerName: body.customerName ?? existing.customerName,
          phone: body.phone ?? existing.phone,
          deceasedName: body.deceasedName ?? existing.deceasedName,
          dateOfDeath: body.dateOfDeath ?? existing.dateOfDeath,
          serviceLocation: body.serviceLocation ?? existing.serviceLocation,
          branch: body.branch ?? existing.branch,
          funeralAt: body.funeralAt ?? existing.funeralAt,
          funeralLocation: body.funeralLocation ?? existing.funeralLocation,
          coordinator: body.coordinator ?? existing.coordinator,
          priority: body.priority ?? existing.priority,
          priorityReason: body.priorityReason ?? existing.priorityReason,
          closureReason: body.closureReason ?? existing.closureReason,
          status: body.status ?? existing.status,
          policyReference: body.policyReference ?? existing.policyReference,
          intakeChannel: body.intakeChannel ?? existing.intakeChannel,
          postMortem: body.postMortem ?? existing.postMortem,
          stages: body.stages ?? existing.stages,
          checklist: body.checklist ?? existing.checklist,
          documents: body.documents ?? existing.documents,
          movements: body.movements ?? existing.movements,
          quotes: body.quotes ?? existing.quotes,
          payments: body.payments ?? existing.payments,
          contributions: body.contributions ?? existing.contributions,
          walletGoal: body.walletGoal ?? existing.walletGoal,
        },
      })

      if (body.auditAction && body.auditSummary) {
        await prisma.operationAuditEntry.create({
          data: {
            id: `audit-${randomUUID()}`,
            actor,
            action: body.auditAction,
            entity: updated.reference,
            summary: body.auditSummary,
            demo: updated.demo,
          },
        })
      }

      // Multi-channel notification: check if coordinator changed or was newly assigned
      if (body.coordinator && body.coordinator !== existing.coordinator) {
        void dispatchWorkflowNotifications({
          event: 'case_assigned',
          caseReference: updated.reference,
          deceasedName: updated.deceasedName,
          customer: {
            name: updated.customerName,
            phone: updated.phone,
          },
          assignedStaff: { name: body.coordinator },
          notes: body.auditSummary || 'Assigned as Lead Case Coordinator.',
        })
      }

      // Multi-channel notification: check if any checklist task was assigned or re-assigned
      if (Array.isArray(body.checklist)) {
        const oldChecklist = (existing.checklist as any[]) || []
        for (const item of body.checklist) {
          if (item && item.assignedTo) {
            const oldItem = oldChecklist.find((o: any) => o.id === item.id)
            if (!oldItem || oldItem.assignedTo !== item.assignedTo) {
              void dispatchWorkflowNotifications({
                event: 'task_assigned',
                caseReference: updated.reference,
                deceasedName: updated.deceasedName,
                assignedStaff: { name: item.assignedTo },
                task: {
                  name: item.name || 'Checklist item',
                  category: item.category,
                  quantity: item.quantity,
                  notes: item.notes,
                },
              })
            }
          }
        }
      }

      // Multi-channel notification: check if any stage was assigned or re-assigned
      if (Array.isArray(body.stages)) {
        const oldStages = (existing.stages as any[]) || []
        for (const stage of body.stages) {
          if (stage && stage.assignedTo) {
            const oldStage = oldStages.find((o: any) => o.id === stage.id)
            if (!oldStage || oldStage.assignedTo !== stage.assignedTo) {
              void dispatchWorkflowNotifications({
                event: 'task_assigned',
                caseReference: updated.reference,
                deceasedName: updated.deceasedName,
                assignedStaff: { name: stage.assignedTo },
                task: {
                  name: `Stage: ${stage.label}`,
                  notes: stage.notes,
                  plannedAt: stage.plannedAt,
                },
              })
            }
          }
        }
      }

      res.json(updated)
    } catch {
      const { id } = req.params
      const body = req.body
      const cases = inMemoryOperationsStore.cases || []
      const idx = cases.findIndex((c: any) => c.id === id)
      if (idx === -1) {
        res.status(404).json({ code: 'not_found', message: 'Operation case not found.' })
        return
      }
      const existing = cases[idx]
      const updated = {
        ...existing,
        ...body,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      }
      delete (updated as any).auditAction
      delete (updated as any).auditSummary
      cases[idx] = updated
      if (body.auditAction && body.auditSummary) {
        inMemoryOperationsStore.audit = [
          {
            id: `audit-${randomUUID()}`,
            at: new Date().toISOString(),
            actor: req.sessionUser?.phoneNumber || 'Admin',
            action: body.auditAction,
            entity: updated.reference,
            summary: body.auditSummary,
            demo: Boolean(updated.demo),
          },
          ...(inMemoryOperationsStore.audit || []),
        ].slice(0, 200)
      }
      savePersistedOpsState(inMemoryOperationsStore)
      res.json(updated)
    }
  }
  router.put('/operations/cases/:id', handleUpdateCase)
  router.patch('/operations/cases/:id', handleUpdateCase)

  // POST /api/admin/operations/policies
  router.post('/operations/policies', async (req, res, next) => {
    try {
      const body = req.body
      const actor = req.sessionUser?.phoneNumber || 'Admin'
      const id = body.id || `policy-${randomUUID()}`

      const created = await prisma.operationPolicy.create({
        data: {
          id,
          reference: body.reference,
          customerName: body.customerName,
          phone: body.phone,
          product: body.product,
          coveredMembers: body.coveredMembers || [],
          requestedServices: body.requestedServices || [],
          applicationChannel: body.applicationChannel || 'staff',
          applicationLocation: body.applicationLocation || 'Branch',
          status: body.status || 'submitted',
          checks: body.checks || { identityVerified: false, documentsVerified: false, eligibilityConfirmed: false },
          effectiveDate: body.effectiveDate || null,
          responsibleStaff: body.responsibleStaff || actor,
          notes: body.notes || '',
          demo: Boolean(body.demo),
        },
      })

      await prisma.operationAuditEntry.create({
        data: {
          id: `audit-${randomUUID()}`,
          actor,
          action: 'Submitted policy application',
          entity: created.reference,
          summary: `Policy application created for ${created.customerName} (${created.product}).`,
          demo: created.demo,
        },
      })

      res.status(201).json(created)
    } catch {
      const body = req.body
      const now = new Date().toISOString()
      const created = {
        id: body.id || `case-${randomUUID()}`,
        reference: body.reference || `CASE-${Math.floor(1000 + Math.random() * 9000)}`,
        caseType: body.caseType || 'cash-walk-in',
        customerName: body.customerName || 'Walk-in Customer',
        phone: body.phone || '',
        deceasedName: body.deceasedName || 'Not specified',
        dateOfDeath: body.dateOfDeath || now.slice(0, 10),
        serviceLocation: body.serviceLocation || 'Harare',
        branch: body.branch || 'Harare',
        funeralAt: body.funeralAt || null,
        funeralLocation: body.funeralLocation || '',
        coordinator: body.coordinator || '',
        priority: body.priority || 'standard',
        priorityReason: body.priorityReason || '',
        status: body.status || 'new',
        policyReference: body.policyReference || null,
        intakeChannel: body.intakeChannel || 'staff',
        postMortem: body.postMortem || 'pending',
        stages: body.stages || createCaseStages(),
        checklist: body.checklist || [],
        documents: body.documents || [],
        movements: body.movements || [],
        quotes: body.quotes || [],
        payments: body.payments || [],
        contributions: body.contributions || [],
        walletGoal: body.walletGoal || null,
        demo: Boolean(body.demo),
        createdAt: now,
        updatedAt: now,
      }
      inMemoryOperationsStore.cases = [created, ...(inMemoryOperationsStore.cases || [])]
      savePersistedOpsState(inMemoryOperationsStore)
      if (created.phone) {
        void createWhatsAppFuneralGroup({
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customerName: created.customerName,
          familyPhone: created.phone,
        })
        void dispatchWorkflowNotifications({
          event: created.caseType === 'cash-walk-in' ? 'walkin_request' : 'customer_self_request',
          caseReference: created.reference,
          deceasedName: created.deceasedName,
          customer: { name: created.customerName, phone: created.phone },
          assignedStaff: created.coordinator ? { name: created.coordinator } : undefined,
          notes: `Funeral case logged. Service location: ${created.serviceLocation || 'Harare'}.`,
        })
      }
      res.status(201).json(created)
    }
  })

  // PUT & PATCH /api/admin/operations/policies/:id
  const handleUpdatePolicy = async (req: any, res: any, next: any) => {
    try {
      const { id } = req.params
      const body = req.body
      const actor = req.sessionUser?.phoneNumber || 'Admin'

      const existing = await prisma.operationPolicy.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ code: 'not_found', message: 'Policy application not found.' })
        return
      }

      const updated = await prisma.operationPolicy.update({
        where: { id },
        data: {
          customerName: body.customerName ?? existing.customerName,
          phone: body.phone ?? existing.phone,
          product: body.product ?? existing.product,
          coveredMembers: body.coveredMembers ?? existing.coveredMembers,
          status: body.status ?? existing.status,
          checks: body.checks ?? existing.checks,
          effectiveDate: body.effectiveDate ?? existing.effectiveDate,
          responsibleStaff: body.responsibleStaff ?? existing.responsibleStaff,
          notes: body.notes ?? existing.notes,
        },
      })

      if (body.auditAction && body.auditSummary) {
        await prisma.operationAuditEntry.create({
          data: {
            id: `audit-${randomUUID()}`,
            actor,
            action: body.auditAction,
            entity: updated.reference,
            summary: body.auditSummary,
            demo: updated.demo,
          },
        })
      }

      res.json(updated)
    } catch {
      const { id } = req.params
      const body = req.body
      const cases = inMemoryOperationsStore.cases || []
      const idx = cases.findIndex((c: any) => c.id === id)
      if (idx === -1) {
        res.status(404).json({ code: 'not_found', message: 'Operation case not found.' })
        return
      }
      const existing = cases[idx]
      const updated = {
        ...existing,
        ...body,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      }
      delete (updated as any).auditAction
      delete (updated as any).auditSummary
      cases[idx] = updated
      if (body.auditAction && body.auditSummary) {
        inMemoryOperationsStore.audit = [
          {
            id: `audit-${randomUUID()}`,
            at: new Date().toISOString(),
            actor: req.sessionUser?.phoneNumber || 'Admin',
            action: body.auditAction,
            entity: updated.reference,
            summary: body.auditSummary,
            demo: Boolean(updated.demo),
          },
          ...(inMemoryOperationsStore.audit || []),
        ].slice(0, 200)
      }
      savePersistedOpsState(inMemoryOperationsStore)
      res.json(updated)
    }
  }
  router.put('/operations/policies/:id', handleUpdatePolicy)
  router.patch('/operations/policies/:id', handleUpdatePolicy)

  // POST /api/admin/operations/catalogue
  router.post('/operations/catalogue', async (req, res, next) => {
    try {
      const body = req.body
      const id = body.id || `cat-${randomUUID()}`
      const item = await prisma.operationCatalogueItem.upsert({
        where: { id },
        create: {
          id,
          name: body.name,
          category: body.category,
          description: body.description || '',
          active: body.active ?? true,
        },
        update: {
          name: body.name,
          category: body.category,
          description: body.description,
          active: body.active,
        },
      })
      res.json(item)
    } catch {
      const body = req.body
      const id = body.id || `cat-${randomUUID()}`
      const list = inMemoryOperationsStore.catalogue || []
      const idx = list.findIndex((c: any) => c.id === id)
      const item = {
        id,
        name: body.name,
        category: body.category,
        description: body.description || '',
        active: body.active ?? true,
        createdAt: idx >= 0 ? list[idx].createdAt : new Date().toISOString(),
      }
      if (idx >= 0) list[idx] = item
      else list.push(item)
      inMemoryOperationsStore.catalogue = list
      savePersistedOpsState(inMemoryOperationsStore)
      res.json(item)
    }
  })

  // POST /api/admin/operations/exhumations
  router.post('/operations/exhumations', async (req, res, next) => {
    try {
      const body = req.body
      const id = body.id || `exh-${randomUUID()}`
      const exh = await prisma.operationExhumation.upsert({
        where: { id },
        create: {
          id,
          reference: body.reference || `EXH-${Math.floor(1000 + Math.random() * 9000)}`,
          customerName: body.customerName,
          phone: body.phone,
          deceasedName: body.deceasedName,
          address: body.address,
          destinationAddress: body.destinationAddress,
          currency: body.currency || 'USD',
          requestedAt: body.requestedAt || new Date().toISOString().slice(0, 10),
          status: body.status || 'new',
          estimatedCost: body.estimatedCost ? Number(body.estimatedCost) : null,
          quotedPrice: body.quotedPrice ? Number(body.quotedPrice) : null,
          permitReference: body.permitReference || '',
          permitStatus: body.permitStatus || 'pending',
          requirements: body.requirements || [],
          notes: body.notes || '',
          demo: Boolean(body.demo),
        },
        update: {
          customerName: body.customerName,
          phone: body.phone,
          deceasedName: body.deceasedName,
          address: body.address,
          destinationAddress: body.destinationAddress,
          requestedAt: body.requestedAt,
          status: body.status,
          estimatedCost: body.estimatedCost !== undefined ? (body.estimatedCost ? Number(body.estimatedCost) : null) : undefined,
          quotedPrice: body.quotedPrice !== undefined ? (body.quotedPrice ? Number(body.quotedPrice) : null) : undefined,
          permitReference: body.permitReference,
          permitStatus: body.permitStatus,
          requirements: body.requirements,
          notes: body.notes,
        },
      })

      if (exh.phone) {
        void notifyDual({
          customerPhone: exh.phone,
          kind: 'exhumation.received',
          payload: {
            reference: exh.reference,
            deceasedName: exh.deceasedName,
            address: exh.address,
            destinationAddress: exh.destinationAddress,
          },
          adminAlertKind: 'exhumation.received',
        })
      }

      res.json(exh)
    } catch {
      const body = req.body
      const id = body.id || `exh-${randomUUID()}`
      const now = new Date().toISOString()
      const list = inMemoryOperationsStore.exhumations || []
      const idx = list.findIndex((e: any) => e.id === id)
      const exh = {
        ...(idx >= 0 ? list[idx] : {}),
        ...body,
        id,
        reference: body.reference || (idx >= 0 ? list[idx].reference : `EXH-${Math.floor(1000 + Math.random() * 9000)}`),
        currency: body.currency || 'USD',
        requirements: Array.isArray(body.requirements) ? body.requirements : (idx >= 0 ? list[idx].requirements : []),
        createdAt: idx >= 0 ? list[idx].createdAt : now,
        updatedAt: now,
      }
      if (idx >= 0) list[idx] = exh
      else list.unshift(exh)
      inMemoryOperationsStore.exhumations = list
      savePersistedOpsState(inMemoryOperationsStore)
      res.json(exh)
    }
  })

  // DELETE /api/admin/operations/exhumations/:id
  router.delete('/operations/exhumations/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      await prisma.operationExhumation.delete({ where: { id } })
      res.json({ ok: true, id })
    } catch {
      const { id } = req.params
      inMemoryOperationsStore.exhumations = (inMemoryOperationsStore.exhumations || []).filter((e: any) => e.id !== id)
      savePersistedOpsState(inMemoryOperationsStore)
      res.json({ ok: true, id })
    }
  })

  // POST /api/admin/operations/token-charges
  router.post('/operations/token-charges', async (req, res, next) => {
    try {
      const { feature, enabled, amount } = req.body
      const tc = await prisma.operationTokenCharge.upsert({
        where: { feature },
        create: {
          feature,
          label: req.body.label || feature,
          enabled: Boolean(enabled),
          amount: amount ? Number(amount) : null,
        },
        update: {
          enabled: Boolean(enabled),
          amount: amount ? Number(amount) : null,
        },
      })
      res.json(tc)
    } catch {
      const { feature, enabled, amount } = req.body
      const list = inMemoryOperationsStore.tokenCharges || []
      const idx = list.findIndex((t: any) => t.feature === feature)
      const tc = { feature, label: req.body.label || (idx >= 0 ? list[idx].label : feature), enabled: Boolean(enabled), amount: amount ? Number(amount) : undefined }
      if (idx >= 0) list[idx] = tc
      else list.push(tc)
      inMemoryOperationsStore.tokenCharges = list
      savePersistedOpsState(inMemoryOperationsStore)
      res.json(tc)
    }
  })

  // POST /api/admin/operations/audit
  router.post('/operations/audit', async (req, res, next) => {
    try {
      const { actor, action, entity, summary, demo } = req.body
      const entry = await prisma.operationAuditEntry.create({
        data: {
          id: `audit-${randomUUID()}`,
          actor: actor || req.sessionUser?.phoneNumber || 'Admin',
          action,
          entity,
          summary,
          demo: Boolean(demo),
        },
      })
      res.status(201).json(entry)
    } catch {
      const { actor, action, entity, summary, demo } = req.body
      const entry = {
        id: `audit-${randomUUID()}`,
        at: new Date().toISOString(),
        actor: actor || req.sessionUser?.phoneNumber || 'Admin',
        action,
        entity,
        summary,
        demo: Boolean(demo),
      }
      inMemoryOperationsStore.audit = [entry, ...(inMemoryOperationsStore.audit || [])].slice(0, 200)
      savePersistedOpsState(inMemoryOperationsStore)
      res.status(201).json(entry)
    }
  })

  // POST /api/admin/operations/reset
  router.post('/operations/reset', async (_req, res, next) => {
    try {
      await prisma.operationAuditEntry.deleteMany({})
      await prisma.operationCase.deleteMany({})
      await prisma.operationPolicy.deleteMany({})
      await prisma.operationCatalogueItem.deleteMany({})
      await prisma.operationExhumation.deleteMany({})
      await prisma.operationTokenCharge.deleteMany({})
      await seedInitialOperationsData()
      res.json({ ok: true, message: 'Operations workspace reset to default demo seed.' })
    } catch {
      const fresh = createSeedOperationsStore()
      Object.assign(inMemoryOperationsStore, fresh)
      savePersistedOpsState(inMemoryOperationsStore)
      res.json({ ok: true, message: 'Operations workspace reset to default demo seed.' })
    }
  })

  // GET /api/admin/overview
  router.get('/overview', async (_req, res) => {
    try {
      let openCasesCount = 3
      let urgentCount = 1
      try {
        const cases = await prisma.operationCase.findMany({ select: { priority: true, status: true } })
        if (cases.length > 0) {
          urgentCount = cases.filter((c) => c.priority === 'urgent' && c.status !== 'completed' && c.status !== 'closed').length
          openCasesCount = cases.filter((c) => c.status !== 'completed' && c.status !== 'closed').length
        }
      } catch {
        // DB fallback
      }

      res.json({
        stats: [
          { id: 'urgent', label: 'Urgent requests', value: Math.max(1, urgentCount), tone: 'alert', hint: 'Action needed' },
          { id: 'open-requests', label: 'Open requests', value: Math.max(3, openCasesCount), hint: 'Awaiting action' },
          { id: 'active-orders', label: 'Active orders', value: 8, hint: 'Fulfillment in progress' },
          { id: 'revenue', label: 'Earned this month', value: 14250, money: true, tone: 'good' },
        ],
        attention: [
          {
            id: 'att-1',
            label: 'Assistance request: Repatriation & Burial',
            detail: 'Rutendo Moyo · Borrowdale, Harare · Assigned to Harare Funeral Care',
            tone: 'alert',
            target: { page: 'requests', id: 'AR-1049' },
          },
          {
            id: 'att-2',
            label: 'Cash Funeral Case: Urgent Removal',
            detail: 'Tariro Demo · Harare Hospital · Coordinator assigned',
            tone: 'warning',
            target: { page: 'requests', id: 'case-demo-0001' },
          },
        ],
        ordersByStatus: [
          { status: 'paid', count: 4 },
          { status: 'in_progress', count: 3 },
          { status: 'delivered', count: 6 },
          { status: 'awaiting_payment', count: 1 },
        ],
        requestsOpen: Math.max(3, openCasesCount),
      })
    } catch {
      res.json({
        stats: [
          { id: 'urgent', label: 'Urgent requests', value: 1, tone: 'alert' },
          { id: 'open-requests', label: 'Open requests', value: 3 },
          { id: 'active-orders', label: 'Active orders', value: 6 },
          { id: 'revenue', label: 'Earned this month', value: 12500, money: true, tone: 'good' },
        ],
        attention: [],
        ordersByStatus: [],
        requestsOpen: 3,
      })
    }
  })

  // GET /api/admin/requests
  router.get('/requests', async (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined
    const all = listStoredRequests()
    res.json(statusFilter ? all.filter((r) => r.status === statusFilter) : all)
  })

  // POST /api/admin/requests
  router.post('/requests', async (req, res) => {
    const body = req.body || {}
    const customerName = String(body.customerName || '').trim()
    if (!customerName) {
      res.status(422).json({ code: 'validation_failed', message: 'Customer name is required.' })
      return
    }
    const now = new Date().toISOString()
    const rawKind = String(body.kind || 'general')
    const kind: StoredRequest['kind'] =
      rawKind === 'bereavement' || rawKind === 'funeral_support' || rawKind === 'repatriation' || rawKind === 'exhumation'
        ? 'bereavement'
        : rawKind === 'claim'
          ? 'claim'
          : 'general'
    const ref = String(body.reference || `AR-${Math.floor(1051 + Math.random() * 8900)}`)
    const created: StoredRequest = {
      id: ref,
      reference: ref,
      kind,
      contactPreference: (body.contactPreference || 'whatsapp') as StoredRequest['contactPreference'],
      message: String(body.message || '').trim() || 'Urgent assistance request logged by administrator.',
      status: 'received',
      urgent: true,
      actions: ['assign'],
      customer: {
        id: `u-${Date.now().toString(36)}`,
        name: customerName,
        phone: String(body.phone || '').trim(),
        email: String(body.email || '').trim() || undefined,
      },
      statusHistory: [
        { status: 'received', label: 'Received', at: now, note: 'Logged by administrator' },
      ],
      createdAt: now,
      updatedAt: now,
    }
    const all = listStoredRequests()
    all.unshift(created)
    saveStoredRequests(all)
    res.status(201).json(created)
  })

  // POST /api/admin/requests/:id/assignment
  router.post('/requests/:id/assignment', async (req, res) => {
    const { id } = req.params
    const providerId = String(req.body?.providerId || '').trim()
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined
    if (!providerId) {
      res.status(422).json({ code: 'validation_failed', message: 'Choose a Fidelity Staff member.' })
      return
    }
    const staff = KNOWN_STAFF.find((s) => s.id === providerId || s.name.toLowerCase() === providerId.toLowerCase())
    const providerNames: Record<string, string> = {
      'harare-funeral-care': 'Harare Funeral Care',
      'bulawayo-memorial': 'Bulawayo Memorial & Cremations',
    }
    const providerName = staff?.name || providerNames[providerId]
    if (!providerName) {
      res.status(422).json({ code: 'validation_failed', message: 'Selected staff member or provider was not found.' })
      return
    }
    const all = listStoredRequests()
    const idx = all.findIndex((r) => r.id === id)
    if (idx === -1) {
      res.status(404).json({ code: 'not_found', message: 'Request not found.' })
      return
    }
    const now = new Date().toISOString()
    const current = all[idx]
    const updated: StoredRequest = {
      ...current,
      status: 'assigned',
      assignedTo: providerName,
      assignment: {
        providerId,
        providerName,
        status: 'assigned',
        assignedAt: now,
        ...(note ? { note } : {}),
      },
      actions: ['assign', 'accepted', 'declined', 'completed'],
      statusHistory: [
        ...(current.statusHistory || []),
        { status: 'assigned', label: 'Adviser assigned', at: now, note: `Assigned to ${providerName}` },
      ],
      updatedAt: now,
    }
    all[idx] = updated
    saveStoredRequests(all)

    void dispatchWorkflowNotifications({
      event: 'case_assigned',
      caseReference: updated.reference,
      deceasedName: updated.deceasedName,
      customer: updated.customer.phone
        ? {
            name: updated.customer.name,
            phone: updated.customer.phone,
            email: updated.customer.email,
            contactPreference: updated.contactPreference,
          }
        : undefined,
      assignedStaff: {
        name: providerName,
        phone: staff?.phone,
        email: staff?.email,
      },
      notes: note,
    })

    res.json(updated)
  })

  // PATCH /api/admin/requests/:id/assignment
  router.patch('/requests/:id/assignment', async (req, res) => {
    const { id } = req.params
    const action = String(req.body?.status || '') as 'accepted' | 'declined' | 'completed'
    if (!['accepted', 'declined', 'completed'].includes(action)) {
      res.status(422).json({ code: 'validation_failed', message: 'Invalid assignment status.' })
      return
    }
    const all = listStoredRequests()
    const idx = all.findIndex((r) => r.id === id)
    if (idx === -1) {
      res.status(404).json({ code: 'not_found', message: 'Request not found.' })
      return
    }
    const now = new Date().toISOString()
    const current = all[idx]
    const nextStatus: StoredRequest['status'] =
      action === 'accepted' ? 'in_progress' : action === 'completed' ? 'complete' : 'received'
    const nextLabel =
      action === 'accepted' ? 'In progress' : action === 'completed' ? 'Complete' : 'Received'
    const updated: StoredRequest = {
      ...current,
      status: nextStatus,
      assignment: current.assignment
        ? { ...current.assignment, status: action, respondedAt: now }
        : undefined,
      actions: action === 'completed' ? [] : action === 'accepted' ? ['assign', 'completed'] : ['assign'],
      statusHistory: [
        ...(current.statusHistory || []),
        {
          status: nextStatus,
          label: nextLabel,
          at: now,
          note: `${current.assignment?.providerName || 'Fidelity Operations'} marked ${action}`,
        },
      ],
      updatedAt: now,
    }
    all[idx] = updated
    saveStoredRequests(all)
    res.json(updated)
  })

  // GET /api/admin/orders
  router.get('/orders', async (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined
    const all = listStoredOrders()
    res.json(statusFilter ? all.filter((o) => o.status === statusFilter) : all)
  })

  // POST /api/admin/orders (walk-in order)
  router.post('/orders', async (req, res) => {
    const body = req.body || {}
    const customerName = String(body.customerName || '').trim()
    const product = String(body.product || '').trim()
    if (!customerName || !product) {
      res.status(422).json({ code: 'validation_failed', message: 'Customer name and product are required.' })
      return
    }
    const amount = Math.max(0, Number(body.amount) || 0)
    const phone = String(body.phone || '').trim()
    const method = String(body.paymentMethod || 'cash')
    const notes = String(body.notes || '').trim()
    const now = new Date().toISOString()
    const id = `ORD-${Date.now().toString(36).toUpperCase()}`
    const reference = `FS-${Math.floor(1050 + Math.random() * 8900)}`
    const order: StoredOrder = {
      id,
      reference,
      status: 'paid',
      customer: { id: `u-${Date.now().toString(36)}`, name: customerName, phone: phone || 'Walk-in' },
      lines: [
        {
          itemId: `walkin-${Date.now().toString(36)}`,
          title: product,
          optionLabels: ['Walk-in order'],
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
          ...(notes ? { personalisation: notes } : {}),
          provider: 'Fidelity Operations Desk',
        },
      ],
      subtotal: amount,
      deliveryFee: 0,
      total: amount,
      delivery: {
        recipientName: customerName,
        phone: phone || 'Walk-in',
        town: 'Harare',
        address: notes || 'Branch walk-in pickup',
        neededBy: now.slice(0, 10),
        ...(notes ? { notes } : {}),
      },
      payment: {
        method,
        status: 'paid',
        reference: `PAY-WALKIN-${Math.floor(1000 + Math.random() * 9000)}`,
        amount,
        paidAt: now,
      },
      events: [{ at: now, label: `Walk-in order recorded (${method.toUpperCase()})` }],
      scoped: false,
      shared: false,
      actions: ['confirmed'],
      createdAt: now,
    }
    const all = listStoredOrders()
    all.unshift(order)
    saveStoredOrders(all)

    if (phone && phone.startsWith('+')) {
      const smsProvider = createSmsProvider()
      void smsProvider.send(phone, `Fidelity Life: Walk-in order ${reference} for ${product} ($${amount.toFixed(2)}) confirmed. Thank you.`).catch(() => {})
      void sendWhatsAppAlert(phone, 'custom', {
        customMessage: `🌿 *Fidelity Life Assurance — Walk-in Order Confirmed*\n\nReference: *${reference}*\nCustomer: *${customerName}*\nItem: *${product}*\nAmount: *$${amount.toFixed(2)}* (${method.toUpperCase()})\n\nThank you for trusting Fidelity Life Assurance.`,
      })
    }

    res.status(201).json(order)
  })

  // PATCH /api/admin/orders/:id
  router.patch('/orders/:id', async (req, res) => {
    const { id } = req.params
    const nextStatus = String(req.body?.status || '')
    const all = listStoredOrders()
    const idx = all.findIndex((o) => o.id === id)
    if (idx === -1) {
      res.status(404).json({ code: 'not_found', message: 'Order not found.' })
      return
    }
    const current = all[idx]
    const updated: StoredOrder = {
      ...current,
      status: nextStatus || current.status,
      events: [...current.events, { at: new Date().toISOString(), label: `Status updated to ${nextStatus}` }],
      actions: nextStatus === 'confirmed' ? ['in_progress'] : nextStatus === 'in_progress' ? ['delivered'] : [],
    }
    all[idx] = updated
    saveStoredOrders(all)
    res.json(updated)
  })

  // GET /api/admin/customers
  router.get('/customers', async (_req, res) => {
    const requests = listStoredRequests()
    const orders = listStoredOrders()
    const users = listFallbackUsers()
    const byId = new Map<string, any>()

    for (const u of users) {
      const userReqs = requests.filter((r) => r.customer.id === u.id || (u.phone && r.customer.phone === u.phone))
      const userOrds = orders.filter((o) => o.customer.id === u.id || (u.phone && o.customer.phone === u.phone))
      byId.set(u.id, {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        policyNumber: u.id === 'u-moyo' ? 'FLA-POL-8821' : undefined,
        policyStatus: u.id === 'u-moyo' ? 'active' : undefined,
        requestCount: userReqs.length,
        openRequests: userReqs.filter((r) => r.status !== 'complete' && r.status !== 'cancelled').length,
        orderCount: userOrds.length,
        memorialCount: u.id === 'u-moyo' ? 1 : 0,
        totalSpend: userOrds.reduce((sum, o) => sum + (o.total || 0), 0),
      })
    }

    if (!byId.has('u-munemo')) {
      byId.set('u-munemo', {
        id: 'u-munemo',
        name: 'Grace Munemo',
        phone: '+263774888999',
        requestCount: 1,
        openRequests: 1,
        orderCount: 1,
        memorialCount: 0,
        totalSpend: 1650,
      })
    }

    res.json(Array.from(byId.values()))
  })

  // GET /api/admin/customers/:id
  router.get('/customers/:id', async (req, res) => {
    const { id } = req.params
    const user = findFallbackUserById(id)
    const requests = listStoredRequests().filter((r) => r.customer.id === id || (user?.phone && r.customer.phone === user.phone))
    const orders = listStoredOrders().filter((o) => o.customer.id === id || (user?.phone && o.customer.phone === user.phone))
    if (!user && id !== 'u-munemo') {
      res.status(404).json({ code: 'not_found', message: 'Customer not found.' })
      return
    }
    const base = user
      ? { id: user.id, name: user.name, phone: user.phone, email: user.email }
      : { id: 'u-munemo', name: 'Grace Munemo', phone: '+263774888999' }
    res.json({
      ...base,
      requestCount: requests.length,
      openRequests: requests.filter((r) => r.status !== 'complete' && r.status !== 'cancelled').length,
      orderCount: orders.length,
      memorialCount: 0,
      totalSpend: orders.reduce((sum, o) => sum + (o.total || 0), 0),
      requests,
      orders,
      memorials: [],
    })
  })

  // GET /api/admin/providers
  router.get('/providers', async (_req, res) => {
    res.json([
      {
        id: 'harare-funeral-care',
        name: 'Harare Funeral Care',
        providerType: 'Funeral director',
        contactPerson: 'Chipo Dube',
        phone: '+263773000222',
        email: 'hararefc@fidelitylife.co.zw',
        city: 'Harare',
        province: 'Harare',
        isActive: true,
        productCount: 12,
        openAssignments: 1,
        completedAssignments: 4,
        orderCount: 3,
        revenue: 4200,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'bulawayo-memorial',
        name: 'Bulawayo Memorial & Cremations',
        providerType: 'Funeral director',
        contactPerson: 'Dumiso Sibanda',
        phone: '+263772111333',
        email: 'info@bulawayomemorial.co.zw',
        city: 'Bulawayo',
        province: 'Bulawayo',
        isActive: true,
        productCount: 8,
        openAssignments: 0,
        completedAssignments: 6,
        orderCount: 2,
        revenue: 2800,
        createdAt: new Date().toISOString(),
      },
    ])
  })

  // GET /api/admin/activity
  router.get('/activity', async (_req, res) => {
    res.json([
      {
        id: 'act-1',
        at: new Date(Date.now() - 1800000).toISOString(),
        actorName: 'Super Admin',
        actorRole: 'admin',
        action: 'assign',
        entityType: 'request',
        entityRef: 'AR-1049',
        summary: 'Assigned AR-1049 to Harare Funeral Care',
      },
      {
        id: 'act-2',
        at: new Date(Date.now() - 7200000).toISOString(),
        actorName: 'Operations Lead',
        actorRole: 'admin',
        action: 'create',
        entityType: 'order',
        entityRef: 'ORD-101',
        summary: 'Standard Oak Casket order processed for Rutendo Moyo',
      },
    ])
  })

  return router
}
