import mongoose from 'mongoose'
import { env } from './env'

let isConnected = false

export async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('[DB] Using existing connection')
    return mongoose.connection
  }

  mongoose.set('strictQuery', true)

  // Connection event handlers for monitoring
  mongoose.connection.on('connected', () => {
    console.log('[DB] MongoDB connected')
    isConnected = true
  })

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err)
    isConnected = false
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected')
    isConnected = false
  })

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected')
    isConnected = true
  })

  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 60_000,
    connectTimeoutMS: 30_000,
    heartbeatFrequencyMS: 10_000,
    retryWrites: true,
    w: 'majority',
    family: 4,
  } as any)

  isConnected = true
  return mongoose.connection
}

export function getConnectionStatus() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
  }
}
