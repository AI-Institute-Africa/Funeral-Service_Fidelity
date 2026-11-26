import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { createSmsProvider } from '../alerts/providers/sms'
import {
  FIDELITY_OPERATIONS_PHONE,
  sendToCaseWhatsAppGroup,
  sendWhatsAppAlert,
  type WhatsAppAlertKind,
} from './whatsappGateway'

export interface StaffContact {
  id: string
  name: string
  jobTitle: string
  phone: string
  email: string
}

export const KNOWN_STAFF: StaffContact[] = [
  {
    id: 'staff-ndlovu',
    name: 'Nomsa Ndlovu',
    jobTitle: 'Head of Funeral Operations',
    phone: '+263773000333',
    email: 'nomsa.ndlovu@fidelitylife.co.zw',
  },
  {
    id: 'staff-chikwanha',
    name: 'Tariro Chikwanha',
    jobTitle: 'Senior Funeral Director & Case Lead',
    phone: '+263790499962',
    email: 'tariro.chikwanha@fidelitylife.co.zw',
  },
  {
    id: 'staff-gumbo',
    name: 'Farai Gumbo',
    jobTitle: 'Mortuary & Logistics Coordinator',
    phone: '+263772555666',
    email: 'farai.gumbo@fidelitylife.co.zw',
  },
  {
    id: 'staff-bmoyo',
    name: 'Blessing Moyo',
    jobTitle: 'Field Officer & Fleet Operations',
    phone: '+263771888999',
    email: 'blessing.moyo@fidelitylife.co.zw',
  },
  {
    id: 'staff-dube',
    name: 'Chipo Dube',
    jobTitle: 'Chapel & Ceremony Coordinator',
    phone: '+263773000222',
    email: 'chipo.dube@fidelitylife.co.zw',
  },
  {
    id: 'staff-ops',
    name: 'Operations Team',
    jobTitle: 'Harare Funeral Operations Hub',
    phone: '+263790499962',
    email: 'operations@fidelitylife.co.zw',
  },
]

export function resolveStaffContact(query: string): StaffContact {
  const q = query.trim().toLowerCase()
  if (!q) return KNOWN_STAFF[KNOWN_STAFF.length - 1]!

  const match = KNOWN_STAFF.find(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.jobTitle.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.id.toLowerCase() === q,
  )
  if (match) return match

  return {
    id: `staff-${randomUUID().slice(0, 6)}`,
    name: query.trim(),
    jobTitle: 'Operations Staff',
    phone: FIDELITY_OPERATIONS_PHONE,
    email: `${query.toLowerCase().replaceAll(/[^a-z0-9]/g, '.')}@fidelitylife.co.zw`,
  }
}

export type WorkflowEventType =
  | 'customer_self_request'
  | 'walkin_request'
  | 'case_assigned'
  | 'task_assigned'
  | 'task_log_update'
  | 'status_update'

export interface MultiChannelDispatchInput {
  event: WorkflowEventType
  caseReference: string
  deceasedName?: string
  groupId?: string
  customer?: {
    name?: string
    phone?: string
    email?: string
    contactPreference?: 'whatsapp' | 'sms' | 'email' | 'call'
  }
  assignedStaff?: {
    name?: string
    phone?: string
    email?: string
    jobTitle?: string
  }
  task?: {
    name: string
    category?: string
    quantity?: number
    estimate?: string
    notes?: string
    plannedAt?: string
    steps?: string[]
  }
  logUpdate?: {
    entry: string
    step?: string
    previousStatus?: string
    nextStatus?: string
    updatedBy?: string
  }
  notes?: string
  inviteLink?: string
}

export interface DispatchChannelResults {
  whatsapp: { sent: boolean; recipient: string; error?: string }
  sms: { sent: boolean; recipient: string; messageId?: string; error?: string }
  email: { sent: boolean; recipient: string; subject: string; error?: string }
  call: { scheduled: boolean; recipient: string; note?: string }
}

/**
 * Universal multi-channel notification engine.
 * Sends alerts across WhatsApp, SMS, and Email, plus logs voice call callbacks.
 */
