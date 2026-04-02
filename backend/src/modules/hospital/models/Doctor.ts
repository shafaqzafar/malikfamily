import { Schema, model, models } from 'mongoose'

const DoctorSchema = new Schema({
  name: { type: String, required: true },
  departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Hospital_Department' }],
  primaryDepartmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department' },
  opdBaseFee: { type: Number },
  opdPublicFee: { type: Number },
  opdPrivateFee: { type: Number },
  opdFollowupFee: { type: Number },
  followupWindowDays: { type: Number },
  username: { type: String },
  phone: { type: String },
  specialization: { type: String },
  qualification: { type: String },
  cnic: { type: String },
  pmdcNo: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export type HospitalDoctorDoc = {
  _id: string
  name: string
  departmentIds?: string[]
  primaryDepartmentId?: string
  opdBaseFee?: number
  opdPublicFee?: number
  opdPrivateFee?: number
  opdFollowupFee?: number
  followupWindowDays?: number
  username?: string
  phone?: string
  specialization?: string
  qualification?: string
  cnic?: string
  pmdcNo?: string
  active: boolean
}

export const HospitalDoctor = models.Hospital_Doctor || model('Hospital_Doctor', DoctorSchema)
