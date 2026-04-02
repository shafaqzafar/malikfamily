import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'node:path'
import mongoose from 'mongoose'
import { env } from './config/env'
import apiRouter from './routes'
import { errorHandler } from './common/middleware/error'

const app = express()

const corsOrigin = env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN
app.use(cors({ origin: corsOrigin as any, credentials: true }))
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// Middleware to check MongoDB connection before processing API requests
app.use('/api', (req: Request, res: Response, next) => {
  // Skip connection check for login and register endpoints
  if (req.path === '/patient/login' || req.path === '/patient/register') {
    return next()
  }
  
  if (mongoose.connection.readyState !== 1) {
    console.error('[API] MongoDB not connected. Ready state:', mongoose.connection.readyState)
    return res.status(503).json({ message: 'Database connection unavailable. Please try again.' })
  }
  next()
})

// Health check endpoint with MongoDB status
app.get('/health', (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  res.json({ 
    ok: dbStatus === 'connected', 
    dbStatus,
    readyState: mongoose.connection.readyState
  })
})

app.use('/api', apiRouter)

// Serve built frontend (root/dist) for all non-API routes
const publicDir = path.join(__dirname, '..', '..', 'dist')
app.use(express.static(publicDir))
app.get('*', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api')) return next()
  try { return res.sendFile(path.join(publicDir, 'index.html')) } catch { return next() }
})

app.use(errorHandler)

export default app