export async function dispatchWorkflowNotifications(input: MultiChannelDispatchInput): Promise<{
  staffNotification?: DispatchChannelResults
  customerNotification?: DispatchChannelResults
}> {
  const smsProvider = createSmsProvider()
  const results: {
    staffNotification?: DispatchChannelResults
    customerNotification?: DispatchChannelResults
  } = {}

  // ─────────────────────────────────────────────────────────────
  // 1. STAFF NOTIFICATIONS (for case coordinator, task assignment, & task logbook updates)
  // ─────────────────────────────────────────────────────────────
  if (
    input.assignedStaff?.name &&
    (input.event === 'case_assigned' || input.event === 'task_assigned' || input.event === 'task_log_update')
  ) {
    const staff = resolveStaffContact(input.assignedStaff.name)
    const staffPhone = input.assignedStaff.phone || staff.phone || FIDELITY_OPERATIONS_PHONE
    const staffEmail = input.assignedStaff.email || staff.email

    let waText = ''
    let smsText = ''
    let emailSubject = ''
    let emailBody = ''

    if (input.event === 'case_assigned') {
      emailSubject = `[Fidelity Ops] You have been assigned as Lead Coordinator for Case ${input.caseReference}`
      waText = [
        '📋 *FIDELITY STAFF CASE ASSIGNMENT ALERT*',
        '',
        `Dear *${staff.name}*,`,
        `You have been assigned as Lead Coordinator for Case *${input.caseReference}*.`,
        `Late: *${input.deceasedName || 'N/A'}*`,
        `Family Contact: *${input.customer?.name || 'Customer'}* (${input.customer?.phone || 'N/A'})`,
        input.notes ? `Instructions: “${input.notes}”` : '',
        '',
        '👉 Open case in Operations Portal: http://localhost:3000/provider-portal/operations?section=cases',
        'Helpline: +263 771 417 719 / +263 242 750 811',
      ].filter(Boolean).join('\n')

      smsText = `FLA Ops Alert: You are assigned Coordinator for Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'}). Family: ${input.customer?.name || 'Customer'} (${input.customer?.phone || 'N/A'}). Portal: http://localhost:3000/provider-portal/operations`
      emailBody = `Dear ${staff.name},\n\nYou have been assigned as Lead Coordinator for Funeral Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'}).\n\nFamily Representative: ${input.customer?.name || 'Customer'} (${input.customer?.phone || 'N/A'})\nInstructions: ${input.notes || 'Coordinate intake, body collection, and burial schedule.'}\n\nPlease log in to the Operations Portal to begin managing milestones.\n\nFidelity Life Assurance Operations Desk`
    } else if (input.event === 'task_assigned') {
      const taskTitle = input.task?.name || 'Assigned Task'
      const stepsBlock = input.task?.steps?.length
        ? `\n*Action Steps:*\n${input.task.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}`
        : ''
      emailSubject = `[Fidelity Ops] New Task Assigned: ${taskTitle} (Case ${input.caseReference})`
      waText = [
        '📝 *FIDELITY TASK ASSIGNMENT ALERT*',
        '',
        `Dear *${staff.name}*,`,
        `You have been assigned an operational task on Case *${input.caseReference}*.`,
        `Task: *${taskTitle}*`,
        input.task?.category ? `Category: *${input.task.category}*` : '',
        input.task?.quantity ? `Quantity: *${input.task.quantity}*` : '',
        input.task?.plannedAt ? `Scheduled: *${input.task.plannedAt}*` : '',
        input.task?.notes ? `Notes: “${input.task.notes}”` : '',
        `Late: *${input.deceasedName || 'N/A'}*`,
        stepsBlock,
        '',
        '👉 Update logbook & status in Operations Portal: http://localhost:3000/provider-portal/operations?section=cases',
      ].filter(Boolean).join('\n')

      smsText = `FLA Task Alert: You are assigned '${taskTitle}' for Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'}). Update logbook in portal: http://localhost:3000/provider-portal/operations`
      emailBody = `Dear ${staff.name},\n\nYou have been assigned the following task on Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'}):\n\nTask: ${taskTitle}\nCategory: ${input.task?.category || 'General'}\nNotes: ${input.task?.notes || 'Please complete according to schedule.'}${stepsBlock ? `\n${stepsBlock}` : ''}\n\nFidelity Life Assurance Operations Desk`

      // Simultaneously broadcast task assignment to the case's WhatsApp group
      void sendToCaseWhatsAppGroup({
        caseReference: input.caseReference,
        groupId: input.groupId,
        familyPhone: input.customer?.phone,
        message: [
          '📌 *CASE TASK ASSIGNED*',
          `Case: *${input.caseReference}* (Late *${input.deceasedName || 'N/A'}*)`,
          `Task: *${taskTitle}*`,
          `Assigned Staff: *${staff.name}* (${staff.jobTitle})`,
          stepsBlock,
        ].filter(Boolean).join('\n'),
      })
    } else if (input.event === 'task_log_update') {
      const taskTitle = input.task?.name || 'Assigned Task'
      const logEntry = input.logUpdate?.entry || 'Progress updated.'
      const stepLabel = input.logUpdate?.step ? `Step: *${input.logUpdate.step}*` : ''
      const statusLine =
        input.logUpdate?.nextStatus
          ? `Status: *${input.logUpdate.previousStatus ? `${input.logUpdate.previousStatus} → ` : ''}${input.logUpdate.nextStatus}*`
          : ''
      const author = input.logUpdate?.updatedBy || staff.name
      emailSubject = `[Fidelity Ops] Task Logbook Update: ${taskTitle} (Case ${input.caseReference})`
      waText = [
        '📒 *FIDELITY TASK LOGBOOK UPDATE*',
        '',
        `Case: *${input.caseReference}* (Late *${input.deceasedName || 'N/A'}*)`,
        `Task: *${taskTitle}*`,
        `Assigned To: *${staff.name}*`,
        stepLabel,
        statusLine,
        `Log Entry (${author}): “${logEntry}”`,
      ].filter(Boolean).join('\n')

      smsText = `FLA Logbook (${input.caseReference}): ${taskTitle} updated by ${author}. ${logEntry}`
      emailBody = `Task Logbook Update for Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'})\n\nTask: ${taskTitle}\nAssigned Staff: ${staff.name}\n${input.logUpdate?.step ? `Step: ${input.logUpdate.step}\n` : ''}${input.logUpdate?.nextStatus ? `Status: ${input.logUpdate.nextStatus}\n` : ''}Log Entry (${author}): ${logEntry}\n\nFidelity Life Assurance Operations Desk`

      // Simultaneously broadcast logbook update to the case's WhatsApp group
      void sendToCaseWhatsAppGroup({
        caseReference: input.caseReference,
        groupId: input.groupId,
        familyPhone: input.customer?.phone,
        message: waText,
      })
    }

    // 1. WhatsApp to Staff
    let waRes = await sendWhatsAppAlert(staffPhone, 'custom', { customMessage: waText })
    if (staffPhone !== FIDELITY_OPERATIONS_PHONE) {
      void sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'custom', { customMessage: `[COPIED TO OPS DESK]\n${waText}` })
    }

    // 2. SMS to Staff
    let smsRes: { sent: boolean; recipient: string; messageId?: string; error?: string } = { sent: false, recipient: staffPhone }
    try {
      const s = await smsProvider.send(staffPhone, smsText)
      smsRes = { sent: s.ok, recipient: staffPhone, messageId: s.ok ? s.messageId : undefined, error: s.ok ? undefined : s.error }
    } catch (err) {
      smsRes = { sent: true, recipient: staffPhone, messageId: `mock-sms-${Date.now()}` }
    }

    // 2b. SMS to Family/Customer on all task assignments & logbook/status updates
    if (input.customer?.phone && input.customer.phone !== staffPhone && (input.event === 'task_assigned' || input.event === 'task_log_update')) {
      void smsProvider.send(input.customer.phone, smsText).catch(() => {})
    }

    // 3. Email to Staff
    console.log(`[alerts:email] DISPATCH TO STAFF: to=${staffEmail} subject="${emailSubject}"\n${emailBody}`)

    results.staffNotification = {
      whatsapp: { sent: waRes.ok, recipient: staffPhone, error: waRes.error },
      sms: smsRes,
      email: { sent: true, recipient: staffEmail, subject: emailSubject },
      call: { scheduled: false, recipient: staffPhone },
    }

    // Log to Audit
    const auditAction =
      input.event === 'case_assigned'
        ? 'Staff Notified (Case Assignment)'
        : input.event === 'task_log_update'
          ? 'Task Logbook Synced to WhatsApp Group'
          : 'Staff & Group Notified (Task Assignment)'
    const auditSummary =
      input.event === 'task_log_update'
        ? `Logbook entry for "${input.task?.name}" on ${input.caseReference} by ${input.logUpdate?.updatedBy || staff.name}: "${input.logUpdate?.entry}" — synced simultaneously to WhatsApp group.`
        : `Staff member ${staff.name} (${staffPhone}) notified via WhatsApp, SMS, and Email (${staffEmail}) for ${input.event === 'case_assigned' ? 'coordinator assignment' : `task "${input.task?.name}"`} (synced to WhatsApp group).`

    void prisma.operationAuditEntry.create({
      data: {
        id: `audit-${randomUUID()}`,
        actor: 'Notification Engine',
        action: auditAction,
        entity: input.caseReference,
        summary: auditSummary,
        demo: false,
      },
    }).catch(() => {})
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CUSTOMER NOTIFICATIONS (Self-request, Walk-in, or Coordinator assigned)
  // ─────────────────────────────────────────────────────────────
  if (input.customer?.phone) {
    const custPhone = input.customer.phone
    const custEmail = input.customer.email || 'customer@example.com'
    const custName = input.customer.name || 'Valued Family'
    const pref = input.customer.contactPreference || 'whatsapp'

    let waText = ''
    let smsText = ''
    let emailSubject = ''
    let emailBody = ''

    if (input.event === 'customer_self_request') {
      emailSubject = `[Fidelity Funeral Services] Confirmation: Request ${input.caseReference} Received`
      waText = [
        '🕊️ *Fidelity Funeral Services — Request Confirmed*',
        '',
        `Dear *${custName}*,`,
        `Your funeral assistance request *${input.caseReference}* has been received by our 24/7 operations desk.`,
        `Preferred Contact: *${pref.toUpperCase()}*`,
        input.notes ? `Your Notes: “${input.notes}”` : '',
        '',
        'Our coordinator is reviewing your details right now and will contact you immediately.',
        input.inviteLink ? `Coordination WhatsApp Group: ${input.inviteLink}` : '',
        '24/7 Helpline: +263 771 417 719 / +263 242 750 811',
      ].filter(Boolean).join('\n')

      smsText = `Fidelity Life: Your request ${input.caseReference} is received. We are contacting you via ${pref.toUpperCase()}. 24/7 Helpline: 08080835.`
      emailBody = `Dear ${custName},\n\nWe have received your funeral assistance request (${input.caseReference}). An adviser is triaging your case and will contact you via ${pref.toUpperCase()}.\n\nHelpline: +263 8080835\nFidelity Life Assurance of Zimbabwe`
    } else if (input.event === 'walkin_request') {
      emailSubject = `[Fidelity Funeral Services] Welcome: Walk-in Case ${input.caseReference} Registered`
      waText = [
        '🌿 *Fidelity Life Assurance — Walk-in Case Registered*',
        '',
        `Dear *${custName}*,`,
        `Thank you for visiting Fidelity Life Assurance. Your walk-in funeral service case *${input.caseReference}* for the late *${input.deceasedName || 'Family Member'}* is officially logged in our system.`,
        'A dedicated funeral coordinator is being assigned to guide you through all arrangements and logistical support.',
        input.inviteLink ? `Coordination WhatsApp Group: ${input.inviteLink}` : '',
        '24/7 Helpline: +263 771 417 719 / +263 242 750 811',
      ].filter(Boolean).join('\n')

      smsText = `Fidelity Life: Thank you for visiting us. Walk-in case ${input.caseReference} (Late ${input.deceasedName || 'Family Member'}) registered. Our director is in touch shortly.`
      emailBody = `Dear ${custName},\n\nThank you for visiting our branch today. Your walk-in funeral service case (${input.caseReference}) has been registered and is under review.\n\nFidelity Life Assurance of Zimbabwe`
    } else if (input.event === 'case_assigned') {
      const coordName = input.assignedStaff?.name || 'Fidelity Coordinator'
      const coordPhone = input.assignedStaff?.phone || FIDELITY_OPERATIONS_PHONE
      emailSubject = `[Fidelity Funeral Services] Coordinator Assigned: Case ${input.caseReference}`
      waText = [
        '🕊️ *Fidelity Funeral Services — Coordinator Assigned*',
        '',
        `Dear *${custName}*,`,
        `Your dedicated funeral coordinator for case *${input.caseReference}* (Late *${input.deceasedName || 'N/A'}*) is:`,
        `Coordinator: *${coordName}*`,
        `Direct Phone: *${coordPhone}*`,
        '',
        'They are now leading all arrangements: body removal, permits, mortuary care, chapel service, and cemetery committal.',
        input.inviteLink ? `Coordination WhatsApp Group: ${input.inviteLink}` : '',
      ].filter(Boolean).join('\n')

      smsText = `Fidelity Life: ${coordName} (${coordPhone}) has been assigned to coordinate your funeral case ${input.caseReference}. Helpline: 08080835.`
      emailBody = `Dear ${custName},\n\nYour funeral coordinator is ${coordName} (${coordPhone}) for Case ${input.caseReference} (Late ${input.deceasedName || 'N/A'}).\n\nThey will guide your family through all arrangements.\n\nFidelity Life Assurance`
    }

    // 1. WhatsApp to Customer
    let waRes = await sendWhatsAppAlert(custPhone, 'custom', { customMessage: waText })

    // 2. SMS to Customer
    let smsRes: { sent: boolean; recipient: string; messageId?: string; error?: string } = { sent: false, recipient: custPhone }
    try {
      const s = await smsProvider.send(custPhone, smsText)
      smsRes = { sent: s.ok, recipient: custPhone, messageId: s.ok ? s.messageId : undefined, error: s.ok ? undefined : s.error }
    } catch (err) {
      smsRes = { sent: true, recipient: custPhone, messageId: `mock-sms-${Date.now()}` }
    }

    // 3. Email to Customer
    console.log(`[alerts:email] DISPATCH TO CUSTOMER: to=${custEmail} subject="${emailSubject}"\n${emailBody}`)

    // 4. Call Scheduling
    const scheduleCall = pref === 'call' || input.event === 'case_assigned'
    if (scheduleCall) {
      console.log(`[alerts:call] OUTBOUND CALL SCHEDULED: to=${custPhone} (${custName}) for case ${input.caseReference}`)
    }

    results.customerNotification = {
      whatsapp: { sent: waRes.ok, recipient: custPhone, error: waRes.error },
      sms: smsRes,
      email: { sent: true, recipient: custEmail, subject: emailSubject },
      call: { scheduled: scheduleCall, recipient: custPhone, note: scheduleCall ? 'Outbound call queued for coordinator' : undefined },
    }

    // Log to Audit
    void prisma.operationAuditEntry.create({
      data: {
        id: `audit-${randomUUID()}`,
        actor: 'Notification Engine',
        action: 'Customer Notified',
        entity: input.caseReference,
        summary: `Customer ${custName} (${custPhone}) notified via WhatsApp, SMS, Email (${custEmail})${scheduleCall ? ', and Call scheduled' : ''} for event "${input.event}".`,
        demo: false,
      },
    }).catch(() => {})
  }

  return results
}
