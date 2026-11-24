import { Router } from 'express'
import {
  createWhatsAppFuneralGroup,
  notifyDual,
  sendWhatsAppAlert,
  FIDELITY_OPERATIONS_PHONE,
  type WhatsAppAlertKind,
} from '../services/whatsappGateway'
import {
  dispatchWorkflowNotifications,
  KNOWN_STAFF,
  resolveStaffContact,
} from '../services/multiChannelNotifier'

export function createWhatsAppRouter() {
  const router = Router()

  /**
   * GET /api/whatsapp/staff-list
   * Returns directory of Fidelity operations staff for case & task assignment.
   */
  router.get('/staff-list', (_req, res) => {
    res.json(KNOWN_STAFF)
  })

  /**
   * POST /api/whatsapp/send-notification
   * Sends structured operational notifications or custom messages to customer phone and Fidelity desk.
   */
  router.post('/send-notification', async (req, res) => {
    try {
      const { phone, kind, payload, customMessage, copyAdmin } = req.body

      if (!phone) {
        return res.status(400).json({ ok: false, error: 'Recipient phone number is required.' })
      }

      const alertKind = (kind || 'custom') as WhatsAppAlertKind
      const result = await sendWhatsAppAlert(phone, alertKind, {
        ...(payload || {}),
        customMessage,
      })

      if (copyAdmin) {
        void sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, alertKind, {
          ...(payload || {}),
          recipientPhone: phone,
          customMessage,
        })
      }

      if (!result.ok) {
        return res.status(502).json({ ok: false, error: result.error || 'Failed to deliver WhatsApp alert.' })
      }

      res.json({
        ok: true,
        queued: result.queued,
        message: 'WhatsApp notification sent successfully.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: message })
    }
  })

  /**
   * POST /api/whatsapp/create-case-group
   * Creates an automatic dedicated WhatsApp Funeral Group for timeline coordination.
   */
  router.post('/create-case-group', async (req, res) => {
    try {
      const { caseReference, deceasedName, customerName, familyPhone, coordinatorPhone } = req.body

      if (!caseReference || !familyPhone) {
        return res.status(400).json({ ok: false, error: 'Case reference and family phone number are required.' })
      }

      const result = await createWhatsAppFuneralGroup({
        caseReference,
        deceasedName,
        customerName,
        familyPhone,
        coordinatorPhone,
      })

      res.json({
        ok: true,
        groupId: result.groupId,
        subject: result.subject,
        inviteLink: result.inviteLink,
        message: 'WhatsApp funeral group created and invitation dispatched to family.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: message })
    }
  })

  /**
   * POST /api/whatsapp/notify-assistance
   * Dispatches WhatsApp alerts for incoming customer funeral assistance requests,
   * creating an automatic coordination group and alerting operations triage.
   */
  router.post('/notify-assistance', async (req, res) => {
    try {
      const { reference, customerName, customerPhone, customerEmail, kindLabel, message, contactPreference } = req.body

      let inviteLink = ''
      if (customerPhone) {
        const groupResult = await createWhatsAppFuneralGroup({
          caseReference: reference || `AR-${Date.now()}`,
          deceasedName: customerName ? `${customerName}'s Family` : 'Family Care',
          customerName,
          familyPhone: customerPhone,
        })
        inviteLink = groupResult.inviteLink || ''
      }

      // Multi-channel dispatch: WhatsApp, SMS, Email, Call
      const dispatchResults = await dispatchWorkflowNotifications({
        event: 'customer_self_request',
        caseReference: reference || `REQ-${Date.now().toString(36).toUpperCase()}`,
        deceasedName: customerName ? `${customerName}'s Family` : 'Bereavement Support',
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          contactPreference: contactPreference || 'whatsapp',
        },
        notes: message,
        inviteLink,
      })

      res.json({
        ok: true,
        inviteLink,
        notifications: dispatchResults,
        message: 'Assistance request logged, WhatsApp group initialized, and multi-channel notifications dispatched to customer and admin desk.',
      })
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: errMessage })
    }
  })

  /**
   * POST /api/whatsapp/notify-assignment
   * Notifies assigned staff member via WhatsApp, Email, SMS,
   * AND notifies customer via WhatsApp, Email, SMS, or Call.
   */
  router.post('/notify-assignment', async (req, res) => {
    try {
      const {
        caseReference,
        deceasedName,
        coordinatorName,
        coordinatorPhone,
        coordinatorEmail,
        customerName,
        customerPhone,
        customerEmail,
        contactPreference = 'whatsapp',
        notes,
        inviteLink,
      } = req.body

      if (!caseReference || !coordinatorName) {
        return res.status(400).json({ ok: false, error: 'Case reference and coordinator name are required.' })
      }

      const results = await dispatchWorkflowNotifications({
        event: 'case_assigned',
        caseReference,
        deceasedName,
        customer: customerPhone ? {
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          contactPreference,
        } : undefined,
        assignedStaff: {
          name: coordinatorName,
          phone: coordinatorPhone,
          email: coordinatorEmail,
        },
        notes,
        inviteLink,
      })

      res.json({
        ok: true,
        message: `Coordinator ${coordinatorName} and family notified via WhatsApp, SMS & Email.`,
        details: results,
      })
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: errMessage })
    }
  })

  /**
   * POST /api/whatsapp/notify-task
   * Notifies staff member via WhatsApp, Email, and SMS AND broadcasts to the case WhatsApp group simultaneously
   * when assigned a task, stage, or checklist item (or when a task logbook entry is recorded).
   */
  router.post('/notify-task', async (req, res) => {
    try {
      const {
        caseReference,
        deceasedName,
        staffName,
        staffPhone,
        staffEmail,
        familyPhone,
        groupId,
        taskName,
        category,
        quantity,
        notes,
        plannedAt,
        steps,
        logUpdate,
        stepLabel,
        previousStatus,
        nextStatus,
        updatedBy,
      } = req.body

      if (!caseReference || !staffName || !taskName) {
        return res.status(400).json({ ok: false, error: 'Case reference, staff name, and task name are required.' })
      }

      const isLogUpdate = Boolean(logUpdate)
      const results = await dispatchWorkflowNotifications({
        event: isLogUpdate ? 'task_log_update' : 'task_assigned',
        caseReference,
        deceasedName,
        groupId,
        customer: familyPhone ? { phone: familyPhone } : undefined,
        assignedStaff: {
          name: staffName,
          phone: staffPhone,
          email: staffEmail,
        },
        task: {
          name: taskName,
          category,
          quantity,
          notes,
          plannedAt,
          steps: Array.isArray(steps) ? steps : undefined,
        },
        logUpdate: isLogUpdate
          ? {
              entry: String(logUpdate),
              step: stepLabel ? String(stepLabel) : undefined,
              previousStatus: previousStatus ? String(previousStatus) : undefined,
              nextStatus: nextStatus ? String(nextStatus) : undefined,
              updatedBy: updatedBy ? String(updatedBy) : staffName,
            }
          : undefined,
      })

      res.json({
        ok: true,
        message: isLogUpdate
          ? `Logbook update for "${taskName}" synced to ${staffName} and the case WhatsApp group.`
          : `Staff member ${staffName} and case WhatsApp group notified for task "${taskName}".`,
        details: results,
      })
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: errMessage })
    }
  })

  /**
   * POST /api/whatsapp/notify-walkin
   * Dispatches notifications when a walk-in request is logged.
   */
  router.post('/notify-walkin', async (req, res) => {
    try {
      const {
        caseReference,
        deceasedName,
        customerName,
        customerPhone,
        customerEmail,
        coordinator,
        serviceLocation,
        inviteLink,
      } = req.body

      const results = await dispatchWorkflowNotifications({
        event: 'walkin_request',
        caseReference,
        deceasedName,
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          contactPreference: 'whatsapp',
        },
        assignedStaff: coordinator ? { name: coordinator } : undefined,
        notes: `Walk-in intake logged at branch. Service location: ${serviceLocation || 'Harare'}.`,
        inviteLink,
      })

      // If coordinator was already assigned during walk-in creation, trigger case assignment notification
      if (coordinator) {
        void dispatchWorkflowNotifications({
          event: 'case_assigned',
          caseReference,
          deceasedName,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
          },
          assignedStaff: { name: coordinator },
          notes: 'Walk-in client assigned at intake.',
          inviteLink,
        })
      }

      res.json({
        ok: true,
        message: 'Walk-in client and operations desk notified via WhatsApp, SMS & Email.',
        details: results,
      })
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: errMessage })
    }
  })

  /**
   * POST /api/whatsapp/notify-chema
   * Sends notifications for Chema Wallet contributions, verification requests and disbursements.
   */
  router.post('/notify-chema', async (req, res) => {
    try {
      const {
        type = 'contribution',
        caseRef,
        deceasedName,
        amount,
        contributorName,
        contributorPhone,
        recipientPhone,
        method,
        message,
        purpose,
        destination,
      } = req.body

      if (type === 'contribution') {
        if (contributorPhone) {
          void sendWhatsAppAlert(contributorPhone, 'chema.contribution', {
            caseRef,
            deceasedName,
            amount,
            contributorName,
            method,
            message,
          })
        }

        if (recipientPhone) {
          void sendWhatsAppAlert(recipientPhone, 'chema.contribution', {
            caseRef,
            deceasedName,
            amount,
            contributorName: contributorName || 'A generous supporter',
            method,
            message,
          })
        }

        void sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'admin.chema_submission', {
          caseRef,
          deceasedName,
          amount,
          contributorName,
          contributorPhone,
          method,
        })
      } else if (type === 'disbursement') {
        if (recipientPhone) {
          void sendWhatsAppAlert(recipientPhone, 'chema.disbursement', {
            caseRef,
            deceasedName,
            amount,
            purpose,
            destination,
          })
        }
        void sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'chema.disbursement', {
          caseRef,
          deceasedName,
          amount,
          purpose,
          destination,
        })
      } else if (type === 'verification_submitted') {
        if (recipientPhone) {
          void sendWhatsAppAlert(recipientPhone, 'chema.verification_submitted', {
            caseRef,
            deceasedName,
            customerName: contributorName,
          })
        }
        void sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'admin.chema_submission', {
          caseRef,
          deceasedName,
          amount: 0,
          contributorName: `${contributorName || 'Family'} (Submitted for Verification)`,
        })
      }

      res.json({
        ok: true,
        message: 'Chema Wallet WhatsApp alerts successfully dispatched to all parties.',
      })
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: errMessage })
    }
  })

  return router
}
