import app from './app'
import { connectDB } from './config/db'
import { env } from './config/env'
import { Dispense } from './modules/pharmacy/models/Dispense'
import { ensureDefaultPortalLogins } from './seeds/default_logins'

// Handle uncaught errors to prevent server crash
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err)
  // Keep server running but log the error
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason)
  // Keep server running but log the error
})

async function main() {
  try {
    await connectDB()
    console.log('[Server] Database connected successfully')
    
    await Dispense.init()
    try {
      await Dispense.createCollection()
    } catch {}
    
    await ensureDefaultPortalLogins()
    console.log('[Server] Default portal logins ensured')
    
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[Server] Backend listening on http://localhost:${env.PORT}`)
    })

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM received, shutting down gracefully')
      server.close(() => {
        console.log('[Server] Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('[Server] SIGINT received, shutting down gracefully')
      server.close(() => {
        console.log('[Server] Server closed')
        process.exit(0)
      })
    })
    
  } catch (err) {
    console.error('[Server] Failed to start server:', err)
    process.exit(1)
  }
}

main()
