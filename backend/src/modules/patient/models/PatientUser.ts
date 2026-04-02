import { Schema, model, models } from 'mongoose'

const PatientUserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  fullName: { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  dateOfBirth: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

export type PatientUserDoc = {
  _id: string
  username: string
  fullName: string
  phoneNumber: string
  dateOfBirth: string
  passwordHash: string
  createdAt?: Date
  updatedAt?: Date
}

export const PatientUser = models.Patient_User || model('Patient_User', PatientUserSchema)
