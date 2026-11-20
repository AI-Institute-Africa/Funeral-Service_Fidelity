import ExcelJS from 'exceljs'

export type PolicyImportLayout = 'policy-per-row' | 'member-per-row'
export type ImportedMember = { name: string; relationship: string; share?: number }
export type ImportedPolicy = {
  policyNumber: string
  holderName: string
  phoneNumber: string
  status: 'ACTIVE' | 'GRACE' | 'LAPSED'
  planName: string
  coverAmount: number
  monthlyPremium: number
  startDate: string
  monthsPaid: number
  waitingPeriodMonths: number
  members: ImportedMember[]
}

export type WorkbookIssue = { row: number; field: string; message: string }
export type WorkbookPreview = {
  policies: ImportedPolicy[]
  rowsRead: number
  issues: WorkbookIssue[]
}

const COMMON_HEADERS = [
  'policy_number',
  'holder_name',
  'phone_number',
  'status',
  'plan_name',
  'cover_amount',
  'monthly_premium',
  'start_date',
  'months_paid',
  'waiting_period_months',
] as const

const MEMBER_HEADERS = ['member_name', 'member_relationship', 'member_share'] as const
const WIDE_HEADERS = ['covered_members'] as const
const MAX_ROWS = 20_000
const MAX_POLICIES = 10_000

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return ''
}

function rowDate(value: ExcelJS.CellValue): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = cellText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return text
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCDate() === day && parsed.getUTCMonth() === month - 1 && parsed.getUTCFullYear() === year) {
      return parsed.toISOString().slice(0, 10)
    }
  }
  return ''
}

