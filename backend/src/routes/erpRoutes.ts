import { Router } from 'express'
import { postOrderToFidelityErp } from '../services/fidelityErpService'
import { prisma } from '../lib/prisma'

export function createErpRouter(): Router {
  const router = Router()

  /**
   * POST /api/erp/orders/sync
   * Posts completed purchase orders into the Fidelity Life Assurance ERP system.
   */
  router.post('/orders/sync', async (req, res) => {
    try {
      const { orderId, orderReference, customerName, customerPhone, amount, currency, items, paymentReference, paymentMethod } = req.body

      if (!orderReference || amount === undefined) {
        return res.status(400).json({ ok: false, error: 'Order reference and amount are required.' })
      }

      const erpResult = await postOrderToFidelityErp({
        orderId: orderId || orderReference,
        orderReference,
        customerName: customerName || 'Valued Customer',
        customerPhone,
        amount: Number(amount),
        currency: currency || 'USD',
        items,
        paymentReference,
        paymentMethod,
      })

      res.status(200).json(erpResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ ok: false, error: message })
    }
  })

  /**
   * GET /api/erp/orders
   * Retrieves ERP synchronization ledger history from audit trail.
   */
  router.get('/orders', async (_req, res) => {
    try {
      const entries = await prisma.operationAuditEntry.findMany({
        where: { action: 'ORDER_POSTED_TO_ERP' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      res.json(entries)
    } catch (error) {
      res.status(500).json({ ok: false, error: 'Could not fetch ERP audit entries.' })
    }
  })

  return router
}
