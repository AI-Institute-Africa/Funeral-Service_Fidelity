// Allow Node.js to connect to SMSPoP (self-signed / intermediate CA not in Node's bundle)
// Safe for internal backend-to-backend calls; remove if SMSPoP upgrades their cert chain.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

import { createApp } from './app'
import { env } from './config/env'

process.on('uncaughtException', (err) => {
  console.error('[CRASH GUARD - UNCAUGHT EXCEPTION]:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH GUARD - UNHANDLED REJECTION]:', reason)
})

const startServer = async () => {
  const app = await createApp()
  app.listen(env.port, () => {
    console.log(`Backend server running on http://localhost:${env.port}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start the server:', err)
})
