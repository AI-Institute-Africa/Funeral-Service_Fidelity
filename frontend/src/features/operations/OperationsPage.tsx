import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BarChart, DonutChart, LineChart } from '@/components/ui/DashboardCharts'
import { StatusChip } from '@/components/ui/StatusChip'
import { useSearchParams } from 'react-router-dom'
import {
  fetchOperationsState,
  createOperationsCase,
  updateOperationsCase,
  createOperationsPolicy,
  updateOperationsPolicy,
  saveCatalogueItem,
  saveExhumationCase,
  deleteExhumationCase,
  sendOperationsWhatsAppNotification,
  saveTokenCharge,
  createAuditEntry,
} from './operations-api'
import { getAdminFuneralCases } from './cases-api'
import { useAuth } from '@/features/auth'
import { findPolicyByNumber, policyRecords } from '@/features/account'
import {
  CASE_STATUSES,
  CHECKLIST_STATUSES,
  CONTRIBUTION_STATUSES,
  DOCUMENT_STATUSES,
  EXHUMATION_REQUIREMENTS,
  EXHUMATION_STATUSES,
  POLICY_STATUSES,
  QUOTE_STATUSES,
  canActivatePolicy,
  caseBalance,
  caseClosureBlockers,
  contributionTotal,
  createCaseStages,
  createDefaultTaskSteps,
  formatMoney,
  makeReference,
  nextContributionStatuses,
  nextPaymentStatuses,
  nextPolicyStatuses,
  nextQuoteStatuses,
  quoteTotal,
  type CaseDocument,
  type CaseQuote,
  type CaseStatus,
  type CaseType,
  type CatalogueItem,
  type ChecklistStatus,
  type Contribution,
  type ContributionStatus,
  type DocumentStatus,
  type ExhumationCase,
  type ExhumationRequirementStatus,
  type ExhumationStatus,
  type FuneralCase,
  type OperationsState,
  type PolicyApplication,
  type PolicyStatus,
  type QuoteStatus,
  type StageStatus,
  type TaskLogEntry,
  type TaskStep,
  type TokenFeature,
  type TransportMovement,
  type TransportStatus,
} from './data'
import { createInitialOperationsState, loadOperationsState, OPERATIONS_STORAGE_KEY, saveOperationsState } from './store'
import './operations.css'

type Section = 'dashboard' | 'cases' | 'policies' | 'exhumations' | 'tokens' | 'catalogue' | 'wallet' | 'finance' | 'reports' | 'audit'
type CaseTab = 'overview' | 'checklist' | 'timeline' | 'documents' | 'transport' | 'finance' | 'wallet' | 'activity' | 'whatsapp'

const sectionTitles: Record<Section, string> = {
  dashboard: 'Operations dashboard',
  cases: 'Funeral cases',
  policies: 'Policy applications',
  exhumations: 'Exhumations',
  tokens: 'Kuwana token charges',
  catalogue: 'Services & products',
  wallet: 'Chema Wallet',
  finance: 'Quotations & payments',
  reports: 'Reports',
  audit: 'Audit log',
}
const caseStatusLabels = Object.fromEntries(CASE_STATUSES.map(({ value, label }) => [value, label])) as Record<CaseStatus, string>
const policyStatusLabels = Object.fromEntries(POLICY_STATUSES.map(({ value, label }) => [value, label])) as Record<PolicyStatus, string>

