import { Schema, model, models } from 'mongoose'

const AllocationSchema = new Schema({
  billingItemId: { type: Schema.Types.ObjectId, ref: 'Hospital_IpdBillingItem', required: true },
  amount: { type: Number, required: true },
}, { _id: false })

const IpdPaymentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', required: true, index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter', required: true },
  amount: { type: Number, required: true },
  method: { type: String },
  refNo: { type: String },
  receivedBy: { type: String },
  receivedAt: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  allocations: { type: [AllocationSchema], default: [] },
  createdByUserId: { type: String },
  createdByUsername: { type: String },
  fbrInvoiceNo: { type: String },
  fbrQrCode: { type: String },
  fbrStatus: { type: String },
  fbrMode: { type: String },
  fbrError: { type: String },
  portal: { type: String, enum: ['hospital', 'reception', 'lab', 'diagnostic', 'pharmacy', 'aesthetic'], index: true },
}, { timestamps: true })

IpdPaymentSchema.index({ encounterId: 1, receivedAt: -1 })

export type HospitalIpdPaymentDoc = {
  _id: string
  patientId: string
  encounterId: string
  amount: number
  method?: string
  refNo?: string
  receivedBy?: string
  receivedAt: Date
  notes?: string
  allocations?: Array<{ billingItemId: string; amount: number }>
  createdByUserId?: string
  createdByUsername?: string
  fbrInvoiceNo?: string
  fbrQrCode?: string
  fbrStatus?: string
  fbrMode?: string
  fbrError?: string
}

export const HospitalIpdPayment = models.Hospital_IpdPayment || model('Hospital_IpdPayment', IpdPaymentSchema)
