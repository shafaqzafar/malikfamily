import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../../../config/env'
import { PatientUser } from '../models/PatientUser'

const registerSchema = z.object({
  fullName: z.string().min(1),
  phoneNumber: z.string().min(1),
  dateOfBirth: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(4),
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body || {})
    const username = String(data.username).trim().toLowerCase()

    const existing = await PatientUser.findOne({ username }).lean()
    if (existing) return res.status(409).json({ message: 'Username already exists' })

    const passwordHash = await bcrypt.hash(data.password, 10)

    const doc = await PatientUser.create({
      username,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      dateOfBirth: data.dateOfBirth,
      passwordHash,
    })

    res.status(201).json({
      success: true,
      user: {
        id: doc._id,
        username: doc.username,
        fullName: doc.fullName,
        phoneNumber: doc.phoneNumber,
      },
    })
  } catch (err: any) {
    if (err?.name === 'ZodError' || err?.errors) {
      const msg = err.errors?.[0]?.message || 'Validation error'
      return res.status(400).json({ message: msg })
    }
    throw err
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body || {})
    const username = String(data.username).trim().toLowerCase()

    const user: any = await PatientUser.findOne({ username }).lean()
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(data.password, String(user.passwordHash || ''))
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign({ sub: user._id, username: user.username, scope: 'patient' }, env.JWT_SECRET, { expiresIn: '7d' })
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      },
    })
  } catch (err: any) {
    if (err?.name === 'ZodError' || err?.errors) {
      const msg = err.errors?.[0]?.message || 'Validation error'
      return res.status(400).json({ message: msg })
    }
    throw err
  }
}
