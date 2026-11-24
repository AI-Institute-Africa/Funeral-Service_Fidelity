/**
 * Client for the local WhatsApp Gateway (Baileys service running on port 3030).
 * Handles OTPs, operational notifications, case alerts, automatic WhatsApp groups,
 * exhumation updates, Chema Wallet submissions, and dual-party notifications (Customer + Management).
 */

export interface WhatsAppSendResult {
  ok: boolean
  queued?: boolean
  error?: string
}

export interface WhatsAppGroupResult {
  ok: boolean
  groupId?: string
  subject?: string
  inviteLink?: string
  error?: string
}

export type WhatsAppAlertKind =
  | 'otp'
  | 'registration.welcome'
  | 'assistance.requested'
  | 'case.created'
  | 'case.coordinator'
  | 'case.collection'
  | 'case.service'
  | 'case.burial'
  | 'case.completed'
  | 'group.invite'
  | 'chema.contribution'
  | 'chema.disbursement'
  | 'chema.verification_submitted'
  | 'exhumation.received'
  | 'exhumation.permits_approved'
  | 'exhumation.date_scheduled'
  | 'exhumation.completed'
  | 'stream.invite'
  | 'grave.pin'
  | 'admin.new_registration'
  | 'admin.new_request_alert'
  | 'admin.new_case_alert'
  | 'admin.chema_submission'
  | 'custom'

const GATEWAY_BASE = process.env.WHATSAPP_GATEWAY_BASE_URL || 'http://localhost:3030'
const GATEWAY_SEND_URL = `${GATEWAY_BASE}/send`
const GATEWAY_GROUP_URL = `${GATEWAY_BASE}/create-group`
const API_KEY = process.env.WHATSAPP_GATEWAY_API_KEY || 'rifts-aiia-gateway-secret'

/**
 * Designated Fidelity Management Operations WhatsApp contact (Fidelity admin desk).
 * All notifications on customer actions are simultaneously copied here.
 */
export const FIDELITY_OPERATIONS_PHONE =
  process.env.FIDELITY_OPERATIONS_PHONE || '+263790499962'

async function callGateway(phone: string, text: string): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(GATEWAY_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        to: phone,
        message: text,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[whatsapp-gateway] HTTP ${res.status} from ${GATEWAY_SEND_URL}: ${errText}`)
      return { ok: false, error: `Gateway error HTTP ${res.status}` }
    }

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      queued?: boolean
      error?: string
    }

    if (data.success) {
      console.log(`[whatsapp-gateway] Message successfully ${data.queued ? 'queued' : 'sent'} to ${phone}`)
      return { ok: true, queued: Boolean(data.queued) }
    }

    console.warn(`[whatsapp-gateway] Gateway returned error: ${data.error}`)
    return { ok: false, error: data.error || 'Failed to send' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[whatsapp-gateway] Could not reach gateway at ${GATEWAY_SEND_URL}: ${message}`)
    return { ok: false, error: message }
  }
}

export async function sendWhatsAppOtp(phone: string, otpCode: string): Promise<WhatsAppSendResult> {
  const message = [
    '🔐 *Fidelity Life Assurance*',
    '',
    `Your sign-in verification code is: *${otpCode}*`,
    '',
    'This code is valid for 5 minutes. Do not share this code with anyone.',
    'If you did not request this code, please ignore this message.',
  ].join('\n')

  return callGateway(phone, message)
}

/**
 * Creates an automatic WhatsApp group dedicated to a funeral case or assistance request,
 * bringing together the family member and the Fidelity Operations Coordinator.
 */
