import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { env } from '../../../config/env'
import { ReceptionUser } from '../models/User'
import { ReceptionShift } from '../models/Shift'

function toMin(hhmm: string){
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function to12h(hhmm: string){
  const [h, m] = hhmm.split(':').map(Number)
  const hour = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
}

function isNowWithinShift(shift: any, now: Date){
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const cur = toMin(hhmm)
  const start = toMin(String(shift?.start || '00:00'))
  const end = toMin(String(shift?.end || '00:00'))
  // Handle overnight shifts (e.g., 20:00 to 08:00)
  if (start > end) {
    return cur >= start || cur < end
  }
  return cur >= start && cur < end
}

export async function login(req: Request, res: Response){
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })
  const user = await ReceptionUser.findOne({ username }).lean() as any
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

  // Optional shift restriction
  if (user.shiftRestricted) {
    if (!user.shiftId) return res.status(403).json({ message: 'Shift not assigned' })
    const shift: any = await ReceptionShift.findById(String(user.shiftId)).lean()
    if (!shift) return res.status(403).json({ message: 'Shift not found' })
    const now = new Date()
    if (!isNowWithinShift(shift, now)) {
      return res.status(403).json({ message: `Login not allowed outside shift timing (${shift.name}: ${to12h(shift.start)}-${to12h(shift.end)})` })
    }
  }

  const token = jwt.sign({ sub: user._id, username: user.username, role: user.role, scope: 'reception' }, env.JWT_SECRET, { expiresIn: '1d' })
  res.json({ token, user: { id: user._id, username: user.username, role: user.role, shiftId: user.shiftId ? String(user.shiftId) : undefined, shiftRestricted: !!user.shiftRestricted } })
}

export async function logout(_req: Request, res: Response){
  res.json({ success: true })
}