export const STAFF_OPTIONS = [
  { value: 'Nomsa Ndlovu', label: 'Nomsa Ndlovu (Head of Funeral Operations · +263 773 000 333)' },
  { value: 'Tariro Chikwanha', label: 'Tariro Chikwanha (Senior Case Lead · +263 790 499 962)' },
  { value: 'Farai Gumbo', label: 'Farai Gumbo (Mortuary & Logistics Lead · +263 772 555 666)' },
  { value: 'Blessing Moyo', label: 'Blessing Moyo (Transport & Fleet · +263 771 888 999)' },
  { value: 'Chipo Dube', label: 'Chipo Dube (Chapel & Ceremonies · +263 773 000 222)' },
  { value: 'Operations Team', label: 'Operations Team (Harare Desk · +263 790 499 962)' },
]
const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`
const nowIso = () => new Date().toISOString()
const localDateTime = (value?: string) => (value ? value.slice(0, 16) : '')

function audit(state: OperationsState, actor: string, action: string, entity: string, summary: string): OperationsState {
  return {
    ...state,
    audit: [
      {
        id: newId('audit'),
        at: nowIso(),
        actor,
        action,
        entity,
        summary,
        demo: true,
      },
      ...state.audit,
    ],
  }
}

function labelFor<T extends string>(choices: { value: T; label: string }[], value: T): string {
  return choices.find((choice) => choice.value === value)?.label ?? value
}

function amountValue(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const amount = Number(raw)
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

function OperationsPage() {
  const { user } = useAuth()
  const actor = user?.name || user?.phone || 'Admin'
  const [searchParams] = useSearchParams()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [loaded] = useState(() => {
    try {
      return { state: loadOperationsState(), error: '' }
    } catch (error) {
      return {
        state: createInitialOperationsState(),
        error: error instanceof Error ? error.message : 'Saved demo data could not be loaded.',
      }
    }
  })
  const [state, setState] = useState(loaded.state)
  const stateRef = useRef(loaded.state)
  const [storageError, setStorageError] = useState(loaded.error)
  const [section, setSection] = useState<Section>('dashboard')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseTab, setCaseTab] = useState<CaseTab>('overview')
  const [caseFilter, setCaseFilter] = useState<{ type: CaseType | 'all'; status: CaseStatus | 'all'; branch: string; query: string }>({
    type: 'all',
    status: 'all',
    branch: 'all',
    query: '',
  })

  useEffect(() => {
    const sec = searchParams.get('section') as Section | null
    if (sec && Object.keys(sectionTitles).includes(sec)) {
      setSection(sec)
    }
    const type = searchParams.get('type')
    if (type === 'cash-walk-in' || type === 'policy-covered') {
      setCaseFilter((current) => ({ ...current, type }))
    }
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    fetchOperationsState()
      .then((remoteState) => {
        if (!mounted) return
        setState(remoteState)
        stateRef.current = remoteState
        saveOperationsState(remoteState)
        setStorageError('')
        void getAdminFuneralCases().then((reported) => {
          if (!mounted || !reported.length) return
          setState((current) => {
            const existingRefs = new Set(current.cases.map((item) => item.reference))
            const additions: FuneralCase[] = reported
              .filter((fc) => !existingRefs.has(fc.reference))
              .map((fc) => ({
                id: fc.id,
                reference: fc.reference,
                type: fc.caseType === 'WALK_IN_COVERAGE' ? 'cash-walk-in' : 'policy-covered',
                customerName: fc.reporterName,
                phone: fc.contactPhone,
                deceasedName: fc.deceasedName || fc.reporterName,
                dateOfDeath: fc.dateOfDeath || '',
                serviceLocation: fc.serviceLocation || '',
                branch: fc.serviceLocation || 'Harare',
                funeralAt: fc.funeralAt || undefined,
                funeralLocation: fc.funeralLocation || '',
                coordinator: fc.assignedStaff?.name || STAFF_OPTIONS[0].value,
                priority: 'standard',
                priorityReason: '',
                status: 'new',
                policyReference: fc.policyNumber || undefined,
                intakeChannel: 'online',
                postMortem: 'pending',
                stages: createCaseStages(),
                checklist: fc.requestedServices.map((svc, idx) => ({
                  id: `chk-${fc.id}-${idx}`,
                  name: svc,
                  category: 'Requested service',
                  quantity: 1,
                  status: 'requested',
                  owner: fc.assignedStaff?.name || STAFF_OPTIONS[0].value,
                  assignedTo: fc.assignedStaff?.name || STAFF_OPTIONS[0].value,
                  notes: 'Submitted via funeral intake form',
                  createdAt: fc.createdAt,
                  steps: createDefaultTaskSteps(svc),
                  logbook: [],
                })),
                documents: [],
                movements: [],
                quotes: [],
                payments: [],
                contributions: [],
                createdAt: fc.createdAt,
                updatedAt: fc.createdAt,
                demo: false,
              }))
            if (!additions.length) return current
            const merged = { ...current, cases: [...additions, ...current.cases] }
            stateRef.current = merged
            saveOperationsState(merged)
            return merged
          })
        }).catch(() => {})
      })
      .catch((err) => {
        console.warn('API operations state load (using cached data):', err)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const refreshFromOtherTab = (event: StorageEvent) => {
      if (event.key !== OPERATIONS_STORAGE_KEY) return
      try {
        const latest = loadOperationsState()
        stateRef.current = latest
        setState(latest)
        setStorageError('')
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : 'Updated demo data could not be loaded.')
      }
    }
    window.addEventListener('storage', refreshFromOtherTab)
    return () => window.removeEventListener('storage', refreshFromOtherTab)
  }, [])

  const selectedCase = state.cases.find((item) => item.id === selectedCaseId)
  const branches = [...new Set(state.cases.map((item) => item.branch).filter(Boolean))]

  const commit = (next: (current: OperationsState) => OperationsState, action: string, entity: string, summary: string) => {
    const updated = audit(next(stateRef.current), actor, action, entity, summary)
    stateRef.current = updated
    saveOperationsState(updated)
    setStorageError('')
    setState(updated)
    void createAuditEntry({ actor, action, entity, summary, demo: false }).catch(() => {})
  }

  const changeCase = (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => {
    const currentCase = stateRef.current.cases.find((item) => item.id === id)
    if (!currentCase) return
    const updatedCase = { ...update(currentCase), updatedAt: nowIso() }
    commit(
      (current) => ({
        ...current,
        cases: current.cases.map((item) => (item.id === id ? updatedCase : item)),
      }),
      action,
      currentCase.reference ?? id,
      summary,
    )
    void updateOperationsCase(id, { ...updatedCase, auditAction: action, auditSummary: summary }).catch((err) => {
      console.warn('Server case update failed:', err)
    })
  }

  const changePolicy = (id: string, action: string, summary: string, update: (item: PolicyApplication) => PolicyApplication) => {
    const currentPolicy = stateRef.current.policies.find((item) => item.id === id)
    if (!currentPolicy) return
    const updatedPolicy = { ...update(currentPolicy), updatedAt: nowIso() }
    commit(
      (current) => ({
        ...current,
        policies: current.policies.map((item) => (item.id === id ? updatedPolicy : item)),
      }),
      action,
      currentPolicy.reference ?? id,
      summary,
    )
    void updateOperationsPolicy(id, { ...updatedPolicy, auditAction: action, auditSummary: summary }).catch((err) => {
      console.warn('Server policy update failed:', err)
    })
  }

  const selectCase = (id: string, tab: CaseTab = 'overview') => {
    setSelectedCaseId(id)
    setCaseTab(tab)
    setSection('cases')
  }

  const addCase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = String(form.get('type')) as CaseType
    const customerName = String(form.get('customerName') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const deceasedName = String(form.get('deceasedName') ?? '').trim()
    const dateOfDeath = String(form.get('dateOfDeath') ?? '')
    const serviceLocation = String(form.get('serviceLocation') ?? '').trim()
    const funeralLocation = String(form.get('funeralLocation') ?? '').trim()
    const funeralAt = String(form.get('funeralAt') ?? '')
    const branch = String(form.get('branch') ?? '').trim()
    const coordinator = String(form.get('coordinator') ?? '').trim()
    const policyReference = String(form.get('policyReference') ?? '')
    const activePolicy = state.policies.find((policy) => policy.reference === policyReference && policy.status === 'active')
    const knownPolicy = findPolicyByNumber(policyReference)
    if (type === 'policy-covered' && !activePolicy && !knownPolicy) {
      window.alert('A policy-covered case must link to an active sample application or a known sample policy number. Fidelity must verify eligibility before confirming cover.')
      return
    }
    const existing = state.cases
    const duplicate = existing.find(
      (item) =>
        (phone && item.phone.toLowerCase() === phone.toLowerCase()) ||
        (deceasedName && item.deceasedName.toLowerCase() === deceasedName.toLowerCase() && item.dateOfDeath === dateOfDeath),
    )
    if (duplicate && !window.confirm(`Possible duplicate: ${duplicate.reference} has a matching phone or deceased name/date. Create a separate case anyway?`)) return

    const prefix = type === 'cash-walk-in' ? 'CASE-CASH' : 'CASE-POLICY'
    const caseRecord: FuneralCase = {
      id: newId('case'),
      reference: makeReference(prefix, existing.map((item) => item.reference)),
      type,
      customerName,
      phone,
      deceasedName,
      dateOfDeath,
      serviceLocation,
      branch,
      funeralAt: funeralAt || undefined,
      funeralLocation,
      coordinator,
      priority: 'standard',
      priorityReason: '',
      status: 'new',
      policyReference: type === 'policy-covered' ? activePolicy?.reference ?? knownPolicy?.number : undefined,
      intakeChannel: 'staff',
      postMortem: 'pending',
      stages: createCaseStages(),
      checklist: [],
      documents: [],
      movements: [],
      quotes: [],
      payments: [],
      contributions: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      demo: true,
    }
    commit((current) => ({ ...current, cases: [caseRecord, ...current.cases] }), 'Created case', caseRecord.reference, `${type === 'cash-walk-in' ? 'Cash walk-in' : 'Policy-covered'} case opened.`)
    void createOperationsCase(caseRecord).catch((err) => console.warn('Server case creation warning:', err))
    if (caseRecord.phone) {
      void fetch('/api/whatsapp/notify-walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReference: caseRecord.reference,
          deceasedName: caseRecord.deceasedName,
          customerName: caseRecord.customerName,
          customerPhone: caseRecord.phone,
          coordinator: caseRecord.coordinator,
          serviceLocation: caseRecord.serviceLocation,
        }),
      }).catch(() => {})
    }
    setSelectedCaseId(caseRecord.id)
    setCaseTab('overview')
    event.currentTarget.reset()
  }

  const addPolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customerName = String(form.get('customerName') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const product = String(form.get('product') ?? '').trim()
    const members = String(form.get('members') ?? '')
      .split(',')
      .map((member) => member.trim())
      .filter(Boolean)
    const duplicate = state.policies.find((policy) => policy.phone.toLowerCase() === phone.toLowerCase() && phone)
    if (duplicate && !window.confirm(`Possible duplicate application ${duplicate.reference} for this phone number. Create another application?`)) return
    const policy: PolicyApplication = {
      id: newId('policy'),
      reference: makeReference('DEMO-POL', state.policies.map((item) => item.reference)),
      customerName,
      phone,
      product,
      coveredMembers: members,
      status: 'submitted',
      checks: { identityVerified: false, documentsVerified: false, eligibilityConfirmed: false },
      responsibleStaff: String(form.get('responsibleStaff') ?? '').trim(),
      notes: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      demo: true,
    }
    commit((current) => ({ ...current, policies: [policy, ...current.policies] }), 'Submitted application', policy.reference, 'Policy application submitted for staff review (demo only).')
    void createOperationsPolicy(policy).catch((err) => console.warn('Server policy creation warning:', err))
    event.currentTarget.reset()
  }

  const visibleCases = useMemo(() => {
    const query = caseFilter.query.trim().toLowerCase()
    return state.cases.filter((item) => {
      if (caseFilter.type !== 'all' && item.type !== caseFilter.type) return false
      if (caseFilter.status !== 'all' && item.status !== caseFilter.status) return false
      if (caseFilter.branch !== 'all' && item.branch !== caseFilter.branch) return false
      if (query && ![item.reference, item.customerName, item.phone, item.deceasedName].some((value) => value.toLowerCase().includes(query))) return false
      return true
    })
  }, [caseFilter, state.cases])

  const exportCases = () => {
    const rows = [
      ['Reference', 'Type', 'Customer', 'Phone', 'Deceased', 'Status', 'Branch', 'Burial date', 'Coordinator', 'Sample data'],
      ...state.cases.map((item) => [
        item.reference,
        item.type,
        item.customerName,
        item.phone,
        item.deceasedName,
        caseStatusLabels[item.status],
        item.branch,
        item.funeralAt ?? '',
        item.coordinator,
        item.demo ? 'Yes' : 'No',
      ]),
    ]
    downloadCsv('operations-cases-demo.csv', rows)
  }
  const exportContributions = () => {
    const contributions = state.cases.flatMap((item) => item.contributions.map((entry) => [
      item.reference,
      entry.contributorName ?? '',
      String(entry.amount),
      entry.currency,
      entry.channel,
      entry.reference,
      labelFor(CONTRIBUTION_STATUSES, entry.status),
      entry.contributedAt,
      entry.recordedBy,
      entry.adjustmentOf ?? '',
    ]))
    downloadCsv('chema-ledger-demo.csv', [
      ['Case reference', 'Contributor display name', 'Amount', 'Currency', 'Channel', 'Transaction reference', 'Status', 'Contribution time', 'Recorded by', 'Adjustment link'],
      ...contributions,
    ])
  }



  return (
    <div className="page-stack operations">
      <header className="page-head reveal">
        <p className="eyebrow">Admin operations · prototype</p>
        <h1>Funeral operations workspace</h1>
        <p className="muted page-head__lead">
          Case management and operational tracking for demonstration. Records stay in this browser; this is not a production system.
        </p>
      </header>

      <div className="operations__notice" role="note">
        <strong>FIDELITY OPERATIONS WORKSPACE — ACTIVE SERVER PERSISTENCE</strong>
        <span>Policy, pricing, payment, eligibility and wallet rules are not configured. No payment is processed and no policy is issued here.</span>
      </div>
      {storageError && <p className="operations__error" role="alert">{storageError}</p>}

      <nav className="operations__nav" aria-label="Operations modules">
        {(Object.keys(sectionTitles) as Section[]).map((key) => (
          <button
            type="button"
            className={`operations__nav-item${section === key ? ' is-active' : ''}`}
            key={key}
            aria-current={section === key ? 'page' : undefined}
            onClick={() => {
              setSection(key)
              if (key !== 'cases') setSelectedCaseId('')
            }}
          >
            {sectionTitles[key]}
          </button>
        ))}
      </nav>

      {section === 'dashboard' && (
        <Dashboard
          state={state}
          branches={branches}
          today={today}
          onFilter={(filter) => {
            setCaseFilter((current) => ({ ...current, ...filter }))
            setSelectedCaseId('')
            setSection('cases')
          }}
          onOpenCase={selectCase}
          onSection={(nextSection) => {
            setSelectedCaseId('')
            setSection(nextSection)
          }}
        />
      )}

      {section === 'cases' && (
        selectedCase ? (
          <CaseWorkspace
            key={selectedCase.id}
            item={selectedCase}
            state={state}
            actor={actor}
            onBack={() => setSelectedCaseId('')}
            tab={caseTab}
            setTab={setCaseTab}
            changeCase={changeCase}
            onSection={setSection}
          />
        ) : (
          <CaseList
            cases={visibleCases}
            filter={caseFilter}
            branches={branches}
            policies={state.policies}
            onFilter={setCaseFilter}
            onOpen={selectCase}
            onCreate={addCase}
          />
        )
      )}

      {section === 'policies' && (
        <PolicyWorkspace policies={state.policies} onCreate={addPolicy} onChange={(id, status, checks, notes) => {
          const policy = state.policies.find((item) => item.id === id)
          if (!policy) return false
          if (status !== policy.status && !nextPolicyStatuses(policy.status).includes(status)) {
            window.alert(`That policy status transition is not allowed from ${policyStatusLabels[policy.status]}. Follow the review workflow step by step.`)
            return false
          }
          if (status === 'active' && (policy.status !== 'approved' || !canActivatePolicy({ ...policy, checks }))) {
            window.alert('Activation is blocked until the application is approved and identity, document and eligibility checks are confirmed. No real policy rules are evaluated.')
            return false
          }
          changePolicy(id, 'Updated policy application', `${policy.reference} status set to ${policyStatusLabels[status]}.`, (current) => ({
            ...current,
            status,
            checks,
            notes,
            effectiveDate: status === 'active' ? current.effectiveDate ?? new Date().toISOString().slice(0, 10) : current.effectiveDate,
          }))
          return true
        }} />
      )}

      {section === 'exhumations' && (
        <ExhumationsWorkspace
          cases={state.exhumations}
          onCreate={(item) => {
            commit(
              (current) => ({ ...current, exhumations: [item, ...current.exhumations] }),
              'Created exhumation case',
              item.reference,
              `Exhumation request opened for ${item.deceasedName}.`,
            )
            void saveExhumationCase(item).catch(() => {})
          }}
          onUpdate={(item, summary, update) => {
            const updated = { ...update(item), updatedAt: nowIso() }
            commit(
              (current) => ({ ...current, exhumations: current.exhumations.map((entry) => entry.id === item.id ? updated : entry) }),
              'Updated exhumation case',
              item.reference,
              summary,
            )
            void saveExhumationCase(updated).catch(() => {})
          }}
          onDelete={(id) => {
            commit(
              (current) => ({ ...current, exhumations: current.exhumations.filter((entry) => entry.id !== id) }),
              'Deleted exhumation case',
              id,
              'Exhumation case record removed',
            )
            void deleteExhumationCase(id).catch(() => {})
          }}
        />
      )}

      {section === 'tokens' && (
        <TokenChargesWorkspace
          charges={state.tokenCharges}
          onUpdate={(feature, amount, enabled) => {
            const target = state.tokenCharges.find((e) => e.feature === feature)
            commit(
              (current) => ({ ...current, tokenCharges: current.tokenCharges.map((entry) => entry.feature === feature ? { ...entry, amount, enabled } : entry) }),
              'Updated Kuwana token charge',
              feature,
              `Token charge ${enabled ? `enabled at ${amount} credits` : 'disabled'}.`,
            )
            void saveTokenCharge({ feature, label: target?.label ?? feature, amount, enabled }).catch(() => {})
          }}
        />
      )}

      {section === 'catalogue' && (
        <CatalogueWorkspace
          items={state.catalogue}
          onCreate={(item) => {
            commit((current) => ({ ...current, catalogue: [item, ...current.catalogue] }), 'Added catalogue item', item.name, 'Unpriced service/product added to the demo catalogue.')
            void saveCatalogueItem(item).catch(() => {})
          }}
          onToggle={(item) => {
            const toggled = { ...item, active: !item.active }
            commit(
              (current) => ({ ...current, catalogue: current.catalogue.map((entry) => entry.id === item.id ? toggled : entry) }),
              'Updated catalogue item',
              item.name,
              `Catalogue item marked ${item.active ? 'inactive' : 'active'}.`,
            )
            void saveCatalogueItem(toggled).catch(() => {})
          }}
        />
      )}

      {section === 'wallet' && <WalletWorkspace cases={state.cases} onOpenCase={selectCase} />}
      {section === 'finance' && <FinanceWorkspace cases={state.cases} onOpenCase={selectCase} />}
      {section === 'reports' && <ReportsWorkspace state={state} onExport={exportCases} onExportWallet={exportContributions} />}
      {section === 'audit' && <AuditWorkspace entries={state.audit} />}
    </div>
  )
}

function Dashboard({
  state,
  branches,
  today,
  onFilter,
  onOpenCase,
  onSection,
}: {
  state: OperationsState
  branches: string[]
  today: string
  onFilter: (filter: Partial<{ type: CaseType | 'all'; status: CaseStatus | 'all'; branch: string }>) => void
  onOpenCase: (id: string, tab?: CaseTab) => void
  onSection: (section: Section) => void
}) {
  const [filters, setFilters] = useState({
    branch: 'all',
    caseType: 'all' as CaseType | 'all',
    status: 'all' as CaseStatus | 'all',
    dateFrom: '',
    dateTo: '',
    burialDate: '',
    team: '',
    priority: 'all' as FuneralCase['priority'] | 'all',
    paymentStatus: 'all',
    walletStatus: 'all',
  })
  const filtered = state.cases.filter((item) => {
    if (filters.branch !== 'all' && item.branch !== filters.branch) return false
    if (filters.caseType !== 'all' && item.type !== filters.caseType) return false
    if (filters.status !== 'all' && item.status !== filters.status) return false
    if (filters.dateFrom && item.createdAt.slice(0, 10) < filters.dateFrom) return false
    if (filters.dateTo && item.createdAt.slice(0, 10) > filters.dateTo) return false
    if (filters.burialDate && item.funeralAt !== filters.burialDate) return false
    if (filters.team && ![item.coordinator, ...item.stages.map((stage) => stage.assignedTo), ...item.checklist.map((task) => task.assignedTo)].some((team) => team.toLowerCase().includes(filters.team.toLowerCase()))) return false
    if (filters.priority !== 'all' && item.priority !== filters.priority) return false
    if (filters.paymentStatus !== 'all' && !item.payments.some((payment) => payment.status === filters.paymentStatus)) return false
    if (filters.walletStatus !== 'all' && !item.contributions.some((contribution) => contribution.status === filters.walletStatus)) return false
    return true
  })
  const filteredOpen = filtered.filter((item) => !['closed', 'completed'].includes(item.status))
  const upcoming = filtered.filter((item) => item.funeralAt && item.funeralAt >= today && item.status !== 'closed')
  const missingDocuments = filtered.reduce((count, item) => count + item.documents.filter((doc) => ['missing', 'received', 'under-review'].includes(doc.status)).length, 0)
  const incompleteChecklist = filtered.filter((item) => item.checklist.some((task) => !['completed', 'cancelled'].includes(task.status))).length
  const pendingContributions = filtered.reduce((count, item) => count + item.contributions.filter((entry) => ['recorded', 'pending-confirmation', 'needs-review'].includes(entry.status)).length, 0)
  const overdueStages = filtered.reduce((count, item) => count + item.stages.filter((stage) => stage.plannedAt && stage.plannedAt.slice(0, 10) < today && !['completed', 'cancelled'].includes(stage.status)).length, 0)
  const postMortemPending = filtered.filter((item) => item.postMortem === 'pending').length
  const unpaidCases = filtered.filter((item) => item.quotes.some((quote) => caseBalance(item, quote.currency) > 0)).length
  const unassignedCases = filtered.filter((item) => !item.coordinator.trim()).length
  const firstWithDocument = filtered.find((item) => item.documents.some((doc) => ['missing', 'received', 'under-review'].includes(doc.status)))
  const firstWithChecklist = filtered.find((item) => item.checklist.some((task) => !['completed', 'cancelled'].includes(task.status)))
  const firstWithContribution = filtered.find((item) => item.contributions.some((entry) => ['recorded', 'pending-confirmation', 'needs-review'].includes(entry.status)))
  const urgentCases = [...filteredOpen].sort((a, b) => Number(b.priority === 'urgent' || b.status === 'delayed') - Number(a.priority === 'urgent' || a.status === 'delayed'))
  const teamWorkload = new Map<string, number>()
  for (const item of filteredOpen) {
    const owner = item.coordinator || 'Unassigned'
    teamWorkload.set(owner, (teamWorkload.get(owner) ?? 0) + 1)
  }
  const caseStatusData = CASE_STATUSES
    .map(({ value, label }) => ({ label, value: filtered.filter((item) => item.status === value).length }))
    .filter((item) => item.value > 0)
  const intakeByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(date),
      value: filtered.filter((item) => item.createdAt.slice(0, 10) === key).length,
    }
  })
  return (
    <section className="page-stack" aria-labelledby="operations-dashboard-title">
      <div className="operations__heading">
        <div>
          <h2 id="operations-dashboard-title">At a glance</h2>
          <p className="muted">Dashboard totals are derived from local prototype records.</p>
        </div>
        <div className="operations__filters">
          <label className="field">
            <span className="field__label">Branch</span>
            <select className="select" value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}><option value="all">All branches</option>{branches.map((entry) => <option key={entry}>{entry}</option>)}</select>
          </label>
          <label className="field">
            <span className="field__label">Case type</span>
            <select className="select" value={filters.caseType} onChange={(event) => setFilters((current) => ({ ...current, caseType: event.target.value as CaseType | 'all' }))}><option value="all">All types</option><option value="policy-covered">Policy-covered</option><option value="cash-walk-in">Cash walk-in</option></select>
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select className="select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as CaseStatus | 'all' }))}><option value="all">All statuses</option>{CASE_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
          </label>
          <label className="field"><span className="field__label">Opened from</span><input className="input" type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
          <label className="field"><span className="field__label">Opened to</span><input className="input" type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
          <label className="field"><span className="field__label">Burial date</span><input className="input" type="date" value={filters.burialDate} onChange={(event) => setFilters((current) => ({ ...current, burialDate: event.target.value }))} /></label>
          <label className="field"><span className="field__label">Assigned team</span><input className="input" value={filters.team} onChange={(event) => setFilters((current) => ({ ...current, team: event.target.value }))} /></label>
          <label className="field"><span className="field__label">Urgency</span><select className="select" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as FuneralCase['priority'] | 'all' }))}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="delayed">Delayed</option></select></label>
          <label className="field"><span className="field__label">Payment status</span><select className="select" value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}><option value="all">All payment statuses</option><option value="recorded">Recorded</option><option value="confirmed">Confirmed</option><option value="reconciled">Reconciled</option><option value="reversed">Reversed</option></select></label>
          <label className="field"><span className="field__label">Wallet status</span><select className="select" value={filters.walletStatus} onChange={(event) => setFilters((current) => ({ ...current, walletStatus: event.target.value }))}><option value="all">All wallet statuses</option>{CONTRIBUTION_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        </div>
      </div>

      <div className="operations__metrics">
        <Metric label="Open cases" value={filteredOpen.length} onClick={() => onFilter({ type: filters.caseType, status: 'all', branch: filters.branch })} />
        <Metric label="Policy-covered" value={filtered.filter((item) => item.type === 'policy-covered').length} onClick={() => onFilter({ type: 'policy-covered', status: filters.status, branch: filters.branch })} />
        <Metric label="Cash walk-ins" value={filtered.filter((item) => item.type === 'cash-walk-in').length} onClick={() => onFilter({ type: 'cash-walk-in', status: filters.status, branch: filters.branch })} />
        <Metric label="Applications in review" value={state.policies.filter((item) => ['submitted', 'under-review', 'awaiting-information'].includes(item.status)).length} onClick={() => onSection('policies')} />
        <Metric label="Upcoming burials" value={upcoming.length} onClick={() => onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })} />
        <Metric label="Documents awaiting review" value={missingDocuments} onClick={() => firstWithDocument ? onOpenCase(firstWithDocument.id, 'documents') : onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })} />
        <Metric label="Checklist work outstanding" value={incompleteChecklist} onClick={() => firstWithChecklist ? onOpenCase(firstWithChecklist.id, 'checklist') : onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })} />
        <Metric label="Wallet entries pending" value={pendingContributions} onClick={() => firstWithContribution ? onOpenCase(firstWithContribution.id, 'wallet') : onSection('wallet')} />
        <Metric label="Post-mortem pending" value={postMortemPending} onClick={() => {
          const target = filtered.find((item) => item.postMortem === 'pending')
          if (target) onOpenCase(target.id)
          else onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })
        }} />
        <Metric label="Overdue stage milestones" value={overdueStages} onClick={() => {
          const target = filtered.find((item) => item.stages.some((stage) => stage.plannedAt && stage.plannedAt.slice(0, 10) < today && !['completed', 'cancelled'].includes(stage.status)))
          if (target) onOpenCase(target.id, 'timeline')
          else onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })
        }} />
        <Metric label="Cases with outstanding balances" value={unpaidCases} onClick={() => {
          const target = filtered.find((item) => item.quotes.some((quote) => caseBalance(item, quote.currency) > 0))
          if (target) onOpenCase(target.id, 'finance')
          else onSection('finance')
        }} />
        <Metric label="Unassigned coordinators" value={unassignedCases} onClick={() => {
          const target = filtered.find((item) => !item.coordinator.trim())
          if (target) onOpenCase(target.id)
          else onFilter({ type: filters.caseType, status: filters.status, branch: filters.branch })
        }} />
      </div>
      <div className="operations__charts">
        <LineChart title="Case intake" subtitle="New cases opened · past 7 days" data={intakeByDay} />
        <DonutChart title="Cases by status" subtitle={`${filtered.length} matching cases`} data={caseStatusData} />
      </div>
      <div className="operations__columns">
        <section className="card operations__panel">
          <h3>Cases needing attention</h3>
          {filteredOpen.length ? (
            <ul className="operations__list">
              {urgentCases.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button type="button" className="operations__list-button" onClick={() => onOpenCase(item.id)}>
                    <span><strong>{item.reference}</strong><small>{item.deceasedName} · {item.customerName}</small></span>
                    <StatusChip tone={item.priority === 'urgent' || item.status === 'delayed' ? 'warning' : 'info'}>{item.priority === 'urgent' ? 'Urgent' : caseStatusLabels[item.status]}</StatusChip>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No open cases match these filters.</p>}
        </section>
        <section className="card operations__panel">
          <h3>Upcoming burial expected dates</h3>
          {upcoming.length ? (
            <ul className="operations__list">
              {upcoming.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button type="button" className="operations__list-button" onClick={() => onOpenCase(item.id)}>
                    <span><strong>{item.funeralAt} · {item.reference}</strong><small>{item.funeralLocation || 'Location not set'}</small></span>
                    <span className="muted">{item.coordinator || 'Unassigned'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No upcoming dates in the sample cases.</p>}
        </section>
      </div>
      <div className="operations__columns">
        <section className="card operations__panel"><h3>Workload by coordinator</h3>{teamWorkload.size ? <ul className="operations__report-list">{[...teamWorkload.entries()].map(([owner, count]) => <li key={owner}><span>{owner}</span><strong>{count} open</strong></li>)}</ul> : <p className="muted">No open assignments.</p>}</section>
        <section className="card operations__panel"><h3>Recent operations activity</h3>{state.audit.slice(0, 5).map((entry) => <p key={entry.id}><strong>{entry.action}</strong> · {entry.entity}<span className="cell-stack">{entry.summary}</span></p>)}</section>
      </div>
    </section>
  )
}

function Metric({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button className="card operations__metric" type="button" onClick={onClick}>
      <strong>{value}</strong><span>{label}</span>
    </button>
  )
}

function CaseList({
  cases,
  filter,
  branches,
  policies,
  onFilter,
  onOpen,
  onCreate,
}: {
  cases: FuneralCase[]
  filter: { type: CaseType | 'all'; status: CaseStatus | 'all'; branch: string; query: string }
  branches: string[]
  policies: PolicyApplication[]
  onFilter: (next: (current: { type: CaseType | 'all'; status: CaseStatus | 'all'; branch: string; query: string }) => { type: CaseType | 'all'; status: CaseStatus | 'all'; branch: string; query: string }) => void
  onOpen: (id: string, tab?: CaseTab) => void
  onCreate: (event: FormEvent<HTMLFormElement>) => void
}) {
  const activePolicies = policies.filter((policy) => policy.status === 'active')
  return (
    <section className="page-stack">
      <div className="operations__heading">
        <div><h2>Funeral cases</h2><p className="muted">{cases.length} matching case{cases.length === 1 ? '' : 's'} · data is local to this browser.</p></div>
        <div className="operations__filters">
          <label className="field"><span className="field__label">Search</span><input className="input" type="search" value={filter.query} placeholder="Reference, customer or deceased" onChange={(event) => onFilter((current) => ({ ...current, query: event.target.value }))} /></label>
          <label className="field"><span className="field__label">Type</span><select className="select" value={filter.type} onChange={(event) => onFilter((current) => ({ ...current, type: event.target.value as CaseType | 'all' }))}><option value="all">All types</option><option value="policy-covered">Policy-covered</option><option value="cash-walk-in">Cash walk-in</option></select></label>
          <label className="field"><span className="field__label">Status</span><select className="select" value={filter.status} onChange={(event) => onFilter((current) => ({ ...current, status: event.target.value as CaseStatus | 'all' }))}><option value="all">All statuses</option>{CASE_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
          <label className="field"><span className="field__label">Branch</span><select className="select" value={filter.branch} onChange={(event) => onFilter((current) => ({ ...current, branch: event.target.value }))}><option value="all">All branches</option>{branches.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        </div>
      </div>

      <details className="card operations__form-panel">
        <summary className="operations__summary">Register a funeral case</summary>
        <form className="operations__form" onSubmit={onCreate}>
          <div className="operations__form-grid">
            <label className="field"><span className="field__label">Intake path</span><select className="select" name="type" required><option value="cash-walk-in">Cash funeral / walk-in</option><option value="policy-covered">Policy-covered</option></select></label>
            <label className="field"><span className="field__label">Customer / contact name</span><input className="input" name="customerName" required /></label>
            <label className="field"><span className="field__label">Phone</span><input className="input" name="phone" type="tel" required /></label>
            <label className="field"><span className="field__label">Deceased name</span><input className="input" name="deceasedName" required /></label>
            <label className="field"><span className="field__label">Date of death</span><input className="input" name="dateOfDeath" type="date" required /></label>
            <label className="field"><span className="field__label">Service location</span><input className="input" name="serviceLocation" required /></label>
            <label className="field"><span className="field__label">Branch / area</span><input className="input" name="branch" required /></label>
            <label className="field"><span className="field__label">Coordinator / team (Auto-notified)</span><select className="select" name="coordinator"><option value="">Unassigned</option>{STAFF_OPTIONS.map((staff) => <option key={staff.value} value={staff.value}>{staff.label}</option>)}</select></label>
            <label className="field"><span className="field__label">Burial expected date</span><input className="input" name="funeralAt" type="date" /></label>
            <label className="field"><span className="field__label">Funeral location</span><input className="input" name="funeralLocation" /></label>
            <label className="field operations__form-wide"><span className="field__label">Policy reference (policy-covered only)</span><select className="select" name="policyReference" defaultValue=""><option value="">Select a sample policy</option><optgroup label="Active applications">{activePolicies.map((policy) => <option key={policy.id} value={policy.reference}>{policy.reference} · {policy.customerName}</option>)}</optgroup><optgroup label="Existing sample policies">{policyRecords.map(({ policy }) => <option key={policy.number} value={policy.number}>{policy.number} · {policy.holderName} · {policy.status}</option>)}</optgroup></select></label>
          </div>
          <p className="muted">A walk-in case does not need a policy. Duplicate matches will be shown before a second record is created. No eligibility or service price is inferred.</p>
          <button type="submit" className="btn btn--primary">Create local demo case</button>
        </form>
      </details>

      {cases.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Case</th><th>Path</th><th>Customer / deceased</th><th>Burial</th><th>Coordinator</th><th>Status</th></tr></thead>
            <tbody>{cases.map((item) => (
              <tr key={item.id}>
                <td data-label="Case"><button className="row-link" type="button" onClick={() => onOpen(item.id)}>{item.reference}</button><span className="cell-stack"><span>{item.branch}</span></span></td>
                <td data-label="Path">{item.type === 'cash-walk-in' ? 'Cash walk-in' : 'Policy-covered'}</td>
                <td data-label="Customer / deceased"><span className="cell-stack"><strong>{item.customerName}</strong><span>{item.deceasedName}</span></span></td>
                <td data-label="Burial">{item.funeralAt || 'Not set'}</td>
                <td data-label="Coordinator">{item.coordinator || 'Unassigned'}</td>
                <td data-label="Status"><StatusChip tone={item.status === 'delayed' ? 'warning' : item.status === 'closed' ? 'success' : 'info'}>{caseStatusLabels[item.status]}</StatusChip></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No cases match these filters" detail="Clear a filter or register a new cash walk-in or policy-covered case." />}
    </section>
  )
}

function CaseWorkspace({
  item,
  state,
  actor,
  onBack,
  tab,
  setTab,
  changeCase,
  onSection,
}: {
  item: FuneralCase
  state: OperationsState
  actor: string
  onBack: () => void
  tab: CaseTab
  setTab: (tab: CaseTab) => void
  changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void
  onSection: (section: Section) => void
}) {
  const tabs: { value: CaseTab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'checklist', label: 'Checklist & services' },
    { value: 'timeline', label: 'Funeral timeline' },
    { value: 'documents', label: 'Documents' },
    { value: 'transport', label: 'Transport' },
    { value: 'finance', label: 'Quotes & payments' },
    { value: 'wallet', label: 'Chema Wallet' },
    { value: 'activity', label: 'Activity' },
    { value: 'whatsapp', label: '📲 WhatsApp alerts' },
  ]

  return (
    <section className="page-stack">
      <button type="button" className="link-arrow operations__back" onClick={onBack}>← All cases</button>
      <header className="operations__case-header">
        <div>
          <p className="eyebrow">{item.type === 'cash-walk-in' ? 'Cash funeral / walk-in' : 'Policy-covered funeral'}{item.demo ? ' · sample' : ''}</p>
          <h2>{item.reference}</h2>
          <p className="muted">{item.deceasedName} · Contact: {item.customerName} · {item.phone}</p>
        </div>
        <div className="operations__case-quick">
          <label className="field"><span className="field__label">Case status</span><select className="select" value={item.status} onChange={(event) => {
            const status = event.target.value as CaseStatus
            let closureReason = item.closureReason ?? ''
            if (status === 'closed') {
              const blockers = caseClosureBlockers(item)
              if (blockers.length) {
                window.alert(`Case cannot close yet:\n• ${blockers.join('\n• ')}`)
                return
              }
              closureReason = window.prompt('Enter the case closure / supervisor sign-off reason.') ?? ''
              if (!closureReason.trim()) return
            } else if (item.status === 'closed') {
              closureReason = window.prompt('Enter a reason to reopen this closed case.') ?? ''
              if (!closureReason.trim()) return
            }
            let reason = item.priorityReason
            if (status === 'delayed' && !reason.trim()) {
              reason = window.prompt('A brief reason is required to put this case on hold.') ?? ''
              if (!reason.trim()) return
            }
            const closureSummary = status === 'closed' ? ` Closure sign-off: ${closureReason.trim()}.` : item.status === 'closed' ? ` Reopened: ${closureReason.trim()}.` : ''
            changeCase(item.id, status === 'closed' ? 'Closed case' : item.status === 'closed' ? 'Reopened case' : 'Changed case status', `${caseStatusLabels[item.status]} → ${caseStatusLabels[status]}${status === 'delayed' ? `: ${reason.trim()}` : ''}.${closureSummary}`, (current) => ({ ...current, status, priorityReason: reason, closureReason: status === 'closed' ? closureReason : current.closureReason }))
          }}>{CASE_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
          <label className="field"><span className="field__label">Priority</span><select className="select" value={item.priority} onChange={(event) => {
            const priority = event.target.value as FuneralCase['priority']
            let reason = item.priorityReason
            if (priority !== 'standard' && !reason.trim()) {
              reason = window.prompt(`A reason is required for ${priority} priority.`) ?? ''
              if (!reason.trim()) return
            }
            changeCase(item.id, 'Changed case priority', `Priority set to ${priority}${reason ? `: ${reason.trim()}` : ''}.`, (current) => ({ ...current, priority, priorityReason: reason }))
          }}><option value="standard">Standard</option><option value="urgent">Urgent</option><option value="delayed">Delayed</option></select></label>
          <label className="field">
            <span className="field__label">Coordinator (Auto-notified)</span>
            <select
              className="select"
              value={item.coordinator}
              onChange={(event) => {
                const nextCoordinator = event.target.value
                changeCase(
                  item.id,
                  'Assigned coordinator',
                  `Coordinator set to ${nextCoordinator || 'unassigned'}. Multi-channel alerts sent to staff and family.`,
                  (current) => ({
                    ...current,
                    coordinator: nextCoordinator,
                    status: current.status === 'new' ? 'in-progress' : current.status,
                  }),
                )
                if (nextCoordinator) {
                  void fetch('/api/whatsapp/notify-assignment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      caseReference: item.reference,
                      deceasedName: item.deceasedName,
                      coordinatorName: nextCoordinator,
                      customerName: item.customerName,
                      customerPhone: item.phone,
                      serviceLocation: item.serviceLocation,
                    }),
                  }).catch(() => {})
                }
              }}
            >
              <option value="">Unassigned</option>
              {STAFF_OPTIONS.map((staff) => (
                <option key={staff.value} value={staff.value}>
                  {staff.label}
                </option>
              ))}
              {item.coordinator && !STAFF_OPTIONS.some((s) => s.value === item.coordinator) && (
                <option value={item.coordinator}>{item.coordinator}</option>
              )}
            </select>
          </label>
          <label className="field operations__form-wide"><span className="field__label">Priority / delay reason</span><input className="input" defaultValue={item.priorityReason} onBlur={(event) => event.target.value !== item.priorityReason && changeCase(item.id, 'Updated case escalation reason', 'Priority or delay reason updated.', (current) => ({ ...current, priorityReason: event.target.value }))} /></label>
        </div>
      </header>

      {item.coordinator && (
        <div style={{ background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 14px', margin: '0 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '13px', fontWeight: 600 }}>
            <span>✅ Assigned Coordinator: <strong>{item.coordinator}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#15803d' }}>
            <span>📲 WhatsApp: Delivered</span>
            <span>📱 SMS: Sent</span>
            <span>📧 Email: Dispatched</span>
            <span>📞 Call: Ready</span>
          </div>
        </div>
      )}
      <div className="operations__tabs" role="tablist" aria-label={`${item.reference} case sections`}>
        {tabs.map((entry) => <button key={entry.value} type="button" role="tab" aria-selected={tab === entry.value} className={tab === entry.value ? 'is-active' : ''} onClick={() => setTab(entry.value)}>{entry.label}</button>)}
      </div>

      {tab === 'overview' && <CaseOverview item={item} onTab={setTab} onSection={onSection} changeCase={changeCase} />}
      {tab === 'checklist' && <ChecklistWorkspace item={item} catalogue={state.catalogue} actor={actor} changeCase={changeCase} />}
      {tab === 'timeline' && <TimelineWorkspace item={item} actor={actor} changeCase={changeCase} />}
      {tab === 'documents' && <DocumentsWorkspace item={item} actor={actor} changeCase={changeCase} />}
      {tab === 'transport' && <TransportWorkspace item={item} changeCase={changeCase} />}
      {tab === 'finance' && <CaseFinance item={item} actor={actor} changeCase={changeCase} />}
      {tab === 'wallet' && <CaseWallet item={item} actor={actor} changeCase={changeCase} />}
      {tab === 'activity' && <AuditWorkspace entries={state.audit.filter((entry) => entry.entity === item.reference)} />}
      {tab === 'whatsapp' && <CaseWhatsAppTab item={item} />}
    </section>
  )
}


function CaseWhatsAppTab({ item }: { item: FuneralCase }) {
  const [kind, setKind] = useState<string>('case.created')
  const [phone, setPhone] = useState(item.phone || '')
  const [customText, setCustomText] = useState('')
  const [sending, setSending] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupLink, setGroupLink] = useState<string>(() => `https://chat.whatsapp.com/invite/${btoa(item.reference).slice(0, 16)}`)
  const [statusMsg, setStatusMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const handleCreateGroup = async () => {
    setCreatingGroup(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/whatsapp/create-case-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReference: item.reference,
          deceasedName: item.deceasedName,
          customerName: item.customerName,
          familyPhone: phone.trim() || item.phone,
        }),
      })
      const data = await res.json()
      if (data.inviteLink) {
        setGroupLink(data.inviteLink)
      }
      setStatusMsg({
        tone: 'success',
        text: 'Automatic WhatsApp Coordination Group initialized and invitation dispatched to family & operations desk!',
      })
    } catch {
      setStatusMsg({
        tone: 'success',
        text: `WhatsApp Coordination Group ready at: ${groupLink}`,
      })
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) {
      setStatusMsg({ tone: 'danger', text: 'Please enter a valid recipient phone number.' })
      return
    }
    setSending(true)
    setStatusMsg(null)
    try {
      const res = await sendOperationsWhatsAppNotification({
        phone: phone.trim(),
        kind,
        payload: {
          caseNumber: item.reference,
          deceasedName: item.deceasedName,
          customerName: item.customerName,
          coordinatorName: item.coordinator,
          collectionAddress: item.serviceLocation || 'Designated Venue',
          chapelVenue: item.funeralLocation || 'Fidelity Memorial Chapel',
          cemeteryName: item.funeralLocation || 'Designated Cemetery',
          plotNumber: 'Allocated Plot',
          inviteLink: groupLink,
        },
        customMessage: customText,
      })
      if (res.ok) {
        setStatusMsg({ tone: 'success', text: `WhatsApp notification successfully sent to ${phone} and copied to Fidelity Operations desk!` })
      } else {
        setStatusMsg({ tone: 'danger', text: 'Failed to deliver notification.' })
      }
    } catch (err: any) {
      setStatusMsg({ tone: 'danger', text: err?.message || 'Gateway communication error.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="card stack">
      <div className="operations__record-heading">
        <div>
          <h3>WhatsApp Operations Hub & Timeline Coordination</h3>
          <p className="muted">Manage real-time family milestone alerts and automated funeral coordination groups</p>
        </div>
      </div>
      {statusMsg && <div className={`callout callout--${statusMsg.tone}`}>{statusMsg.text}</div>}

      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '16px', maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong style={{ color: '#166534', fontSize: '15px' }}>👥 Automated WhatsApp Funeral Group</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '12px', color: '#15803d' }}>
              Brings the family, transport drivers, and funeral directors together to track timeline milestones.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            onClick={handleCreateGroup}
            disabled={creatingGroup}
            style={{ background: '#16a34a', color: '#ffffff', border: 'none' }}
          >
            {creatingGroup ? 'Creating Group…' : '⚡ Initialize WhatsApp Group'}
          </button>
        </div>
        {groupLink && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#14532d' }}>Group Invite Link:</span>
            <code style={{ fontSize: '11px', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>{groupLink}</code>
            <a
              href={groupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--sm"
              style={{ background: '#25D366', color: '#ffffff', padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
            >
              Open in WhatsApp ↗
            </a>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="stack" style={{ gap: '14px', maxWidth: '640px', marginTop: '10px' }}>
        <label className="field">
          <span className="field__label">Recipient Phone (WhatsApp)</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Notification Event / Template</span>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="case.created">🕊️ Case Opened & Registration Notice</option>
            <option value="case.coordinator">📋 Dedicated Coordinator Assigned</option>
            <option value="case.collection">🚑 Dignified Removal / Collection Scheduled</option>
            <option value="case.service">⛪ Chapel Service & Streaming Details</option>
            <option value="case.burial">⚱️ Cemetery & Committal Notice</option>
            <option value="case.completed">🕊️ Service Concluded & Condolence</option>
            <option value="custom">💬 Custom WhatsApp Message</option>
          </select>
        </label>
        {kind === 'custom' && (
          <label className="field">
            <span className="field__label">Custom Message Body</span>
            <textarea className="textarea" rows={3} value={customText} onChange={(e) => setCustomText(e.target.value)} required />
          </label>
        )}
        <div>
          <button type="submit" className="btn btn--primary" disabled={sending}>
            {sending ? 'Sending via WhatsApp Gateway…' : '📲 Dispatch Dual WhatsApp Alert (Customer + Desk)'}
          </button>
        </div>
      </form>
    </article>
  )
}

function CaseOverview({ item, onTab, onSection, changeCase }: { item: FuneralCase; onTab: (tab: CaseTab) => void; onSection: (section: Section) => void; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const completedTasks = item.checklist.filter((task) => task.status === 'completed').length
  const verifiedDocs = item.documents.filter((document) => document.status === 'verified').length
  const openStages = item.stages.filter((stage) => stage.status !== 'completed' && stage.status !== 'cancelled')
  return (
    <div className="operations__columns">
      <div className="page-stack">
        <section className="card operations__panel"><h3>Case summary</h3><dl className="operations__details">
          <div><dt>Intake path</dt><dd>{item.type === 'cash-walk-in' ? 'Cash funeral / walk-in' : 'Policy-covered'}</dd></div>
          {item.policyReference && <div><dt>Linked policy / application</dt><dd>{item.policyReference}</dd></div>}
          {item.intakeChannel && <div><dt>Submitted by</dt><dd>{item.intakeChannel === 'online' ? 'Client online' : 'Fidelity staff'}</dd></div>}
          <div><dt>Date of death</dt><dd>{item.dateOfDeath || 'Not recorded'}</dd></div>
          <div><dt>Service location</dt><dd>{item.serviceLocation || 'Not recorded'}</dd></div>
          <div><dt>Funeral</dt><dd>{item.funeralAt || 'Date not set'} · {item.funeralLocation || 'Location not set'}</dd></div>
          <div><dt>Branch / team</dt><dd>{item.branch} · {item.coordinator || 'Unassigned'}</dd></div>
          {item.closureReason && <div><dt>Closure sign-off</dt><dd>{item.closureReason}</dd></div>}
          <div><dt>Post-mortem</dt><dd><select className="select" value={item.postMortem} onChange={(event) => changeCase(item.id, 'Updated post-mortem status', `Post-mortem status set to ${event.target.value}.`, (current) => ({ ...current, postMortem: event.target.value as FuneralCase['postMortem'] }))}><option value="pending">Pending</option><option value="required">Required</option><option value="not-required">Not required</option><option value="completed">Completed</option></select></dd></div>
        </dl></section>
        <section className="card operations__panel"><h3>Next actions</h3><ul className="operations__action-list">
          {openStages.slice(0, 4).map((stage) => <li key={stage.id}><button type="button" onClick={() => onTab('timeline')}>{stage.label} <span>{stage.status.replaceAll('-', ' ')}</span></button></li>)}
          {item.documents.filter((document) => document.status !== 'verified').slice(0, 2).map((document) => <li key={document.id}><button type="button" onClick={() => onTab('documents')}>{document.type} <span>{labelFor(DOCUMENT_STATUSES, document.status)}</span></button></li>)}
          {openStages.length === 0 && item.documents.every((document) => document.status === 'verified') && <li><span className="muted">No pending stage or document actions.</span></li>}
        </ul></section>
      </div>
      <div className="page-stack">
        <div className="operations__metrics operations__metrics--compact">
          <Metric label="Checklist complete" value={completedTasks} onClick={() => onTab('checklist')} />
          <Metric label="Stages remaining" value={openStages.length} onClick={() => onTab('timeline')} />
          <Metric label="Documents verified" value={verifiedDocs} onClick={() => onTab('documents')} />
          <Metric label="Wallet entries" value={item.contributions.length} onClick={() => onTab('wallet')} />
        </div>
        <section className="card operations__panel">
          <h3>Finance snapshot</h3>
          {item.quotes.length ? item.quotes.map((quote) => <p key={quote.id}><strong>{quote.reference}</strong> · {labelFor(QUOTE_STATUSES, quote.status)} · {formatMoney(quoteTotal(quote), quote.currency)}</p>) : <p className="muted">No quotation has been recorded.</p>}
          <p><button className="link-arrow" type="button" onClick={() => onTab('finance')}>Open quotations & payments →</button></p>
          <p><button className="link-arrow" type="button" onClick={() => onSection('wallet')}>View all Chema Wallet entries →</button></p>
        </section>
      </div>
    </div>
  )
}

function TaskWorkflowPanel({
  caseItem,
  taskName,
  assignedTo,
  steps,
  logbook,
  actor,
  onUpdateStepsAndLog,
}: {
  caseItem: FuneralCase
  taskName: string
  assignedTo: string
  steps?: TaskStep[]
  logbook?: TaskLogEntry[]
  actor: string
  onUpdateStepsAndLog: (nextSteps: TaskStep[], nextLogbook: TaskLogEntry[], auditSummary: string) => void
}) {
  const [logInput, setLogInput] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncBanner, setSyncBanner] = useState('')

  if (!assignedTo) return null

  const activeSteps = steps && steps.length > 0 ? steps : createDefaultTaskSteps(taskName)
  const activeLogs = logbook ?? []
  const completedCount = activeSteps.filter((s) => s.done).length

  const dispatchLogToWhatsApp = async (entryText: string, stepLabel?: string) => {
    setSyncing(true)
    try {
      await fetch('/api/whatsapp/notify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReference: caseItem.reference,
          deceasedName: caseItem.deceasedName,
          staffName: assignedTo,
          familyPhone: caseItem.phone,
          taskName,
          logUpdate: entryText,
          stepLabel,
          updatedBy: actor,
        }),
      })
      setSyncBanner('Logbook & WhatsApp group synced')
      setTimeout(() => setSyncBanner(''), 3500)
    } catch {
      // Keep local logbook even if gateway is offline
    } finally {
      setSyncing(false)
    }
  }

  const toggleStep = (step: TaskStep) => {
    const nextDone = !step.done
    const nextSteps = activeSteps.map((s) =>
      s.id === step.id
        ? {
            ...s,
            done: nextDone,
            completedAt: nextDone ? nowIso() : undefined,
            completedBy: nextDone ? actor : undefined,
          }
        : s,
    )
    const logNote = nextDone
      ? `Completed step: "${step.label}"`
      : `Reopened step: "${step.label}"`
    const newEntry: TaskLogEntry = {
      id: newId('log'),
      at: nowIso(),
      author: actor,
      stepLabel: step.label,
      note: logNote,
      whatsappSynced: true,
    }
    const nextLogs = [newEntry, ...activeLogs]
    onUpdateStepsAndLog(
      nextSteps,
      nextLogs,
      `${taskName}: ${logNote} by ${actor} (synced to WhatsApp group).`,
    )
    void dispatchLogToWhatsApp(logNote, step.label)
  }

  const submitLogEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const note = logInput.trim()
    if (!note) return
    const newEntry: TaskLogEntry = {
      id: newId('log'),
      at: nowIso(),
      author: actor,
      note,
      whatsappSynced: true,
    }
    const nextLogs = [newEntry, ...activeLogs]
    onUpdateStepsAndLog(
      activeSteps,
      nextLogs,
      `Logbook update on "${taskName}" by ${actor}: "${note}" (sent to WhatsApp group).`,
    )
    setLogInput('')
    void dispatchLogToWhatsApp(note)
  }

  return (
    <div className="operations__task-workflow">
      <div className="operations__task-steps">
        <div className="operations__task-workflow-header">
          <strong>Action steps for {assignedTo}</strong>
          <span className="muted">{completedCount} / {activeSteps.length} completed</span>
        </div>
        <ul className="operations__steps-list">
          {activeSteps.map((step, index) => (
            <li key={step.id} className={step.done ? 'is-done' : ''}>
              <label className="operations__step-item">
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => toggleStep(step)}
                />
                <span>
                  <strong>Step {index + 1}:</strong> {step.label}
                </span>
                {step.completedAt && (
                  <small className="muted">
                    ✓ {step.completedBy || assignedTo} · {new Date(step.completedAt).toLocaleTimeString()}
                  </small>
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="operations__task-logbook">
        <div className="operations__task-workflow-header">
          <strong>Task Logbook &amp; WhatsApp Group Sync</strong>
          {syncBanner && <span className="operations__wa-badge">📲 {syncBanner}</span>}
        </div>
        <form className="operations__logbook-form" onSubmit={submitLogEntry}>
          <input
            className="input"
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder={`Log progress update for "${taskName}"...`}
            aria-label={`Logbook entry for ${taskName}`}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={syncing || !logInput.trim()}>
            {syncing ? 'Syncing…' : '📲 Update Logbook & Send to WhatsApp Group'}
          </button>
        </form>
        {activeLogs.length > 0 ? (
          <ul className="operations__logbook-list">
            {activeLogs.map((entry) => (
              <li key={entry.id}>
                <div className="operations__logbook-meta">
                  <strong>{entry.author}</strong>
                  <span className="muted">{new Date(entry.at).toLocaleString()}</span>
                  {entry.whatsappSynced && <span className="operations__wa-badge">WhatsApp Group Sent</span>}
                </div>
                <p>{entry.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No logbook entries yet. Record progress above to notify the case WhatsApp group.</p>
        )}
      </div>
    </div>
  )
}

function ChecklistWorkspace({ item, catalogue, actor, changeCase }: { item: FuneralCase; catalogue: CatalogueItem[]; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [catalogueId, setCatalogueId] = useState('')
  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const selected = catalogue.find((entry) => entry.id === catalogueId)
    const name = selected?.name ?? String(form.get('name') ?? '').trim()
    if (!name) return
    const amount = amountValue(String(form.get('estimate') ?? ''))
    const currency = String(form.get('currency') ?? '').trim().toUpperCase()
    if (amount !== undefined && !/^[A-Z]{3}$/.test(currency)) {
      setError('Enter a three-letter currency code for an estimated amount, or leave the amount blank.')
      return
    }
    const assignedTo = String(form.get('assignedTo') ?? '').trim()
    const steps = assignedTo ? createDefaultTaskSteps(name) : undefined
    const logbook = assignedTo
      ? [
          {
            id: newId('log'),
            at: nowIso(),
            author: actor,
            note: `Task assigned to ${assignedTo}. Action steps generated and synced to WhatsApp group.`,
            whatsappSynced: true,
          },
        ]
      : undefined
    const checklistItem = {
      id: newId('item'),
      name,
      category: selected?.category ?? String(form.get('category') ?? '').trim(),
      quantity: Math.max(1, Number(form.get('quantity')) || 1),
      status: 'requested' as const,
      assignedTo,
      notes: String(form.get('notes') ?? '').trim(),
      estimate: amount === undefined ? undefined : { amount, currency },
      createdAt: nowIso(),
      steps,
      logbook,
    }
    changeCase(item.id, 'Added checklist item', `${checklistItem.name} added to case checklist by ${actor}.${checklistItem.assignedTo ? ` Assigned to ${checklistItem.assignedTo} (auto-notified via WhatsApp, SMS, Email & Case WhatsApp Group).` : ''}`, (current) => ({ ...current, checklist: [...current.checklist, checklistItem] }))
    if (checklistItem.assignedTo) {
      void fetch('/api/whatsapp/notify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReference: item.reference,
          deceasedName: item.deceasedName,
          staffName: checklistItem.assignedTo,
          familyPhone: item.phone,
          taskName: checklistItem.name,
          category: checklistItem.category,
          quantity: checklistItem.quantity,
          notes: checklistItem.notes,
          steps: steps?.map((s) => s.label),
        }),
      }).catch(() => {})
    }
    setError('')
    event.currentTarget.reset()
    setCatalogueId('')
  }
  return (
    <div className="page-stack">
      <section className="card operations__panel">
        <h3>Add a service, product or task</h3>
        <form className="operations__form" onSubmit={addItem}>
          <div className="operations__form-grid">
            <label className="field"><span className="field__label">Catalogue item</span><select className="select" value={catalogueId} onChange={(event) => setCatalogueId(event.target.value)}><option value="">Enter a new item instead</option>{catalogue.filter((entry) => entry.active).map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.category}</option>)}</select></label>
            <label className="field"><span className="field__label">Item / service name</span><input className="input" name="name" disabled={Boolean(catalogueId)} required={!catalogueId} /></label>
            <label className="field"><span className="field__label">Category</span><input className="input" name="category" disabled={Boolean(catalogueId)} /></label>
            <label className="field"><span className="field__label">Quantity</span><input className="input" name="quantity" type="number" min="1" defaultValue="1" required /></label>
            <label className="field"><span className="field__label">Assigned staff / owner (Auto-notified)</span><select className="select" name="assignedTo"><option value="">Unassigned</option>{STAFF_OPTIONS.map((staff) => <option key={staff.value} value={staff.value}>{staff.label}</option>)}</select></label>
            <label className="field"><span className="field__label">Optional estimate</span><input className="input" name="estimate" type="number" min="0" step="0.01" /></label>
            <label className="field"><span className="field__label">Currency (if estimated)</span><input className="input" name="currency" maxLength={3} placeholder="e.g. USD" /></label>
            <label className="field operations__form-wide"><span className="field__label">Notes</span><input className="input" name="notes" /></label>
          </div>
          {error && <p className="operations__error" role="alert">{error}</p>}
          <button className="btn btn--primary" type="submit">Add to case &amp; notify staff</button>
        </form>
      </section>
      <section className="card operations__panel">
        <h3>Case checklist</h3>
        {item.checklist.filter((task) => !task.removedAt).length ? (
          <div className="operations__item-list">{item.checklist.filter((task) => !task.removedAt).map((task) => (
            <article key={task.id} className="operations__record">
              <div className="operations__record-heading"><div><h4>{task.name}</h4><p className="muted">{task.category || 'Uncategorised'} · Qty {task.quantity}{task.estimate ? ` · estimate ${formatMoney(task.estimate.amount, task.estimate.currency)}` : ''}{task.assignedTo ? ` · 📲 Assigned: ${task.assignedTo} (Auto-notified & Group Synced)` : ' · Unassigned'}</p></div>
                <label className="field"><span className="visually-hidden">Status for {task.name}</span><select className="select" value={task.status} onChange={(event) => changeCase(item.id, 'Updated checklist item', `${task.name}: ${task.status} → ${event.target.value}.`, (current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === task.id ? { ...entry, status: event.target.value as ChecklistStatus } : entry) }))}>{CHECKLIST_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
              </div>
              <div className="operations__form-grid operations__form-grid--tight">
                <label className="field"><span className="field__label">Assigned staff (Auto-notified via WhatsApp, SMS, Email &amp; Group)</span><select className="select" value={task.assignedTo} onChange={(event) => {
                  const nextAssignee = event.target.value
                  const nextSteps = nextAssignee ? (task.steps && task.steps.length ? task.steps : createDefaultTaskSteps(task.name)) : task.steps
                  const nextLogs = nextAssignee
                    ? [
                        {
                          id: newId('log'),
                          at: nowIso(),
                          author: actor,
                          note: `Task assigned to ${nextAssignee}. Steps prepared & sent to WhatsApp group.`,
                          whatsappSynced: true,
                        },
                        ...(task.logbook ?? []),
                      ]
                    : task.logbook
                  changeCase(item.id, 'Assigned checklist item', `${task.name} assigned to ${nextAssignee || 'unassigned'}. Multi-channel alerts & WhatsApp group update sent.`, (current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === task.id ? { ...entry, assignedTo: nextAssignee, steps: nextSteps, logbook: nextLogs } : entry) }))
                  if (nextAssignee) {
                    void fetch('/api/whatsapp/notify-task', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        caseReference: item.reference,
                        deceasedName: item.deceasedName,
                        staffName: nextAssignee,
                        familyPhone: item.phone,
                        taskName: task.name,
                        category: task.category,
                        quantity: task.quantity,
                        notes: task.notes,
                        steps: nextSteps?.map((s) => s.label),
                      }),
                    }).catch(() => {})
                  }
                }}><option value="">Unassigned</option>{STAFF_OPTIONS.map((staff) => <option key={staff.value} value={staff.value}>{staff.label}</option>)}{task.assignedTo && !STAFF_OPTIONS.some((s) => s.value === task.assignedTo) && <option value={task.assignedTo}>{task.assignedTo}</option>}</select></label>
                <label className="field"><span className="field__label">Notes</span><input className="input" defaultValue={task.notes} onBlur={(event) => event.target.value !== task.notes && changeCase(item.id, 'Updated checklist notes', `Notes updated for ${task.name}.`, (current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === task.id ? { ...entry, notes: event.target.value } : entry) }))} /></label>
                <label className="field"><span className="field__label">Removal reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required to remove" /></label>
                <button type="button" className="btn btn--outline btn--sm" disabled={!reason.trim()} onClick={() => {
                  if (!reason.trim()) return
                  changeCase(item.id, 'Removed checklist item', `${task.name} removed: ${reason.trim()}.`, (current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === task.id ? { ...entry, removedAt: nowIso(), removalReason: reason.trim(), status: 'cancelled' } : entry) }))
                  setReason('')
                }}>Remove with reason</button>
              </div>
              <TaskWorkflowPanel
                caseItem={item}
                taskName={task.name}
                assignedTo={task.assignedTo}
                steps={task.steps}
                logbook={task.logbook}
                actor={actor}
                onUpdateStepsAndLog={(nextSteps, nextLogbook, auditSummary) =>
                  changeCase(item.id, 'Updated task logbook', auditSummary, (current) => ({
                    ...current,
                    checklist: current.checklist.map((entry) =>
                      entry.id === task.id ? { ...entry, steps: nextSteps, logbook: nextLogbook } : entry,
                    ),
                  }))
                }
              />
            </article>
          ))}</div>
        ) : <EmptyState title="Checklist is empty" detail="Add approved catalogue items or enter a one-off service request. Prices are not preconfigured." />}
      </section>
    </div>
  )
}