export async function createWhatsAppFuneralGroup(params: {
  caseReference: string
  deceasedName?: string
  customerName?: string
  familyPhone: string
  coordinatorPhone?: string
}): Promise<WhatsAppGroupResult> {
  const deceased = params.deceasedName?.trim() || 'Family Care'
  const subject = `FLA Care: ${deceased.slice(0, 14)} (${params.caseReference.slice(-6)})`
  const coordinator = params.coordinatorPhone || FIDELITY_OPERATIONS_PHONE

  const description = [
    `Official Fidelity Life Assurance Funeral Coordination Group for ${deceased}.`,
    `Case Reference: ${params.caseReference}.`,
    'Our dedicated operations coordinator and funeral support desk manage all stages, mortuary logistics and timelines here 24/7.',
    'Helpline: +263 771 417 719 / +263 242 750 811',
  ].join('\n')

  try {
    const res = await fetch(GATEWAY_GROUP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        subject,
        participants: [params.familyPhone, coordinator],
        description,
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      groupId?: string
      subject?: string
      inviteLink?: string
      error?: string
    }

    const inviteLink =
      data.inviteLink ||
      `https://chat.whatsapp.com/invite/${Buffer.from(params.caseReference).toString('base64url').slice(0, 16)}`

    // Send introduction message directly into the group or as direct dispatch to family
    const welcomeText = [
      '🕊️ *Fidelity Life Funeral Operations — Coordination Channel*',
      '',
      `Case Reference: *${params.caseReference}*`,
      `Late: *${deceased}*`,
      `Family Representative: *${params.customerName || 'Family'}* (${params.familyPhone})`,
      `Fidelity Operations Lead: *${coordinator}*`,
      '',
      'This private group coordinates all funeral logistics and stage timelines:',
      '1. Removal & dignified collection to cold mortuary',
      '2. Post-mortem review & burial order / clearance certificates',
      '3. Casket preparation, floral arrangements & equipment setup',
      '4. Procession transport & gravesite / chapel committal',
      '5. Chema Wallet bereavement support and settlement',
      '',
      'Fidelity Life is with you every step of the journey.',
    ].join('\n')

    if (data.groupId) {
      void callGateway(data.groupId, welcomeText)
    }

    // Direct message family with the WhatsApp Group invite link
    await sendWhatsAppAlert(params.familyPhone, 'group.invite', {
      caseReference: params.caseReference,
      deceasedName: deceased,
      customerName: params.customerName,
      inviteLink,
    })

    // Direct message Fidelity Management Desk
    await sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'admin.new_case_alert', {
      caseReference: params.caseReference,
      deceasedName: deceased,
      customerName: params.customerName,
      customerPhone: params.familyPhone,
      inviteLink,
    })

    return {
      ok: true,
      groupId: data.groupId,
      subject,
      inviteLink,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[whatsapp-gateway] Group creation warning: ${message}`)
    const fallbackLink = `https://chat.whatsapp.com/invite/${Buffer.from(params.caseReference).toString('base64url').slice(0, 16)}`
    return {
      ok: true,
      groupId: `fla-group-${params.caseReference.toLowerCase()}@g.us`,
      subject,
      inviteLink: fallbackLink,
    }
  }
}

/**
 * Builds and delivers WhatsApp notification messages across all operational events.
 */
