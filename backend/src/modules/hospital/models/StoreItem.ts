import mongoose from 'mongoose'

const StoreItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, ref: 'StoreCategory' },
    unit: { type: String, default: 'pcs' }, // pcs, pack, box, bottle, tube, set
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0 },
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreBatch' }],
    earliestExpiry: { type: Date },
    lastPurchase: { type: Date },
    lastSupplier: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

StoreItemSchema.index({ name: 1 })
StoreItemSchema.index({ category: 1 })
StoreItemSchema.index({ currentStock: 1 })

export const StoreItemModel = mongoose.models.StoreItem || mongoose.model('StoreItem', StoreItemSchema)
export type DocStoreItem = mongoose.Document & {
  name: string
  category?: string
  unit: string
  currentStock: number
  minStock: number
  avgCost: number
  batches: string[]
  earliestExpiry?: Date
  lastPurchase?: Date
  lastSupplier?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}
