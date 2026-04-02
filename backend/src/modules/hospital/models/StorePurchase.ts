import mongoose from 'mongoose'

const StorePurchaseItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem' },
  itemName: { type: String, required: true },
  category: { type: String },
  batchNo: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'pcs' },
  purchaseCost: { type: Number, required: true, min: 0 },
  mrp: { type: Number },
  expiry: { type: Date },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreBatch' },
})

const StorePurchaseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    invoiceNo: { type: String, required: true, trim: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreSupplier', required: true },
    supplierName: { type: String, required: true },
    paymentMode: { type: String, enum: ['cash', 'credit', 'bank'], default: 'credit' },
    paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    notes: { type: String },
    items: [StorePurchaseItemSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  },
  { timestamps: true }
)

StorePurchaseSchema.index({ invoiceNo: 1 })
StorePurchaseSchema.index({ supplierId: 1 })
StorePurchaseSchema.index({ date: -1 })

export const StorePurchaseModel = mongoose.models.StorePurchase || mongoose.model('StorePurchase', StorePurchaseSchema)
export type DocStorePurchase = mongoose.Document & {
  date: Date
  invoiceNo: string
  supplierId: string
  supplierName: string
  paymentMode: 'cash' | 'credit' | 'bank'
  paymentStatus: 'paid' | 'partial' | 'unpaid'
  totalAmount: number
  paidAmount: number
  notes?: string
  items: Array<{
    itemId?: string
    itemName: string
    category?: string
    batchNo?: string
    quantity: number
    unit: string
    purchaseCost: number
    mrp?: number
    expiry?: Date
    batchId?: string
  }>
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}