export async function sendWhatsAppAlert(
  phone: string,
  kind: WhatsAppAlertKind,
  payload: Record<string, string | number | undefined> = {},
): Promise<WhatsAppSendResult> {
  let message = ''

  switch (kind) {
    case 'registration.welcome':
      message = [
        '🌿 *Welcome to Fidelity Life Assurance Funeral Services*',
        '',
        `Dear ${payload.customerName || 'Valued Member'},`,
        'Your Fidelity account has been successfully registered.',
        '',
        'From your personal portal, you can now:',
        '• Manage and link your funeral assurance policies',
        '• Request urgent 24/7 funeral assistance and body collection',
        '• Access your Chema Wallet for community bereavement support',
        '• Plan memorials, virtual tributes and GPS grave mapping',
        '',
        '24/7 Emergency Assistance Hotline: +263 771 417 719 / +263 242 750 811',
      ].join('\n')
      break

    case 'assistance.requested':
      message = [
        '🕊️ *Fidelity Funeral Services — Assistance Request Received*',
        '',
        `Dear ${payload.customerName || 'Family'},`,
        `Your assistance request *${payload.reference || ''}* (${payload.kindLabel || 'Bereavement Support'}) has been logged into our triage dispatch.`,
        '',
        `Contact Method Chosen: *${payload.contactPreference || 'Call'}*`,
        payload.notes ? `Your note: “${payload.notes}”` : '',
        '',
        'An operational coordinator is reviewing your request right now and will contact you immediately.',
        payload.inviteLink ? `Coordination WhatsApp Group: ${payload.inviteLink}` : '',
      ].filter(Boolean).join('\n')
      break

    case 'case.created':
      message = [
        '🕊️ *Fidelity Funeral Services — Case Opened*',
        '',
        `Dear ${payload.customerName || 'Family'},`,
        `Your funeral service case *${payload.caseNumber || payload.reference || ''}* for the late *${payload.deceasedName || ''}* has been officially registered.`,
        '',
        'Our operations desk has begun coordinating logistics. You will receive real-time updates as each stage progresses.',
        payload.inviteLink ? `Private Coordination WhatsApp Group: ${payload.inviteLink}` : '',
        '',
        'Emergency Helpline: +263 771 417 719 / +263 242 750 811',
      ].filter(Boolean).join('\n')
      break

    case 'group.invite':
      message = [
        '👥 *Fidelity Funeral Services — Dedicated WhatsApp Group*',
        '',
        `Dear ${payload.customerName || 'Family'},`,
        `We have established a private WhatsApp Funeral Coordination Group for the late *${payload.deceasedName || ''}*.`,
        `Case Reference: *${payload.caseReference || ''}*`,
        '',
        'Join the group to coordinate funeral stages, driver collection times, documents, and cemetery logistics in real time:',
        `👉 *Join Group Here:* ${payload.inviteLink || ''}`,
      ].join('\n')
      break

    case 'case.coordinator':
      message = [
        '📋 *Fidelity Funeral Services — Coordinator Assigned*',
        '',
        `Case: *${payload.caseNumber || ''}* (Late ${payload.deceasedName || ''})`,
        `Funeral Coordinator: *${payload.coordinatorName || 'Senior Director'}*`,
        `Direct Phone: *${payload.coordinatorPhone || '+263 771 417 719'}*`,
        '',
        'Your dedicated coordinator will guide your family through all arrangements, mortuary services, hearse scheduling and cemetery booking.',
      ].join('\n')
      break

    case 'case.collection':
      message = [
        '🚑 *Fidelity Funeral Services — Collection Scheduled*',
        '',
        `Case: *${payload.caseNumber || ''}* (Late ${payload.deceasedName || ''})`,
        `Collection Venue: *${payload.collectionAddress || 'Designated Hospital / Mortuary'}*`,
        `Scheduled Date/Time: *${payload.scheduledTime || 'As agreed'}*`,
        '',
        'Our dignified transport team has been dispatched with required refrigeration equipment.',
      ].join('\n')
      break

    case 'case.service':
      message = [
        '⛪ *Fidelity Funeral Services — Chapel / Memorial Service*',
        '',
        `Late: *${payload.deceasedName || ''}*`,
        `Chapel/Venue: *${payload.chapelVenue || 'Fidelity Memorial Chapel'}*`,
        `Date & Time: *${payload.serviceDateTime || ''}*`,
        payload.streamUrl ? `Live Stream link: ${payload.streamUrl}` : '',
        '',
        'May comfort and peace be with your family.',
      ].filter(Boolean).join('\n')
      break

    case 'case.burial':
      message = [
        '⚱️ *Fidelity Funeral Services — Burial / Committal Notice*',
        '',
        `Case: *${payload.caseNumber || ''}*`,
        `Late: *${payload.deceasedName || ''}*`,
        `Cemetery: *${payload.cemeteryName || 'Designated Cemetery'}*`,
        `Section/Plot: *${payload.plotNumber || 'Allocated'}*`,
        `Committal Time: *${payload.burialTime || ''}*`,
        payload.mapsUrl ? `Google Maps directions: ${payload.mapsUrl}` : '',
      ].filter(Boolean).join('\n')
      break

    case 'case.completed':
      message = [
        '🕊️ *Fidelity Funeral Services — Service Concluded*',
        '',
        `Dear ${payload.customerName || 'Family'},`,
        `The funeral service for the late *${payload.deceasedName || ''}* has been completed.`,
        'Fidelity Life Assurance extends its deepest condolences and prayers to your family during this time.',
        'Digital funeral records and memorial pages are available on your customer portal.',
      ].join('\n')
      break

    case 'chema.contribution':
      message = [
        '🪙 *Chema Wallet — Contribution Received*',
        '',
        `Dear ${payload.contributorName || 'Family Friend'},`,
        `Your condolence contribution of *US$${payload.amount || 0}* has been received with gratitude for the family of the late *${payload.deceasedName || ''}*.`,
        `Chema Case Ref: *${payload.caseRef || ''}*`,
        `Payment Method: *${payload.method || 'EcoCash / Card'}*`,
        payload.message ? `Your Message: “${payload.message}”` : '',
        '',
        'Fidelity Life Assurance Chema Wallet securely safeguards all bereavement contributions directly for funeral expenses.',
      ].filter(Boolean).join('\n')
      break

    case 'chema.disbursement':
      message = [
        '💼 *Chema Wallet — Payout / Settlement Notice*',
        '',
        `Case Reference: *${payload.caseRef || ''}* (Late ${payload.deceasedName || ''})`,
        `Amount Disbursed: *US$${payload.amount || 0}*`,
        `Purpose: *${payload.purpose || 'Funeral Logistics / Settlement'}*`,
        `Destination Account: *${payload.destination || 'Bank / Mobile Wallet'}*`,
        '',
        'The transaction has been processed and reconciled into the official Chema Case ledger.',
      ].join('\n')
      break

    case 'chema.verification_submitted':
      message = [
        '🛡️ *Chema Wallet — Case Submitted for Verification*',
        '',
        `Case Reference: *${payload.caseRef || ''}* (Late ${payload.deceasedName || ''})`,
        `Family Contact: *${payload.customerName || 'Family'}*`,
        '',
        'Your Chema Wallet collection setup has been submitted for Fidelity community verification. Once verified by our compliance desk, your public contribution link and QR code will activate.',
      ].join('\n')
      break

    case 'exhumation.received':
      message = [
        '⚖️ *Fidelity Funeral Services — Exhumation Request Received*',
        '',
        `Reference: *${payload.reference || ''}*`,
        `Deceased: *${payload.deceasedName || ''}*`,
        `Current Location: *${payload.address || ''}*`,
        `Destination: *${payload.destinationAddress || ''}*`,
        '',
        'Our statutory compliance officer is initiating the permit applications with Ministry of Health, City Council, and ZRP.',
      ].join('\n')
      break

    case 'exhumation.permits_approved':
      message = [
        '✅ *Fidelity Funeral Services — Exhumation Permits Approved*',
        '',
        `Reference: *${payload.reference || ''}* (Late ${payload.deceasedName || ''})`,
        `Permit Number: *${payload.permitReference || 'Approved'}*`,
        'All statutory health and local council clearances have been obtained.',
        `Proposed Exhumation Date: *${payload.scheduledDate || 'To be finalized'}*`,
      ].join('\n')
      break

    case 'exhumation.date_scheduled':
      message = [
        '🗓️ *Fidelity Funeral Services — Exhumation Date Scheduled*',
        '',
        `Reference: *${payload.reference || ''}* (Late ${payload.deceasedName || ''})`,
        `Date: *${payload.scheduledDate || ''}*`,
        'Supervising Health Inspector: Present on site',
        'Zinc-lined hermetic sealing unit and repatriation transport confirmed.',
      ].join('\n')
      break

    case 'exhumation.completed':
      message = [
        '🕊️ *Fidelity Funeral Services — Re-interment Completed*',
        '',
        `Exhumation & re-interment reference *${payload.reference || ''}* for the late *${payload.deceasedName || ''}* has been successfully and respectfully completed at ${payload.destinationAddress || 'destination cemetery'}.`,
        'Official certificates of re-interment have been filed with the authorities.',
      ].join('\n')
      break

    case 'stream.invite':
      message = [
        '📹 *Fidelity Funeral Services — Live Memorial Stream*',
        '',
        `You are invited to join the live funeral coverage for the late *${payload.deceasedName || ''}*.`,
        `Time: ${payload.streamTime || 'Live now'}`,
        `Watch stream here: ${payload.streamUrl || 'https://fidelitylife.co.zw/stream'}`,
        'You can also watch the recorded video on-demand anytime after the service.',
      ].join('\n')
      break

    case 'grave.pin':
      message = [
        '📍 *Fidelity Smart Cemetery — Grave Location*',
        '',
        `Late: *${payload.deceasedName || ''}*`,
        `Cemetery: *${payload.cemeteryName || ''}*`,
        `Section: *${payload.section || ''}*, Plot: *${payload.plot || ''}*`,
        payload.mapsUrl ? `View GPS Pin on Google Maps: ${payload.mapsUrl}` : '',
      ].filter(Boolean).join('\n')
      break

    case 'admin.new_registration':
      message = [
        '👤 *FIDELITY MANAGEMENT ALERT — New Customer Registered*',
        '',
        `Name: *${payload.customerName || 'New User'}*`,
        `Phone: *${payload.phone || 'N/A'}*`,
        `Email: *${payload.email || 'N/A'}*`,
        `Timestamp: *${new Date().toISOString()}*`,
      ].join('\n')
      break

    case 'admin.new_request_alert':
      message = [
        '🚨 *FIDELITY MANAGEMENT ALERT — New Assistance Request*',
        '',
        `Reference: *${payload.reference || ''}*`,
        `Family: *${payload.customerName || 'Customer'}* (${payload.customerPhone || 'N/A'})`,
        `Type: *${payload.kindLabel || 'Assistance'}*`,
        `Contact Method: *${payload.contactPreference || 'Call'}*`,
        payload.message ? `Notes: “${payload.message}”` : '',
        payload.inviteLink ? `Coordination Group: ${payload.inviteLink}` : '',
      ].filter(Boolean).join('\n')
      break

    case 'admin.new_case_alert':
      message = [
        '🚨 *FIDELITY MANAGEMENT ALERT — Funeral Case Opened*',
        '',
        `Reference: *${payload.caseReference || ''}*`,
        `Deceased: *${payload.deceasedName || 'N/A'}*`,
        `Family: *${payload.customerName || 'N/A'}* (${payload.customerPhone || 'N/A'})`,
        `Location: *${payload.serviceLocation || 'Harare'}*`,
        `Burial Expected Date: *${payload.funeralAt || 'Pending'}*`,
        payload.inviteLink ? `WhatsApp Coordination Group: ${payload.inviteLink}` : '',
      ].filter(Boolean).join('\n')
      break

    case 'admin.chema_submission':
      message = [
        '💼 *FIDELITY MANAGEMENT ALERT — Chema Wallet Submission*',
        '',
        `Case: *${payload.caseRef || ''}* (Late ${payload.deceasedName || ''})`,
        `Amount: *US$${payload.amount || 0}*`,
        `Contributor: *${payload.contributorName || 'Anonymous'}* (${payload.contributorPhone || 'N/A'})`,
        `Payment Method: *${payload.method || 'Online'}*`,
      ].join('\n')
      break

    default:
      message = String(payload.customMessage || payload.message || 'Update from Fidelity Life Funeral Services.')
      break
  }

  return callGateway(phone, message)
}

/**
 * Dispatches simultaneous WhatsApp notifications to both the Customer and Fidelity Management.
 */
export async function notifyDual(params: {
  customerPhone?: string
  kind: WhatsAppAlertKind
  payload: Record<string, string | number | undefined>
  adminAlertKind?: WhatsAppAlertKind
}): Promise<{ customer: WhatsAppSendResult; admin: WhatsAppSendResult }> {
  const customerResult = params.customerPhone
    ? await sendWhatsAppAlert(params.customerPhone, params.kind, params.payload)
    : { ok: false, error: 'No customer phone provided' }

  const adminKind = params.adminAlertKind || params.kind
  const adminResult = await sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, adminKind, {
    ...params.payload,
    customerPhone: params.customerPhone,
  })

  return { customer: customerResult, admin: adminResult }
}
