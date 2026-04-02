import mongoose from 'mongoose'

const StoreAlertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['low_stock', 'out_of_stock', 'expiring_soon', 'expired'], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    itemName: { type: String, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreBatch' },
    batchNo: { type: String },
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number },
    expiry: { type: Date },
    daysUntilExpiry: { type: Number },
    message: { type: String, required: true },
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
    acknowledgedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
)

StoreAlertSchema.index({ type: 1, status: 1 })
StoreAlertSchema.index({ itemId: 1 })
StoreAlertSchema.index({ expiry: 1 })

export const StoreAlertModel = mongoose.models.StoreAlert || mongoose.model('StoreAlert', StoreAlertSchema)
export type DocStoreAlert = mongoose.Document & {
  type: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired'
  itemId: string
  itemName: string
  batchId?: string
  batchNo?: string
  currentStock: number
  minStock?: number
  expiry?: Date
  daysUntilExpiry?: number
  message: string
  status: 'active' | 'acknowledged' | 'resolved'
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolvedBy?: string
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}
