import { Schema, model, models } from 'mongoose'

const SettingsSchema = new Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  logoDataUrl: { type: String, default: '' },
  code: { type: String, default: '' },
  slipFooter: { type: String, default: '' },
  bankName: { type: String, default: '' },
  accountTitle: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  jazzCashNumber: { type: String, default: '' },
  jazzCashTitle: { type: String, default: '' },
}, { timestamps: true })

export type HospitalSettingsDoc = {
  _id: string
  name: string
  phone: string
  address: string
  logoDataUrl?: string
  code?: string
  slipFooter?: string
  bankName?: string
  accountTitle?: string
  accountNumber?: string
  jazzCashNumber?: string
  jazzCashTitle?: string
}

export const HospitalSettings = models.Hospital_Settings || model('Hospital_Settings', SettingsSchema)
