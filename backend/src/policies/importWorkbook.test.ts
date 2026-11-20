import assert from 'node:assert/strict'
import test from 'node:test'
import ExcelJS from 'exceljs'
import { parsePolicyWorkbook, type PolicyImportLayout } from './importWorkbook'

async function workbookBytes(layout: PolicyImportLayout, rows: Record<string, string | number>[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Policies')
  const columns = layout === 'policy-per-row'
    ? ['policy_number', 'holder_name', 'phone_number', 'status', 'plan_name', 'cover_amount', 'monthly_premium', 'start_date', 'months_paid', 'waiting_period_months', 'covered_members']
    : ['policy_number', 'holder_name', 'phone_number', 'status', 'plan_name', 'cover_amount', 'monthly_premium', 'start_date', 'months_paid', 'waiting_period_months', 'member_name', 'member_relationship', 'member_share']
  sheet.addRow(columns)
  for (const row of rows) sheet.addRow(columns.map((column) => row[column] ?? ''))
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

const common = {
  policy_number: 'FLA-100001',
  holder_name: 'Sample Holder',
  phone_number: '+263771234567',
  status: 'ACTIVE',
  plan_name: 'Family plan',
  cover_amount: 7800,
  monthly_premium: 14,
  start_date: '2025-01-15',
  months_paid: 12,
  waiting_period_months: 6,
}

test('parses one row per policy with delimited covered members', async () => {
  const buffer = await workbookBytes('policy-per-row', [{
    ...common,
    covered_members: 'Member One|Spouse|60;Member Two|Child|40',
  }])
  const parsed = await parsePolicyWorkbook(buffer, 'policy-per-row')

  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.policies.length, 1)
  assert.deepEqual(parsed.policies[0]?.members, [
    { name: 'Member One', relationship: 'Spouse', share: 60 },
    { name: 'Member Two', relationship: 'Child', share: 40 },
  ])
})

test('groups repeated policy rows in member-per-row format', async () => {
  const buffer = await workbookBytes('member-per-row', [
    { ...common, member_name: 'Member One', member_relationship: 'Spouse', member_share: 60 },
    { ...common, member_name: 'Member Two', member_relationship: 'Child', member_share: 40 },
  ])
  const parsed = await parsePolicyWorkbook(buffer, 'member-per-row')

  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.policies.length, 1)
  assert.deepEqual(parsed.policies[0]?.members.map(({ name }) => name), ['Member One', 'Member Two'])
})

test('rejects duplicate policy rows in the wide layout and conflicting grouped records', async () => {
  const wide = await workbookBytes('policy-per-row', [
    { ...common, covered_members: 'Member One' },
    { ...common, covered_members: 'Member Two' },
  ])
  const wideResult = await parsePolicyWorkbook(wide, 'policy-per-row')
  assert.ok(wideResult.issues.some((issue) => issue.message.includes('appears more than once')))

  const grouped = await workbookBytes('member-per-row', [
    { ...common, member_name: 'Member One' },
    { ...common, holder_name: 'Different Holder', member_name: 'Member Two' },
  ])
  const groupedResult = await parsePolicyWorkbook(grouped, 'member-per-row')
  assert.ok(groupedResult.issues.some((issue) => issue.message.includes('conflicting policy details')))
})

test('reports missing template headers and invalid policy fields', async () => {
  const missingWorkbook = new ExcelJS.Workbook()
  missingWorkbook.addWorksheet('Policies').addRow(['policy_number'])
  const missing = Buffer.from(await missingWorkbook.xlsx.writeBuffer())
  assert.match((await parsePolicyWorkbook(missing, 'member-per-row')).issues[0]?.message ?? '', /Missing required columns/)

  const invalid = await workbookBytes('policy-per-row', [{
    ...common,
    policy_number: '!',
    status: 'UNKNOWN',
    cover_amount: -1,
    covered_members: 'Member One|Child|80',
  }])
  const parsed = await parsePolicyWorkbook(invalid, 'policy-per-row')
  assert.ok(parsed.issues.some((issue) => issue.field === 'policy_number'))
  assert.ok(parsed.issues.some((issue) => issue.field === 'status'))
  assert.ok(parsed.issues.some((issue) => issue.field === 'cover_amount'))
  assert.ok(parsed.issues.some((issue) => issue.field === 'covered_members' && issue.message.includes('total must equal 100')))
})
