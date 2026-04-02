import mongoose from 'mongoose'

const StoreSupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    taxId: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    totalPurchases: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    lastOrder: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
)

StoreSupplierSchema.index({ name: 1 })
StoreSupplierSchema.index({ status: 1 })

export const StoreSupplierModel = mongoose.models.StoreSupplier || mongoose.model('StoreSupplier', StoreSupplierSchema)
export type DocStoreSupplier = mongoose.Document & {
  name: string
  company?: string
  phone?: string
  email?: string
  address?: string
  taxId?: string
  status: 'Active' | 'Inactive'
  totalPurchases: number
  paid: number
  outstanding: number
  lastOrder?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}