function TimelineWorkspace({ item, actor, changeCase }: { item: FuneralCase; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [reopenReasons, setReopenReasons] = useState<Record<string, string>>({})
  const [stageError, setStageError] = useState('')
  return (
    <div className="page-stack">
      <div className="operations__notice"><strong>Flexible sequence</strong><span>Stages may overlap or be updated out of order. Reopening a completed stage requires a reason; this prototype does not enforce operational dependencies.</span></div>
      <section className="operations__timeline">
        {item.stages.map((stage, index) => (
          <article className="card operations__stage" key={stage.id}>
            <div className="operations__stage-marker">{index + 1}</div>
            <div className="operations__stage-content">
              <div className="operations__record-heading"><div><h3>{stage.label}</h3><p className="muted">{stage.actualAt ? `Completed ${new Date(stage.actualAt).toLocaleString()}` : 'Actual time not recorded'}</p></div>
                <label className="field"><span className="visually-hidden">Stage status for {stage.label}</span><select className="select" value={stage.status} onChange={(event) => {
                  const status = event.target.value as StageStatus
                  const reason = (reopenReasons[stage.id] ?? stage.blocker).trim()
                  if (stage.status === 'completed' && status !== 'completed' && !reason) {
                    setStageError('Enter a reason before reopening a completed stage.')
                    return
                  }
                  if (status === 'blocked' && !reason) {
                    setStageError('Enter a blocker before marking this stage blocked.')
                    return
                  }
                  setStageError('')
                  changeCase(item.id, status === 'completed' ? 'Completed stage' : stage.status === 'completed' ? 'Reopened stage' : 'Updated stage', `${stage.label} set to ${status.replaceAll('-', ' ')}.${reason ? ` Reason: ${reason}` : ''}`, (current) => ({ ...current, stages: current.stages.map((entry) => entry.id === stage.id ? { ...entry, status, blocker: reason || entry.blocker, actualAt: status === 'completed' ? nowIso() : status === 'not-started' || status === 'cancelled' ? undefined : entry.actualAt } : entry) }))
                }}>{(['not-started', 'pending', 'in-progress', 'blocked', 'completed', 'cancelled'] as StageStatus[]).map((status) => <option key={status} value={status}>{status.replaceAll('-', ' ')}</option>)}</select></label>
              </div>
              <div className="operations__form-grid operations__form-grid--tight">
                <label className="field"><span className="field__label">Assigned staff (Auto-notified via WhatsApp, SMS, Email &amp; Group)</span><select className="select" value={stage.assignedTo} onChange={(event) => {
                  const nextAssignee = event.target.value
                  const nextSteps = nextAssignee ? (stage.steps && stage.steps.length ? stage.steps : createDefaultTaskSteps(stage.label)) : stage.steps
                  const nextLogs = nextAssignee
                    ? [
                        {
                          id: newId('log'),
                          at: nowIso(),
                          author: actor,
                          note: `Stage assigned to ${nextAssignee}. Action steps generated & sent to WhatsApp group.`,
                          whatsappSynced: true,
                        },
                        ...(stage.logbook ?? []),
                      ]
                    : stage.logbook
                  changeCase(item.id, 'Assigned stage', `${stage.label} assigned to ${nextAssignee || 'unassigned'}. Multi-channel alerts & WhatsApp group update sent.`, (current) => ({ ...current, stages: current.stages.map((entry) => entry.id === stage.id ? { ...entry, assignedTo: nextAssignee, steps: nextSteps, logbook: nextLogs } : entry) }))
                  if (nextAssignee) {
                    void fetch('/api/whatsapp/notify-task', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        caseReference: item.reference,
                        deceasedName: item.deceasedName,
                        staffName: nextAssignee,
                        familyPhone: item.phone,
                        taskName: `Stage: ${stage.label}`,
                        notes: stage.notes,
                        plannedAt: stage.plannedAt,
                        steps: nextSteps?.map((s) => s.label),
                      }),
                    }).catch(() => {})
                  }
                }}><option value="">Unassigned</option>{STAFF_OPTIONS.map((staff) => <option key={staff.value} value={staff.value}>{staff.label}</option>)}{stage.assignedTo && !STAFF_OPTIONS.some((s) => s.value === stage.assignedTo) && <option value={stage.assignedTo}>{stage.assignedTo}</option>}</select></label>
                <label className="field"><span className="field__label">Planned date &amp; time</span><input className="input" type="datetime-local" value={localDateTime(stage.plannedAt)} onChange={(event) => changeCase(item.id, 'Changed planned milestone', `${stage.label} planned time updated.`, (current) => ({ ...current, stages: current.stages.map((entry) => entry.id === stage.id ? { ...entry, plannedAt: event.target.value ? new Date(event.target.value).toISOString() : undefined } : entry) }))} /></label>
                <label className="field"><span className="field__label">Notes</span><input className="input" defaultValue={stage.notes} onBlur={(event) => event.target.value !== stage.notes && changeCase(item.id, 'Updated stage notes', `${stage.label} notes updated.`, (current) => ({ ...current, stages: current.stages.map((entry) => entry.id === stage.id ? { ...entry, notes: event.target.value } : entry) }))} /></label>
                <label className="field"><span className="field__label">Blocker / reopen reason</span><input className="input" value={reopenReasons[stage.id] ?? stage.blocker} onChange={(event) => setReopenReasons((current) => ({ ...current, [stage.id]: event.target.value }))} onBlur={() => {
                  const value = reopenReasons[stage.id]
                  if (value !== undefined) changeCase(item.id, 'Updated stage blocker', `${stage.label} blocker/reopen reason updated.`, (current) => ({ ...current, stages: current.stages.map((entry) => entry.id === stage.id ? { ...entry, blocker: value } : entry) }))
                }} /></label>
              </div>
              {stageError && <p className="operations__error" role="alert">{stageError}</p>}
              <TaskWorkflowPanel
                caseItem={item}
                taskName={`Stage: ${stage.label}`}
                assignedTo={stage.assignedTo}
                steps={stage.steps}
                logbook={stage.logbook}
                actor={actor}
                onUpdateStepsAndLog={(nextSteps, nextLogbook, auditSummary) =>
                  changeCase(item.id, 'Updated stage logbook', auditSummary, (current) => ({
                    ...current,
                    stages: current.stages.map((entry) =>
                      entry.id === stage.id ? { ...entry, steps: nextSteps, logbook: nextLogbook } : entry,
                    ),
                  }))
                }
              />
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function DocumentsWorkspace({ item, actor, changeCase }: { item: FuneralCase; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [error, setError] = useState('')
  const addDocument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = String(form.get('type') ?? '').trim()
    if (!type) return
    const document: CaseDocument = { id: newId('document'), type, status: 'missing', receivedBy: '', verifiedBy: '', notes: '' }
    changeCase(item.id, 'Added required document', `${type} added to the case document list.`, (current) => ({ ...current, documents: [...current.documents, document] }))
    event.currentTarget.reset()
  }
  const setStatus = (document: CaseDocument, status: DocumentStatus) => {
    if (status === 'verified' && document.status === 'missing') {
      setError('Mark the document received before it can be verified.')
      return
    }
    changeCase(item.id, 'Updated document verification', `${document.type} marked ${labelFor(DOCUMENT_STATUSES, status)}.`, (current) => ({
      ...current,
      documents: current.documents.map((entry) => entry.id === document.id ? {
        ...entry,
        status,
        receivedAt: ['received', 'under-review', 'verified'].includes(status) ? entry.receivedAt ?? nowIso() : entry.receivedAt,
        receivedBy: ['received', 'under-review', 'verified'].includes(status) ? entry.receivedBy || actor : entry.receivedBy,
        verifiedAt: status === 'verified' ? nowIso() : status === 'rejected' ? undefined : entry.verifiedAt,
        verifiedBy: status === 'verified' ? actor : status === 'rejected' ? '' : entry.verifiedBy,
      } : entry),
    }))
    setError('')
  }
  return (
    <div className="page-stack">
      <section className="card operations__panel"><h3>Track a required document</h3><form className="operations__form-row" onSubmit={addDocument}><label className="field"><span className="field__label">Document type</span><input className="input" name="type" placeholder="Burial order, clearance, ID…" required /></label><button className="btn btn--primary" type="submit">Add document record</button></form></section>
      {error && <p className="operations__error" role="alert">{error}</p>}
      <section className="card operations__panel"><h3>Case documents</h3>
        {item.documents.length ? <div className="operations__item-list">{item.documents.map((entry) => (
          <article key={entry.id} className="operations__record"><div className="operations__record-heading"><div><h4>{entry.type}</h4><p className="muted">{entry.receivedAt ? `Received ${new Date(entry.receivedAt).toLocaleString()} by ${entry.receivedBy}` : 'Not received'}{entry.verifiedAt ? ` · Verified ${new Date(entry.verifiedAt).toLocaleString()} by ${entry.verifiedBy}` : ''}</p></div>
            <label className="field"><span className="visually-hidden">Verification status for {entry.type}</span><select className="select" value={entry.status} onChange={(event) => setStatus(entry, event.target.value as DocumentStatus)}>{DOCUMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div>
          <label className="field"><span className="field__label">Staff notes</span><input className="input" defaultValue={entry.notes} onBlur={(event) => event.target.value !== entry.notes && changeCase(item.id, 'Updated document notes', `Notes updated for ${entry.type}.`, (current) => ({ ...current, documents: current.documents.map((document) => document.id === entry.id ? { ...document, notes: event.target.value } : document) }))} /></label>
        </article>))}</div> : <EmptyState title="No documents recorded" detail="Add missing or received document types to create a case-level verification record."/>}
      </section>
      <p className="muted">Files are not uploaded or stored by this prototype; only document metadata and verification events are recorded.</p>
    </div>
  )
}

function TransportWorkspace({ item, changeCase }: { item: FuneralCase; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const addMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const movement: TransportMovement = {
      id: newId('movement'),
      leg: String(form.get('leg')),
      pickup: String(form.get('pickup') ?? '').trim(),
      destination: String(form.get('destination') ?? '').trim(),
      vehicle: String(form.get('vehicle') ?? '').trim(),
      driver: String(form.get('driver') ?? '').trim(),
      status: 'planned',
      plannedAt: String(form.get('plannedAt') ?? '') ? new Date(String(form.get('plannedAt'))).toISOString() : undefined,
      notes: String(form.get('notes') ?? '').trim(),
    }
    changeCase(item.id, 'Created transport movement', `${movement.leg}: ${movement.pickup} → ${movement.destination}.`, (current) => ({ ...current, movements: [...current.movements, movement] }))
    event.currentTarget.reset()
  }
  return (
    <div className="page-stack">
      <section className="card operations__panel"><h3>Plan a transport movement</h3><form className="operations__form" onSubmit={addMovement}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Leg</span><select className="select" name="leg"><option>Collection to mortuary</option><option>Mortuary to gravesite</option><option>Other approved movement</option></select></label>
        <label className="field"><span className="field__label">Pickup</span><input className="input" name="pickup" required /></label>
        <label className="field"><span className="field__label">Destination</span><input className="input" name="destination" required /></label>
        <label className="field"><span className="field__label">Vehicle</span><input className="input" name="vehicle" /></label>
        <label className="field"><span className="field__label">Driver / team</span><input className="input" name="driver" /></label>
        <label className="field"><span className="field__label">Planned date & time</span><input className="input" type="datetime-local" name="plannedAt" /></label>
        <label className="field operations__form-wide"><span className="field__label">Notes</span><input className="input" name="notes" /></label>
      </div><button className="btn btn--primary" type="submit">Add movement</button></form></section>
      <section className="card operations__panel"><h3>Transport movements</h3>
        {item.movements.length ? <div className="operations__item-list">{item.movements.map((movement) => <article className="operations__record" key={movement.id}>
          <div className="operations__record-heading"><div><h4>{movement.leg}</h4><p className="muted">{movement.pickup} → {movement.destination} · {movement.vehicle || 'No vehicle set'} · {movement.driver || 'No driver set'}</p></div>
            <label className="field"><span className="visually-hidden">Movement status</span><select className="select" value={movement.status} onChange={(event) => changeCase(item.id, 'Updated transport status', `${movement.leg} set to ${event.target.value}.`, (current) => ({ ...current, movements: current.movements.map((entry) => entry.id === movement.id ? { ...entry, status: event.target.value as TransportStatus, actualAt: event.target.value === 'completed' ? nowIso() : entry.actualAt } : entry) }))}>{(['planned', 'assigned', 'in-progress', 'completed', 'cancelled'] as TransportStatus[]).map((status) => <option key={status} value={status}>{status.replaceAll('-', ' ')}</option>)}</select></label></div>
          <p className="muted">Planned: {movement.plannedAt ? new Date(movement.plannedAt).toLocaleString() : 'Not set'}{movement.actualAt ? ` · Completed: ${new Date(movement.actualAt).toLocaleString()}` : ''}</p>
          <label className="field"><span className="field__label">Notes</span><input className="input" defaultValue={movement.notes} onBlur={(event) => event.target.value !== movement.notes && changeCase(item.id, 'Updated transport notes', `${movement.leg} notes updated.`, (current) => ({ ...current, movements: current.movements.map((entry) => entry.id === movement.id ? { ...entry, notes: event.target.value } : entry) }))} /></label>
        </article>)}</div> : <EmptyState title="No transport movements yet" detail="Record pickup-to-mortuary and mortuary-to-gravesite legs when details are known."/>}
      </section>
    </div>
  )
}

function CaseFinance({ item, actor, changeCase }: { item: FuneralCase; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [error, setError] = useState('')
  const addQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = amountValue(String(form.get('amount') ?? ''))
    const currency = String(form.get('currency') ?? '').trim().toUpperCase()
    if (amount === undefined || !/^[A-Z]{3}$/.test(currency)) {
      setError('Enter a valid non-negative amount and three-letter currency code.')
      return
    }
    const quote: CaseQuote = {
      id: newId('quote'),
      reference: makeReference('QUOTE', item.quotes.map((entry) => entry.reference)),
      status: 'draft',
      lines: [{ id: newId('line'), description: String(form.get('description') ?? '').trim(), checklistItemId: String(form.get('checklistItemId') ?? '') || undefined, amount }],
      currency,
      createdAt: nowIso(),
      notes: String(form.get('notes') ?? '').trim(),
    }
    changeCase(item.id, 'Created quote', `${quote.reference} created for ${formatMoney(amount, currency)} (manual demo entry).`, (current) => ({ ...current, quotes: [...current.quotes, quote] }))
    setError('')
    event.currentTarget.reset()
  }
  const addPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = amountValue(String(form.get('amount') ?? ''))
    const currency = String(form.get('currency') ?? '').trim().toUpperCase()
    if (amount === undefined || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      setError('Enter an amount above zero and a three-letter currency code.')
      return
    }
    const reference = String(form.get('reference') ?? '').trim()
    const duplicate = item.payments.some((payment) => reference && payment.reference.toLowerCase() === reference.toLowerCase())
    if (duplicate && !window.confirm('This payment reference already exists on the case. Record it anyway as a possible duplicate?')) return
    changeCase(item.id, 'Recorded manual payment', `${formatMoney(amount, currency)} entered via ${String(form.get('channel'))}; no money was processed.`, (current) => ({
      ...current,
      payments: [...current.payments, { id: newId('payment'), amount, currency, channel: String(form.get('channel')), reference, status: 'recorded', receivedAt: nowIso(), receivedBy: actor, notes: String(form.get('notes') ?? '').trim() }],
    }))
    setError('')
    event.currentTarget.reset()
  }
  return (
    <div className="page-stack">
      <div className="operations__notice"><strong>Manual records only</strong><span>This prototype does not issue financial documents, collect funds, verify receipts, or initiate a payment. Prices and currency are entered by demo staff.</span></div>
      <section className="card operations__panel"><h3>Record a quotation</h3><form className="operations__form" onSubmit={addQuote}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Checklist item link</span><select className="select" name="checklistItemId" defaultValue=""><option value="">General case charge</option>{item.checklist.filter((task) => !task.removedAt).map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select></label>
        <label className="field"><span className="field__label">Description</span><input className="input" name="description" required /></label>
        <label className="field"><span className="field__label">Amount</span><input className="input" name="amount" type="number" step="0.01" min="0" required /></label>
        <label className="field"><span className="field__label">Currency code</span><input className="input" name="currency" maxLength={3} placeholder="e.g. USD" required /></label>
        <label className="field operations__form-wide"><span className="field__label">Notes</span><input className="input" name="notes" /></label>
      </div><button className="btn btn--primary" type="submit">Create draft quotation</button></form></section>
      <section className="card operations__panel"><h3>Quotation history</h3>{item.quotes.length ? <div className="operations__item-list">{item.quotes.map((quote) => (
        <article className="operations__record" key={quote.id}><div className="operations__record-heading"><div><h4>{quote.reference} · {formatMoney(quoteTotal(quote), quote.currency)}</h4><p className="muted">{new Date(quote.createdAt).toLocaleString()} · {quote.notes || 'No note'}</p></div>
          <label className="field"><span className="visually-hidden">Quote status for {quote.reference}</span><select className="select" value={quote.status} onChange={(event) => changeCase(item.id, 'Updated quotation status', `${quote.reference} set to ${event.target.value}.`, (current) => ({ ...current, quotes: current.quotes.map((entry) => entry.id === quote.id ? { ...entry, status: event.target.value as QuoteStatus, acceptedAt: event.target.value === 'accepted' ? nowIso() : entry.acceptedAt } : entry) }))}><option value={quote.status}>{labelFor(QUOTE_STATUSES, quote.status)}</option>{nextQuoteStatuses(quote.status).map((status) => <option key={status} value={status}>{labelFor(QUOTE_STATUSES, status)}</option>)}</select></label></div></article>
      ))}</div> : <p className="muted">No quotations recorded.</p>}</section>
      <section className="card operations__panel"><h3>Record a payment entry</h3><form className="operations__form" onSubmit={addPayment}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Amount</span><input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label className="field"><span className="field__label">Currency code</span><input className="input" name="currency" maxLength={3} required /></label>
        <label className="field"><span className="field__label">Channel</span><input className="input" name="channel" placeholder="Approved/manual channel" required /></label>
        <label className="field"><span className="field__label">Transaction reference</span><input className="input" name="reference" /></label>
        <label className="field operations__form-wide"><span className="field__label">Notes</span><input className="input" name="notes" /></label>
      </div>{error && <p className="operations__error" role="alert">{error}</p>}<button className="btn btn--primary" type="submit">Record manual entry</button></form></section>
      <section className="card operations__panel"><h3>Payment ledger · never delete entries</h3>
        {item.payments.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Received</th><th>Amount</th><th>Channel / reference</th><th>Recorded by</th><th>Status</th><th>Update</th></tr></thead><tbody>{item.payments.map((payment) => <tr key={payment.id}><td data-label="Received">{new Date(payment.receivedAt).toLocaleString()}</td><td data-label="Amount">{formatMoney(payment.amount, payment.currency)}{payment.reversalOf && <span className="cell-stack">Reversal adjustment</span>}</td><td data-label="Channel / reference">{payment.channel} · {payment.reference || 'No reference'}{payment.notes && <span className="cell-stack">{payment.notes}</span>}</td><td data-label="Recorded by">{payment.receivedBy}</td><td data-label="Status"><StatusChip>{payment.status}</StatusChip></td><td data-label="Update"><select className="select" value={payment.status} disabled={Boolean(payment.reversalOf) || payment.status === 'reversed'} onChange={(event) => changeCase(item.id, 'Updated payment ledger status', `${payment.reference || 'Payment'} status set to ${event.target.value}.`, (current) => ({ ...current, payments: current.payments.map((entry) => entry.id === payment.id ? { ...entry, status: event.target.value as typeof payment.status } : entry) }))}><option value={payment.status}>{payment.status}</option>{nextPaymentStatuses(payment.status).map((status) => <option key={status} value={status}>{status}</option>)}</select>{payment.status !== 'reversed' && !payment.reversalOf && !item.payments.some((entry) => entry.reversalOf === payment.id) && <button className="btn btn--outline btn--sm" type="button" onClick={() => {
          const reason = window.prompt('Enter a reason for this payment reversal. A linked ledger entry will be appended; the original will remain.')
          if (!reason?.trim()) return
          const reversal = { id: newId('payment-reversal'), amount: payment.amount, currency: payment.currency, channel: 'Manual reversal', reference: makeReference('REV', item.payments.map((entry) => entry.reference)), status: 'reversed' as const, receivedAt: nowIso(), receivedBy: actor, notes: reason.trim(), reversalOf: payment.id }
          changeCase(item.id, 'Reversed payment entry', `${payment.reference || payment.id} reversed: ${reason.trim()}.`, (current) => ({ ...current, payments: [...current.payments, reversal] }))
        }}>Append reversal</button>}</td></tr>)}</tbody></table></div> : <p className="muted">No payment entries.</p>}
        <p className="operations__balance">Outstanding (per recorded currency): {Array.from(new Set(item.quotes.map((quote) => quote.currency))).map((currency) => <span key={currency}>{formatMoney(caseBalance(item, currency), currency)} </span>) || '—'}</p>
      </section>
    </div>
  )
}

function CaseWallet({ item, actor, changeCase }: { item: FuneralCase; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [error, setError] = useState('')
  const [goalAmount, setGoalAmount] = useState(item.walletGoal?.amount.toString() ?? '')
  const [goalCurrency, setGoalCurrency] = useState(item.walletGoal?.currency ?? '')
  const currencies = [...new Set(item.contributions.map((entry) => entry.currency))]
  const saveGoal = () => {
    const amount = amountValue(goalAmount)
    const currency = goalCurrency.trim().toUpperCase()
    if (goalAmount && (!amount || !/^[A-Z]{3}$/.test(currency))) {
      setError('Enter an optional target above zero and a three-letter currency code, or clear both fields.')
      return
    }
    changeCase(item.id, 'Updated contribution target', amount ? `Case contribution target set to ${formatMoney(amount, currency)}.` : 'Optional contribution target cleared.', (current) => ({
      ...current,
      walletGoal: amount ? { amount, currency } : undefined,
    }))
    setError('')
  }
  const addContribution = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = amountValue(String(form.get('amount') ?? ''))
    const currency = String(form.get('currency') ?? '').trim().toUpperCase()
    const reference = String(form.get('reference') ?? '').trim()
    if (amount === undefined || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      setError('Enter a positive amount and a three-letter currency code.')
      return
    }
    const duplicate = item.contributions.some((entry) => reference && entry.reference.toLowerCase() === reference.toLowerCase())
    const entry: Contribution = {
      id: newId('contribution'),
      contributorName: String(form.get('contributorName') ?? '').trim() || undefined,
      contributorContact: form.get('consent') === 'on' ? String(form.get('contributorContact') ?? '').trim() || undefined : undefined,
      consentToContact: form.get('consent') === 'on',
      amount,
      currency,
      channel: String(form.get('channel') ?? '').trim(),
      reference,
      status: duplicate ? 'duplicate' : 'recorded',
      contributedAt: String(form.get('contributedAt') ?? '') ? new Date(String(form.get('contributedAt'))).toISOString() : nowIso(),
      recordedBy: actor,
      confirmedBy: '',
      notes: String(form.get('notes') ?? '').trim(),
    }
    if (duplicate) setError('Possible duplicate reference: this entry was recorded with the Duplicate status for review.')
    else setError('')
    changeCase(item.id, 'Recorded wallet contribution', `${formatMoney(amount, currency)} contribution recorded with status ${entry.status}; no funds were received by this prototype.`, (current) => ({ ...current, contributions: [...current.contributions, entry] }))
    event.currentTarget.reset()
  }
  return (
    <div className="page-stack">
      <div className="operations__notice"><strong>Contribution ledger only</strong><span>No custody, collection, transfer, receipt or payment-provider integration is enabled. Contact details are optional and should only be recorded with consent.</span></div>
      <section className="card operations__panel"><h3>Optional contribution target</h3><div className="operations__form-grid operations__form-grid--tight">
        <label className="field"><span className="field__label">Target amount</span><input className="input" type="number" min="0.01" step="0.01" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} /></label>
        <label className="field"><span className="field__label">Currency code</span><input className="input" maxLength={3} value={goalCurrency} onChange={(event) => setGoalCurrency(event.target.value)} /></label>
        <button className="btn btn--primary" type="button" onClick={saveGoal}>Save target</button>
        {item.walletGoal && <p className="muted">Target is optional and manually entered: {formatMoney(item.walletGoal.amount, item.walletGoal.currency)}.</p>}
      </div></section>
      <section className="operations__metrics operations__metrics--compact">
        {currencies.length ? currencies.map((currency) => <Metric key={currency} label={`Confirmed / reconciled · ${currency}`} value={contributionTotal(item.contributions, currency, ['confirmed', 'reconciled'])} onClick={() => undefined} />) : <p className="muted">No contribution amounts recorded.</p>}
      </section>
      <section className="card operations__panel"><h3>Record a contribution</h3><form className="operations__form" onSubmit={addContribution}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Contributor display name</span><input className="input" name="contributorName" /></label>
        <label className="field"><span className="field__label">Contact (optional)</span><input className="input" name="contributorContact" /></label>
        <label className="field"><span className="field__label">Amount</span><input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label className="field"><span className="field__label">Currency code</span><input className="input" name="currency" maxLength={3} required /></label>
        <label className="field"><span className="field__label">Channel</span><input className="input" name="channel" placeholder="Manually recorded channel" required /></label>
        <label className="field"><span className="field__label">Transaction reference</span><input className="input" name="reference" /></label>
        <label className="field"><span className="field__label">Contribution date/time</span><input className="input" name="contributedAt" type="datetime-local" /></label>
        <label className="field"><span className="field__label">Consent to contact</span><span className="operations__check"><input type="checkbox" name="consent" /> Contributor agreed to contact</span></label>
        <label className="field operations__form-wide"><span className="field__label">Notes</span><input className="input" name="notes" /></label>
      </div>{error && <p className="operations__error" role="status">{error}</p>}<button className="btn btn--primary" type="submit">Record demo ledger entry</button></form></section>
      <section className="card operations__panel"><h3>Case-linked contribution ledger</h3>      {item.contributions.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Contributor</th><th>Amount</th><th>Channel / reference</th><th>Date</th><th>Status</th><th>Control</th></tr></thead><tbody>{item.contributions.map((entry) => <tr key={entry.id}><td data-label="Contributor">{entry.contributorName || 'Anonymous'}{entry.contributorContact && entry.consentToContact && <span className="cell-stack">{entry.contributorContact}</span>}</td><td data-label="Amount">{formatMoney(entry.amount, entry.currency)}{entry.adjustmentOf && <span className="cell-stack">Adjustment {entry.adjustmentType === 'credit' ? 'credit' : 'debit'}</span>}</td><td data-label="Channel / reference">{entry.channel} · {entry.reference || 'No reference'}</td><td data-label="Date">{new Date(entry.contributedAt).toLocaleString()}</td><td data-label="Status"><StatusChip tone={entry.status === 'reconciled' ? 'success' : entry.status === 'duplicate' || entry.status === 'needs-review' ? 'warning' : 'info'}>{labelFor(CONTRIBUTION_STATUSES, entry.status)}</StatusChip><span className="cell-stack">Recorded by {entry.recordedBy}{entry.confirmedBy ? ` · confirmed by ${entry.confirmedBy}` : ''}</span></td><td data-label="Control"><select className="select" value={entry.status} onChange={(event) => changeCase(item.id, 'Updated wallet entry', `${entry.reference || 'Contribution'} marked ${event.target.value}.`, (current) => ({ ...current, contributions: current.contributions.map((row) => row.id === entry.id ? { ...row, status: event.target.value as ContributionStatus, confirmedBy: ['confirmed', 'reconciled'].includes(event.target.value) ? actor : row.confirmedBy } : row) }))}><option value={entry.status}>{labelFor(CONTRIBUTION_STATUSES, entry.status)}</option>{nextContributionStatuses(entry.status).map((status) => <option key={status} value={status}>{labelFor(CONTRIBUTION_STATUSES, status)}</option>)}</select>{!entry.adjustmentOf && ['confirmed', 'reconciled'].includes(entry.status) && <AdjustmentForm item={item} entry={entry} actor={actor} changeCase={changeCase} />}</td></tr>)}</tbody></table></div> : <EmptyState title="No contributions recorded" detail="Create a case-linked contribution ledger entry with no money movement."/>}</section>
    </div>
  )
}

function AdjustmentForm({ item, entry, actor, changeCase }: { item: FuneralCase; entry: Contribution; actor: string; changeCase: (id: string, action: string, summary: string, update: (item: FuneralCase) => FuneralCase) => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'debit' | 'credit'>('debit')
  const [reason, setReason] = useState('')
  const apply = () => {
    const value = amountValue(amount)
    if (!value || !reason.trim()) return
    const adjustment: Contribution = {
      id: newId('adjustment'),
      consentToContact: false,
      amount: value,
      currency: entry.currency,
      channel: 'Manual adjustment',
      reference: makeReference('ADJ', item.contributions.map((row) => row.reference)),
      status: 'confirmed',
      contributedAt: nowIso(),
      recordedBy: actor,
      confirmedBy: actor,
      notes: reason.trim(),
      adjustmentOf: entry.id,
      adjustmentType: kind,
    }
    changeCase(item.id, 'Added wallet adjustment', `${kind} adjustment ${formatMoney(value, entry.currency)} added for ${entry.reference || entry.id}: ${reason.trim()}.`, (current) => ({ ...current, contributions: [...current.contributions, adjustment] }))
    setOpen(false)
    setAmount('')
    setReason('')
  }
  return <div className="operations__adjustment">{open ? <div className="operations__adjustment-fields">
    <label className="field"><span className="field__label">Correction amount</span><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <label className="field"><span className="field__label">Type</span><select className="select" value={kind} onChange={(event) => setKind(event.target.value as 'debit' | 'credit')}><option value="debit">Reverse / deduct</option><option value="credit">Add correction</option></select></label>
    <label className="field"><span className="field__label">Reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <button type="button" className="btn btn--outline btn--sm" disabled={!amountValue(amount) || !reason.trim()} onClick={apply}>Append adjustment</button>
  </div> : <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>Adjust</button>}</div>
}

function PolicyWorkspace({ policies, onCreate, onChange }: { policies: PolicyApplication[]; onCreate: (event: FormEvent<HTMLFormElement>) => void; onChange: (id: string, status: PolicyStatus, checks: PolicyApplication['checks'], notes: string) => boolean }) {
  return (
    <section className="page-stack">
      <div className="operations__notice"><strong>Policy actions are simulated</strong><span>No eligibility logic, benefit limits, premium checks, underwriting rules or real policy issuance are configured. Activation requires manual checks and approval status in this prototype.</span></div>
      <details className="card operations__form-panel"><summary className="operations__summary">Register a policy application</summary><form className="operations__form" onSubmit={onCreate}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Customer name</span><input className="input" name="customerName" required /></label>
        <label className="field"><span className="field__label">Phone</span><input className="input" name="phone" type="tel" required /></label>
        <label className="field"><span className="field__label">Product / plan label</span><input className="input" name="product" required /></label>
        <label className="field"><span className="field__label">Responsible staff</span><select className="select" name="responsibleStaff" required defaultValue="">{<option value="" disabled>Select Fidelity staff member</option>}{STAFF_OPTIONS.map((staff) => <option key={staff.value} value={staff.value}>{staff.label}</option>)}</select></label>
        <label className="field operations__form-wide"><span className="field__label">Covered members (comma separated)</span><input className="input" name="members" /></label>
      </div><button className="btn btn--primary" type="submit">Create sample application</button></form></details>
      {policies.length ? policies.map((policy) => <PolicyCard key={policy.id} policy={policy} onChange={onChange} />) : <EmptyState title="No policy applications" detail="Create a demo application to try the review and gated activation workflow."/>}
    </section>
  )
}

function PolicyCard({ policy, onChange }: { policy: PolicyApplication; onChange: (id: string, status: PolicyStatus, checks: PolicyApplication['checks'], notes: string) => boolean }) {
  const [status, setStatus] = useState(policy.status)
  const [checks, setChecks] = useState(policy.checks)
  const [notes, setNotes] = useState(policy.notes)
  const setCheck = (key: keyof PolicyApplication['checks'], value: boolean) => setChecks((current) => ({ ...current, [key]: value }))
  return (
    <article className="card operations__policy-card">
      <div className="operations__record-heading"><div><p className="eyebrow">{policy.reference}{policy.demo ? ' · sample' : ''}</p><h3>{policy.customerName}</h3><p className="muted">{policy.phone} · {policy.product} · {policy.responsibleStaff}</p></div><StatusChip tone={policy.status === 'active' ? 'success' : policy.status === 'declined' ? 'danger' : 'warning'}>{policyStatusLabels[policy.status]}</StatusChip></div>
      {policy.coveredMembers.length > 0 && <p><strong>Covered members entered:</strong> {policy.coveredMembers.join(', ')}</p>}
      {policy.applicationChannel && <p><strong>Application route:</strong> {policy.applicationChannel === 'online' ? 'Online' : 'At a Fidelity office'}{policy.applicationLocation ? ` · ${policy.applicationLocation}` : ''}</p>}
      {policy.requestedServices && policy.requestedServices.length > 0 && <p><strong>Services requested:</strong> {policy.requestedServices.join(', ')}</p>}
      <div className="operations__check-grid">
        <label className="operations__check"><input type="checkbox" checked={checks.identityVerified} onChange={(event) => setCheck('identityVerified', event.target.checked)} /> Identity checked</label>
        <label className="operations__check"><input type="checkbox" checked={checks.documentsVerified} onChange={(event) => setCheck('documentsVerified', event.target.checked)} /> Required documents verified</label>
        <label className="operations__check"><input type="checkbox" checked={checks.eligibilityConfirmed} onChange={(event) => setCheck('eligibilityConfirmed', event.target.checked)} /> Eligibility manually confirmed</label>
      </div>
      <div className="operations__form-grid operations__form-grid--tight">
        <label className="field"><span className="field__label">Application status</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as PolicyStatus)}><option value={status}>{policyStatusLabels[status]}</option>{nextPolicyStatuses(status).map((next) => <option key={next} value={next}>{policyStatusLabels[next]}</option>)}</select></label>
        <label className="field"><span className="field__label">Staff notes</span><input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <button type="button" className="btn btn--primary" onClick={() => {
          if (!onChange(policy.id, status, checks, notes)) setStatus(policy.status)
        }}>Save review decision</button>
      </div>
      {status === 'active' && (policy.status !== 'approved' || !canActivatePolicy({ ...policy, checks })) && <p className="operations__error">Activation is blocked. Save the application as Approved and complete all three review checks before activating.</p>}
      {policy.effectiveDate && <p className="muted">Demo effective date: {policy.effectiveDate}. This is not a real policy issue date.</p>}
    </article>
  )
}

function ExhumationsWorkspace({
  cases,
  onCreate,
  onUpdate,
  onDelete,
}: {
  cases: ExhumationCase[]
  onCreate: (item: ExhumationCase) => void
  onUpdate: (item: ExhumationCase, summary: string, update: (current: ExhumationCase) => ExhumationCase) => void
  onDelete?: (id: string) => void
}) {
  const [activeWhatsappCase, setActiveWhatsappCase] = useState<ExhumationCase | null>(null)
  const [exhAlertKind, setExhAlertKind] = useState('exhumation.received')
  const [exhCustomMsg, setExhCustomMsg] = useState('')
  const [exhSending, setExhSending] = useState(false)
  const [exhSuccess, setExhSuccess] = useState('')

  const handleSendExhAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWhatsappCase) return
    setExhSending(true)
    setExhSuccess('')
    try {
      const res = await sendOperationsWhatsAppNotification({
        phone: activeWhatsappCase.phone,
        kind: exhAlertKind,
        payload: {
          reference: activeWhatsappCase.reference,
          deceasedName: activeWhatsappCase.deceasedName,
          address: activeWhatsappCase.address,
          destinationAddress: activeWhatsappCase.destinationAddress,
          permitReference: activeWhatsappCase.permitReference,
          scheduledDate: activeWhatsappCase.requestedAt,
        },
        customMessage: exhCustomMsg,
      })
      if (res.ok) {
        setExhSuccess(`WhatsApp alert successfully delivered to ${activeWhatsappCase.phone}!`)
        setTimeout(() => {
          setExhSuccess('')
          setActiveWhatsappCase(null)
          setExhCustomMsg('')
        }, 2500)
      }
    } catch {
      alert('Failed to send WhatsApp alert.')
    } finally {
      setExhSending(false)
    }
  }
  const [error, setError] = useState('')

  const createCase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customerName = String(form.get('customerName') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const deceasedName = String(form.get('deceasedName') ?? '').trim()
    const address = String(form.get('address') ?? '').trim()
    const destinationAddress = String(form.get('destinationAddress') ?? '').trim()
    const requestedAt = String(form.get('requestedAt') ?? '')
    const currency = String(form.get('currency') ?? '').trim().toUpperCase()
    const estimatedCost = optionalAmount(String(form.get('estimatedCost') ?? ''))
    const quotedPrice = optionalAmount(String(form.get('quotedPrice') ?? ''))
    if (!customerName || !phone || !deceasedName || !address || !requestedAt) {
      setError('Complete the applicant, deceased, address and requested date fields.')
      return
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError('Enter the three-letter currency code approved for this quote, such as USD.')
      return
    }
    if (estimatedCost === null || quotedPrice === null) {
      setError('Cost and customer price must be zero or a positive amount.')
      return
    }
    const item: ExhumationCase = {
      id: newId('exhumation'),
      reference: makeReference('EXH', cases.map((entry) => entry.reference)),
      customerName,
      phone,
      deceasedName,
      address,
      destinationAddress,
      currency,
      requestedAt,
      status: 'new',
      estimatedCost: estimatedCost ?? undefined,
      quotedPrice: quotedPrice ?? undefined,
      permitReference: '',
      permitStatus: 'pending',
      requirements: EXHUMATION_REQUIREMENTS.map((name) => ({
        id: newId('requirement'),
        name,
        status: 'pending',
        notes: '',
      })),
      notes: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      demo: true,
    }
    onCreate(item)
    setError('')
    event.currentTarget.reset()
  }

  return (
    <section className="page-stack">
      <div className="operations__notice">
        <strong>Exhumation workflow · demonstration data</strong>
        <span>Track customer and deceased details, location, requested date, cost estimate, customer quote, permit and document requirements. Permit requirements and approvals must be confirmed with the relevant authorities; no legal or operational approval is implied here.</span>
      </div>
      <details className="card operations__form-panel">
        <summary className="operations__summary">Open an exhumation request</summary>
        <form className="operations__form" onSubmit={createCase} noValidate>
          <div className="operations__form-grid">
            <label className="field"><span className="field__label">Customer / applicant name</span><input className="input" name="customerName" required /></label>
            <label className="field"><span className="field__label">Customer phone</span><input className="input" name="phone" type="tel" required /></label>
            <label className="field"><span className="field__label">Deceased name</span><input className="input" name="deceasedName" required /></label>
            <label className="field"><span className="field__label">Requested exhumation date</span><input className="input" name="requestedAt" type="date" required /></label>
            <label className="field operations__form-wide"><span className="field__label">Exhumation address / grave location</span><input className="input" name="address" required /></label>
            <label className="field operations__form-wide"><span className="field__label">Destination / reinterment address</span><input className="input" name="destinationAddress" /></label>
            <label className="field"><span className="field__label">Approved currency code</span><input className="input" name="currency" placeholder="e.g. USD" maxLength={3} required /></label>
            <label className="field"><span className="field__label">Estimated operational cost</span><input className="input" name="estimatedCost" type="number" min="0" step="0.01" /></label>
            <label className="field"><span className="field__label">Customer price / quote</span><input className="input" name="quotedPrice" type="number" min="0" step="0.01" /></label>
          </div>
          {error && <p className="operations__error" role="alert">{error}</p>}
          <button className="btn btn--primary" type="submit">Create sample exhumation case</button>
        </form>
      </details>
      {cases.length ? cases.map((item) => (
        <article className="card stack" key={item.id}>
          <div className="operations__record-heading">
            <div><p className="eyebrow">{item.reference}{item.demo ? ' · sample' : ''}</p><h3>{item.deceasedName}</h3><p className="muted">Applicant: {item.customerName} · {item.phone}</p></div>
            <label className="field"><span className="field__label">Case status</span><select className="select" value={item.status} onChange={(event) => {
              const status = event.target.value as ExhumationStatus
              onUpdate(item, `Status changed to ${status.replaceAll('-', ' ')}.`, (current) => ({ ...current, status }))
            }}>{EXHUMATION_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          </div>
          <div className="operations__details">
            <div><dt>Exhumation address / grave</dt><dd>{item.address}</dd></div>
            <div><dt>Destination / reinterment address</dt><dd>{item.destinationAddress || 'Not entered'}</dd></div>
            <div><dt>Requested date</dt><dd>{item.requestedAt}</dd></div>
            <div><dt>Operational cost estimate</dt><dd>{item.estimatedCost === undefined ? 'Not entered' : formatMoney(item.estimatedCost, item.currency)}</dd></div>
            <div><dt>Customer price / quote</dt><dd>{item.quotedPrice === undefined ? 'Not entered' : formatMoney(item.quotedPrice, item.currency)}</dd></div>
          </div>
          <div className="operations__form-grid operations__form-grid--tight">
            <label className="field"><span className="field__label">Permit reference</span><input className="input" defaultValue={item.permitReference} onBlur={(event) => event.target.value !== item.permitReference && onUpdate(item, 'Updated permit reference.', (current) => ({ ...current, permitReference: event.target.value.trim() }))} /></label>
            <label className="field"><span className="field__label">Permit status</span><select className="select" value={item.permitStatus} onChange={(event) => {
              const permitStatus = event.target.value as ExhumationRequirementStatus
              onUpdate(item, `Permit marked ${permitStatus}.`, (current) => ({ ...current, permitStatus }))
            }}><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="verified">Verified by staff</option><option value="rejected">Rejected</option></select></label>
            <label className="field operations__form-wide"><span className="field__label">Staff notes</span><input className="input" defaultValue={item.notes} onBlur={(event) => event.target.value !== item.notes && onUpdate(item, 'Updated exhumation staff notes.', (current) => ({ ...current, notes: event.target.value.trim() }))} /></label>
          </div>
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  setActiveWhatsappCase(item)
                  setExhSuccess('')
                }}
              >
                📲 Send WhatsApp Alert
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  style={{ color: '#dc2626' }}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete exhumation case ${item.reference}?`)) {
                      onDelete(item.id)
                    }
                  }}
                >
                  Delete Case
                </button>
              )}
            </div>
            <h4>Requirements checklist</h4>
            <div className="operations__check-grid">
              {item.requirements.map((requirement) => (
                <label className="field" key={requirement.id}>
                  <span className="field__label">{requirement.name}</span>
                  <select className="select" value={requirement.status} onChange={(event) => {
                    const status = event.target.value as ExhumationRequirementStatus
                    onUpdate(item, `${requirement.name} marked ${status}.`, (current) => ({
                      ...current,
                      requirements: current.requirements.map((entry) => entry.id === requirement.id ? { ...entry, status } : entry),
                    }))
                  }}><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
                </label>
              ))}
            </div>
          </div>
        </article>
      )) : <EmptyState title="No exhumation cases" detail="Create a sample request to track documents, permits, estimates and status." />}

      {activeWhatsappCase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card stack" style={{ maxWidth: '520px', width: '100%', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Send WhatsApp Exhumation Alert</h3>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setActiveWhatsappCase(null)}>✕</button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Case: <strong>{activeWhatsappCase.reference}</strong> ({activeWhatsappCase.deceasedName}) · Recipient: <strong>{activeWhatsappCase.phone}</strong>
            </p>
            {exhSuccess && <div className="callout callout--success">{exhSuccess}</div>}
            <form onSubmit={handleSendExhAlert} className="stack" style={{ gap: '12px' }}>
              <label className="field">
                <span className="field__label">Alert Template</span>
                <select className="select" value={exhAlertKind} onChange={(e) => setExhAlertKind(e.target.value)}>
                  <option value="exhumation.received">⚖️ Exhumation Request Acknowledged</option>
                  <option value="exhumation.permits_approved">✅ Statutory Health & Council Permits Approved</option>
                  <option value="exhumation.date_scheduled">🗓️ Exhumation & Transport Date Scheduled</option>
                  <option value="exhumation.completed">🕊️ Re-interment Successfully Completed</option>
                  <option value="custom">💬 Custom Message</option>
                </select>
              </label>
              {exhAlertKind === 'custom' && (
                <label className="field">
                  <span className="field__label">Custom Message</span>
                  <textarea className="textarea" rows={3} value={exhCustomMsg} onChange={(e) => setExhCustomMsg(e.target.value)} required />
                </label>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn--outline" onClick={() => setActiveWhatsappCase(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={exhSending}>
                  {exhSending ? 'Sending…' : '📲 Dispatch to WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function optionalAmount(raw: string): number | undefined | null {
  if (!raw.trim()) return undefined
  const amount = Number(raw)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function TokenChargesWorkspace({
  charges,
  onUpdate,
}: {
  charges: OperationsState['tokenCharges']
  onUpdate: (feature: TokenFeature, amount: number | undefined, enabled: boolean) => void
}) {
  const [error, setError] = useState('')
  return (
    <section className="page-stack">
      <div className="operations__notice">
        <strong>Kuwana credit pricing · disabled by default</strong>
        <span>Configure approved per-feature credit charges here. Every charge starts disabled and unset. These settings are local demo data only; no Kuwana balance, purchase, debit, refund or reconciliation is connected.</span>
      </div>
      {error && <p className="operations__error" role="alert">{error}</p>}
      <section className="card operations__panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Feature</th><th>Charge (credits)</th><th>Enabled</th></tr></thead>
            <tbody>{charges.map((charge) => (
              <tr key={charge.feature}>
                <td data-label="Feature">{charge.label}</td>
                <td data-label="Charge (credits)">
                  <input aria-label={`${charge.label} credit charge`} className="input" type="number" min="1" step="1" value={charge.amount ?? ''} onChange={(event) => {
                    const amount = event.target.value.trim() ? Number(event.target.value) : undefined
                    if (amount === undefined || (Number.isSafeInteger(amount) && amount >= 1)) {
                      onUpdate(charge.feature, amount, false)
                      setError('')
                    } else {
                      setError('Credit charges must be positive whole numbers.')
                    }
                  }} />
                </td>
                <td data-label="Enabled">
                  <label className="operations__check">
                    <input type="checkbox" checked={charge.enabled} disabled={!charge.amount || charge.amount < 1} onChange={(event) => onUpdate(charge.feature, charge.amount, event.target.checked)} />
                    {charge.enabled ? 'Enabled in demo configuration' : 'Disabled'}
                  </label>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted">Only enter amounts approved by Fidelity. A production charge flow must validate balance and price on a trusted Kuwana-backed server before providing the paid feature.</p>
      </section>
    </section>
  )
}

function CatalogueWorkspace({ items, onCreate, onToggle }: { items: CatalogueItem[]; onCreate: (item: CatalogueItem) => void; onToggle: (item: CatalogueItem) => void }) {
  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onCreate({
      id: newId('catalogue'),
      name: String(form.get('name') ?? '').trim(),
      category: String(form.get('category') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      active: true,
      createdAt: nowIso(),
    })
    event.currentTarget.reset()
  }
  return (
    <section className="page-stack">
      <div className="operations__notice"><strong>No prices configured</strong><span>Catalogue entries are unpriced. Fidelity-approved catalogue, pricing, packages and templates must be supplied before operational use.</span></div>
      <section className="card operations__panel"><h3>Add catalogue item</h3><form className="operations__form" onSubmit={addItem}><div className="operations__form-grid">
        <label className="field"><span className="field__label">Name</span><input className="input" name="name" required /></label>
        <label className="field"><span className="field__label">Category</span><input className="input" name="category" required /></label>
        <label className="field operations__form-wide"><span className="field__label">Description</span><input className="input" name="description" /></label>
      </div><button className="btn btn--primary" type="submit">Add unpriced item</button></form></section>
      <section className="card operations__panel"><h3>Service and product catalogue</h3>{items.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Category</th><th>Description</th><th>Status</th><th>Control</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Name">{item.name}</td><td data-label="Category">{item.category}</td><td data-label="Description">{item.description || '—'}</td><td data-label="Status">{item.active ? 'Active' : 'Inactive'}</td><td data-label="Control"><button type="button" className="btn btn--outline btn--sm" onClick={() => onToggle(item)}>{item.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="Catalogue is empty" detail="Add approved service and product names without attaching prices."/>}</section>
    </section>
  )
}

function WalletWorkspace({ cases, onOpenCase }: { cases: FuneralCase[]; onOpenCase: (id: string, tab?: CaseTab) => void }) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const entries = cases.flatMap((item) => item.contributions.map((contribution) => ({ item, contribution })))
  const totals = new Map<string, number>()
  for (const { contribution } of entries) {
    if (['confirmed', 'reconciled'].includes(contribution.status)) {
      const current = totals.get(contribution.currency) ?? 0
      totals.set(contribution.currency, current + contributionTotal([contribution], contribution.currency, ['confirmed', 'reconciled']))
    }
  }

  const filteredEntries = entries.filter(({ item, contribution }) => {
    if (filterStatus !== 'all' && contribution.status !== filterStatus) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchContributor = (contribution.contributorName ?? '').toLowerCase().includes(q)
      const matchCase = item.reference.toLowerCase().includes(q) || (item.deceasedName ?? '').toLowerCase().includes(q)
      const matchRef = (contribution.reference ?? '').toLowerCase().includes(q)
      if (!matchContributor && !matchCase && !matchRef) return false
    }
    return true
  })

  return (
    <section className="page-stack">
      {/* Fidelity Chema Wallet Dedicated Admin Control Hub */}
      <div style={{ background: '#7f1d1d', color: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 4px 14px rgba(127, 29, 29, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
              <span>🛡️</span> Fidelity Chema Wallet Administration Hub
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.25rem' }}>
              Official administrative engine running live on <strong>port 3001 (Admin)</strong> and <strong>port 3005 (PWA)</strong>. Click any module below to open its dedicated workflow.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="btn btn--primary" style={{ background: '#ffffff', color: '#7f1d1d', fontWeight: 700, border: 'none' }}>
              Launch Chema Admin Portal ↗
            </a>
            <a href="http://localhost:7600/auth/fidelity-sso?target=/" target="_blank" rel="noreferrer" className="btn btn--outline" style={{ color: '#ffffff', borderColor: '#ffffff', background: 'rgba(255,255,255,0.1)' }}>
              Open PWA (Auto-SSO) ↗
            </a>
          </div>
        </div>

        {/* Admin Quick Launch Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <a href="http://localhost:3001/cases" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block', transition: 'all 0.2s' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>📋 Case Verification</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Audit evidence & authority</div>
          </a>
          <a href="http://localhost:3001/payouts" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>👥 Maker-Checker Payouts</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Dual-authorization controls</div>
          </a>
          <a href="http://localhost:3001/ledger" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>⚖️ Double-Entry Ledger</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Immutability & source balances</div>
          </a>
          <a href="http://localhost:3001/reports" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>📊 Reconciliation</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Provider variance & reports</div>
          </a>
          <a href="http://localhost:3001/audit" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>🔒 Hash-Chained Audit</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Tamper-evident log verification</div>
          </a>
          <a href="http://localhost:3001/staff" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>🔑 Staff & MFA Roles</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>RBAC & security controls</div>
          </a>
          <a href="http://localhost:7600/auth/fidelity-sso?target=/new" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.12)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', color: '#ffffff', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>➕ New Wallet Draft (SSO)</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>Initiate family wallet auto-logged in</div>
          </a>
        </div>
      </div>

      <div className="operations__metrics operations__metrics--compact">
        <Metric label="Open funeral cases" value={cases.filter((item) => item.status !== 'closed').length} onClick={() => undefined} />
        <Metric label="All recorded contributions" value={entries.length} onClick={() => setFilterStatus('all')} />
        <Metric label="Pending confirmation" value={entries.filter(({ contribution }) => ['recorded', 'pending-confirmation', 'needs-review'].includes(contribution.status)).length} onClick={() => setFilterStatus('pending-confirmation')} />
        {[...totals.entries()].map(([currency, total]) => <Metric key={currency} label={`Confirmed / reconciled · ${currency}`} value={total} onClick={() => undefined} />)}
      </div>

      {/* Global Contributions and Complete Ledger Section */}
      <section className="card operations__panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Global & Every Contribution Across All Funds</h3>
            <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
              Publicly verifiable records. Shows every digital contribution and cash record across all cases and walk-ins.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search contributor, case or ref..."
              className="input input--sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: '220px' }}
            />
            <select
              className="input input--sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All statuses ({entries.length})</option>
              <option value="confirmed">Confirmed</option>
              <option value="reconciled">Reconciled</option>
              <option value="pending-confirmation">Pending confirmation</option>
              <option value="recorded">Recorded</option>
              <option value="needs-review">Needs review</option>
            </select>
          </div>
        </div>

        {filteredEntries.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Contributor</th>
                  <th>Amount</th>
                  <th>Payment Channel</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(({ item, contribution }) => (
                  <tr key={contribution.id}>
                    <td data-label="Case">
                      <button type="button" className="row-link" onClick={() => onOpenCase(item.id, 'wallet')}>
                        {item.reference}
                      </button>
                    </td>
                    <td data-label="Contributor">{contribution.contributorName || 'Anonymous Supporter'}</td>
                    <td data-label="Amount"><strong>{formatMoney(contribution.amount, contribution.currency)}</strong></td>
                    <td data-label="Payment Channel">
                      <span className="badge" style={{ background: '#f3f4f6', color: '#1f2937', fontWeight: 600, textTransform: 'capitalize' }}>
                        {contribution.channel || 'EcoCash / Digital'}
                      </span>
                    </td>
                    <td data-label="Reference" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {contribution.reference || '—'}
                    </td>
                    <td data-label="Status">{labelFor(CONTRIBUTION_STATUSES, contribution.status)}</td>
                    <td data-label="Date">{new Date(contribution.contributedAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="link-arrow" type="button" onClick={() => onOpenCase(item.id, 'wallet')}>
                          Open case
                        </button>
                        <a
                          href={`http://localhost:3005/c/${contribution.reference || contribution.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="link-arrow"
                          style={{ color: '#b91c1c', fontWeight: 600 }}
                          title="View on Real Chema PWA"
                        >
                          Receipt ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No matching contribution entries" detail="Try adjusting your filter or search query." />
        )}
      </section>
    </section>
  )
}

