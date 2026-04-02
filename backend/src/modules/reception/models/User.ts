import { Schema, model, models } from 'mongoose'

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin','receptionist'], default: 'receptionist' },
  passwordHash: { type: String, required: true },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Reception_Shift' },
  shiftRestricted: { type: Boolean, default: false },
}, { timestamps: true })

export type ReceptionUserDoc = {
  _id: string
  username: string
  role: 'admin'|'receptionist'
  passwordHash: string
  shiftId?: string
  shiftRestricted?: boolean
}

export const ReceptionUser = models.Reception_User || model('Reception_User', UserSchema)
