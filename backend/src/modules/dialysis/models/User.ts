import { Schema, model, models } from 'mongoose'

const DialysisUserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  fullName: { type: String },
  role: { type: String, required: true, default: 'staff', index: true },
  phone: { type: String },
  phoneNormalized: { type: String, index: true },
  email: { type: String },
  active: { type: Boolean, default: true, index: true },
  passwordHash: { type: String },
}, { timestamps: true })

export type DialysisUserDoc = {
  _id: string
  username: string
  fullName?: string
  role: string
  phone?: string
  phoneNormalized?: string
  email?: string
  active: boolean
  passwordHash?: string
  createdAt?: Date
  updatedAt?: Date
}

export const DialysisUser = models.Dialysis_User || model('Dialysis_User', DialysisUserSchema)