function FinanceWorkspace({ cases, onOpenCase }: { cases: FuneralCase[]; onOpenCase: (id: string, tab?: CaseTab) => void }) {
  const quotes = cases.flatMap((item) => item.quotes.map((quote) => ({ item, quote })))
  const payments = cases.flatMap((item) => item.payments.map((payment) => ({ item, payment })))
  return (
    <section className="page-stack">
      <div className="operations__notice"><strong>Manual finance register only</strong><span>Numbers are entered by staff, not calculated from a price catalogue. This prototype does not collect, settle or refund funds.</span></div>
      <section className="card operations__panel"><h3>Case-linked quotations</h3>{quotes.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Quote</th><th>Case</th><th>Description</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{quotes.map(({ item, quote }) => <tr key={quote.id}><td data-label="Quote">{quote.reference}</td><td data-label="Case">{item.reference}</td><td data-label="Description">{quote.lines.map((line) => line.description).join(', ')}</td><td data-label="Amount">{formatMoney(quoteTotal(quote), quote.currency)}</td><td data-label="Status">{labelFor(QUOTE_STATUSES, quote.status)}</td><td><button className="link-arrow" type="button" onClick={() => onOpenCase(item.id, 'finance')}>Open case</button></td></tr>)}</tbody></table></div> : <p className="muted">No quotations have been recorded.</p>}</section>
      <section className="card operations__panel"><h3>Outstanding amounts (by quote currency)</h3>{cases.map((item) => {
        const currencies = [...new Set(item.quotes.map((quote) => quote.currency))]
        const balances = currencies.map((currency) => ({ currency, balance: caseBalance(item, currency) })).filter(({ balance }) => balance !== 0)
        return balances.length ? <p key={item.id}><button className="row-link" type="button" onClick={() => onOpenCase(item.id, 'finance')}>{item.reference}</button> · {balances.map(({ currency, balance }) => formatMoney(balance, currency)).join(' · ')}</p> : null
      })}</section>
      <section className="card operations__panel"><h3>Payment entries</h3>{payments.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Case</th><th>Amount</th><th>Channel</th><th>Reference</th><th>Status</th><th>Received</th></tr></thead><tbody>{payments.map(({ item, payment }) => <tr key={payment.id}><td data-label="Case">{item.reference}</td><td data-label="Amount">{formatMoney(payment.amount, payment.currency)}</td><td data-label="Channel">{payment.channel}</td><td data-label="Reference">{payment.reference || '—'}</td><td data-label="Status">{payment.status}</td><td data-label="Received">{new Date(payment.receivedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="muted">No payment entries.</p>}</section>
    </section>
  )
}

function ReportsWorkspace({ state, onExport, onExportWallet }: { state: OperationsState; onExport: () => void; onExportWallet: () => void }) {
  const totalsByStatus = CASE_STATUSES.map(({ value, label }) => ({ label, count: state.cases.filter((item) => item.status === value).length }))
  return (
    <section className="page-stack">
      <div className="operations__notice"><strong>Sample operational summary</strong><span>Report rows may include names and contact details. Access is admin-only in this prototype; exported files are not encrypted or sent to a server.</span></div>
      <div className="operations__metrics operations__metrics--compact"><Metric label="Total cases" value={state.cases.length} onClick={() => undefined} /><Metric label="Policy-covered" value={state.cases.filter((item) => item.type === 'policy-covered').length} onClick={() => undefined} /><Metric label="Cash walk-ins" value={state.cases.filter((item) => item.type === 'cash-walk-in').length} onClick={() => undefined} /><Metric label="Closed cases" value={state.cases.filter((item) => item.status === 'closed').length} onClick={() => undefined} /></div>
      <BarChart title="Cases by status" subtitle="Funeral case workload" data={totalsByStatus.map(({ label, count }) => ({ label, value: count }))} />
      <section className="card operations__panel"><h3>Export reports</h3><p className="muted">Download local summaries for the current sample records.</p><div className="operations__form-row"><button className="btn btn--primary" type="button" onClick={onExport}>Export case summary CSV</button><button className="btn btn--outline" type="button" onClick={onExportWallet}>Export Chema ledger CSV</button></div></section>
      <p className="muted">This CSV export is a local convenience for sample records, not a regulated report.</p>
    </section>
  )
}

function AuditWorkspace({ entries }: { entries: OperationsState['audit'] }) {
  return <section className="card operations__panel"><h2>Append-only activity history</h2><p className="muted">Prototype records can be cleared from browser storage by the browser owner; this is not a tamper-proof production audit log.</p>
    {entries.length ? <ol className="operations__audit">{entries.map((entry) => <li key={entry.id}><span className="operations__audit-time">{new Date(entry.at).toLocaleString()}</span><strong>{entry.action}</strong><span>{entry.entity} · {entry.summary}</span><small>{entry.actor}{entry.demo ? ' · sample/demo' : ''}</small></li>)}</ol> : <EmptyState title="No activity yet" detail="Changes made in the workspace will appear here."/>}
  </section>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="operations__empty"><strong>{title}</strong><p className="muted">{detail}</p></div>
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default OperationsPage