function parseAmount(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const value = Number(raw.replaceAll(',', ''))
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

function parseInteger(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : undefined
}

function addIssue(issues: WorkbookIssue[], row: number, field: string, message: string) {
  if (issues.length < 500) issues.push({ row, field, message })
}

function parseMemberCell(raw: string, row: number, issues: WorkbookIssue[]): ImportedMember[] {
  if (!raw.trim()) {
    addIssue(issues, row, 'covered_members', 'Enter at least one member as Name|Relationship|Share; separate members with semicolons.')
    return []
  }
  const members: ImportedMember[] = []
  for (const [index, part] of raw.split(';').entries()) {
    const [rawName, rawRelationship = '', rawShare = ''] = part.split('|').map((value) => value.trim())
    const name = rawName ?? ''
    const relationship = rawRelationship ?? ''
    if (!name) {
      addIssue(issues, row, 'covered_members', `Member ${index + 1} needs a name.`)
      continue
    }
    const share = rawShare ? parseAmount(rawShare) : undefined
    if (rawShare && (share === undefined || share > 100)) {
      addIssue(issues, row, 'covered_members', `Member ${index + 1} share must be a number from 0 to 100.`)
      continue
    }
    members.push({ name, relationship, ...(share !== undefined ? { share } : {}) })
  }
  const shares = members.map(({ share }) => share)
  if (shares.some((share) => share !== undefined) && (shares.some((share) => share === undefined) || Math.abs(shares.reduce<number>((sum, share) => sum + (share ?? 0), 0) - 100) > 0.01)) {
    addIssue(issues, row, 'covered_members', 'If benefit shares are provided, every member must have a share and the total must equal 100.')
  }
  return members
}

function headersOf(row: ExcelJS.Row): string[] {
  return Array.from({ length: row.cellCount }, (_, index) =>
    cellText(row.getCell(index + 1).value as ExcelJS.CellValue).toLowerCase().replace(/[\s-]+/g, '_'),
  )
}

export async function parsePolicyWorkbook(buffer: Buffer, layout: PolicyImportLayout): Promise<WorkbookPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Uint8Array.from(buffer).buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return { policies: [], rowsRead: 0, issues: [{ row: 1, field: 'workbook', message: 'The workbook has no worksheet.' }] }
  if (sheet.rowCount > MAX_ROWS + 1) {
    return { policies: [], rowsRead: sheet.rowCount - 1, issues: [{ row: 1, field: 'workbook', message: `A workbook may contain no more than ${MAX_ROWS.toLocaleString()} data rows.` }] }
  }

  const headers = headersOf(sheet.getRow(1))
  const required = [...COMMON_HEADERS, ...(layout === 'policy-per-row' ? WIDE_HEADERS : MEMBER_HEADERS)]
  const indexByName = new Map(headers.map((name, index) => [name, index + 1]))
  const missing = required.filter((name) => !indexByName.has(name))
  if (missing.length) {
    return {
      policies: [],
      rowsRead: Math.max(0, sheet.rowCount - 1),
      issues: [{ row: 1, field: 'headers', message: `Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.` }],
    }
  }

  const issues: WorkbookIssue[] = []
  const grouped = new Map<string, ImportedPolicy>()
  const sourceRows = new Map<string, number>()

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values = headers.map((_, index) => row.getCell(index + 1).value as ExcelJS.CellValue)
    if (values.every((value) => cellText(value) === '')) continue
    const get = (name: string) => {
      const index = indexByName.get(name)
      return index ? cellText(row.getCell(index).value as ExcelJS.CellValue) : ''
    }
    const policyNumber = get('policy_number').toUpperCase()
    const holderName = get('holder_name')
    const phoneNumber = get('phone_number')
    const status = get('status').toUpperCase()
    const planName = get('plan_name')
    const coverAmount = parseAmount(get('cover_amount'))
    const monthlyPremium = parseAmount(get('monthly_premium'))
    const startDate = rowDate(row.getCell(indexByName.get('start_date')!).value as ExcelJS.CellValue)
    const monthsPaid = parseInteger(get('months_paid'))
    const waitingPeriodMonths = parseInteger(get('waiting_period_months'))

    if (!/^[A-Z0-9][A-Z0-9/-]{1,39}$/.test(policyNumber)) addIssue(issues, rowNumber, 'policy_number', 'Enter a policy number using letters, numbers, hyphens or slashes (2–40 characters).')
    if (!holderName) addIssue(issues, rowNumber, 'holder_name', 'Holder name is required.')
    if (!/^\+?[0-9][0-9\s()-]{6,23}$/.test(phoneNumber)) addIssue(issues, rowNumber, 'phone_number', 'Enter the phone number as text, including country code where available.')
    if (!['ACTIVE', 'GRACE', 'LAPSED'].includes(status)) addIssue(issues, rowNumber, 'status', 'Status must be ACTIVE, GRACE or LAPSED.')
    if (!planName) addIssue(issues, rowNumber, 'plan_name', 'Plan name is required.')
    if (coverAmount === undefined) addIssue(issues, rowNumber, 'cover_amount', 'Cover amount must be a non-negative number.')
    if (monthlyPremium === undefined) addIssue(issues, rowNumber, 'monthly_premium', 'Monthly premium must be a non-negative number.')
    if (!startDate) addIssue(issues, rowNumber, 'start_date', 'Enter a valid date as YYYY-MM-DD or DD/MM/YYYY.')
    if (monthsPaid === undefined) addIssue(issues, rowNumber, 'months_paid', 'Months paid must be a non-negative whole number.')
    if (waitingPeriodMonths === undefined) addIssue(issues, rowNumber, 'waiting_period_months', 'Waiting period must be a non-negative whole number.')
    const member: ImportedMember | null = layout === 'policy-per-row'
      ? null
      : (() => {
          const name = get('member_name')
          const relationship = get('member_relationship')
          const rawShare = get('member_share')
          const share = rawShare ? parseAmount(rawShare) : undefined
          if (!name) addIssue(issues, rowNumber, 'member_name', 'Covered member name is required.')
          if (rawShare && (share === undefined || share > 100)) addIssue(issues, rowNumber, 'member_share', 'Member share must be a number from 0 to 100.')
          return name && (!rawShare || share !== undefined && share <= 100) ? { name, relationship, ...(share !== undefined ? { share } : {}) } : null
        })()
    const members = layout === 'policy-per-row' ? parseMemberCell(get('covered_members'), rowNumber, issues) : member ? [member] : []
    if (!policyNumber || !holderName || !phoneNumber || !planName || !status || coverAmount === undefined || monthlyPremium === undefined || !startDate || monthsPaid === undefined || waitingPeriodMonths === undefined) continue

    const candidate: ImportedPolicy = {
      policyNumber, holderName, phoneNumber, status: status as ImportedPolicy['status'], planName,
      coverAmount, monthlyPremium, startDate, monthsPaid, waitingPeriodMonths, members,
    }
    const existing = grouped.get(policyNumber)
    if (existing) {
      if (layout !== 'member-per-row') {
        addIssue(issues, rowNumber, 'policy_number', `Policy ${policyNumber} appears more than once in the one-row-per-policy layout.`)
        continue
      }
      const { members: _previousMembers, ...previousBase } = existing
      const { members: _currentMembers, ...currentBase } = candidate
      if (JSON.stringify(previousBase) !== JSON.stringify(currentBase)) {
        addIssue(issues, rowNumber, 'policy_number', `Policy ${policyNumber} has conflicting policy details across member rows (first seen on row ${sourceRows.get(policyNumber)}).`)
        continue
      }
      if (members.length && existing.members.some((item) => item.name.toLowerCase() === members[0]!.name.toLowerCase())) {
        addIssue(issues, rowNumber, 'member_name', `Member ${members[0]!.name} is repeated for policy ${policyNumber}.`)
        continue
      }
      existing.members.push(...members)
      continue
    }
    grouped.set(policyNumber, candidate)
    sourceRows.set(policyNumber, rowNumber)
  }

  const policies = [...grouped.values()]
  if (policies.length > MAX_POLICIES) addIssue(issues, 1, 'workbook', `A workbook may contain no more than ${MAX_POLICIES.toLocaleString()} policies.`)
  for (const policy of policies) {
    const shares = policy.members.map(({ share }) => share)
    if (shares.some((share) => share !== undefined) && (shares.some((share) => share === undefined) || Math.abs(shares.reduce<number>((sum, share) => sum + (share ?? 0), 0) - 100) > 0.01)) {
      addIssue(issues, sourceRows.get(policy.policyNumber) ?? 0, 'member_share', `Shares for policy ${policy.policyNumber} must all be present and total 100.`)
    }
  }
  return { policies, rowsRead: Math.max(0, sheet.rowCount - 1), issues }
}
