import { Router } from 'express'
import { answerCustomerQuery } from '../services/ragService'

export function createAssistantRouter() {
  const router = Router()

  /**
   * POST /api/assistant/chat
   * RAG-augmented LLM chat for customer support.
   */
  router.post('/chat', async (req, res) => {
    try {
      const { message, history } = req.body

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' })
      }

      const result = await answerCustomerQuery({
        query: message.trim(),
        history: Array.isArray(history) ? history : [],
      })

      res.json(result)
    } catch (error) {
      console.error('[assistantRoutes] Chat error:', error)
      const errMessage = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: errMessage })
    }
  })

  return router
}
