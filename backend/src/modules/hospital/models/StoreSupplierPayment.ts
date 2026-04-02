import mongoose from 'mongoose'

const StoreSupplierPaymentSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreSupplier', required: true },
    supplierName: { type: String },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'bank', 'cheque'], default: 'cash' },
    reference: { type: String }, // cheque number, transaction ID, etc.
    date: { type: Date, required: true },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  },
  { timestamps: true }
)

StoreSupplierPaymentSchema.index({ supplierId: 1 })
StoreSupplierPaymentSchema.index({ date: -1 })

export const StoreSupplierPaymentModel = mongoose.models.StoreSupplierPayment || mongoose.model('StoreSupplierPayment', StoreSupplierPaymentSchema)
export type DocStoreSupplierPayment = mongoose.Document & {
  supplierId: string
  supplierName?: string
  amount: number
  method: 'cash' | 'bank' | 'cheque'
  reference?: string
  date: Date
  notes?: string
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}
