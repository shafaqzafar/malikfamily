import mongoose from 'mongoose'

const StoreBatchSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    batchNo: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    purchaseCost: { type: Number, required: true },
    mrp: { type: Number },
    expiry: { type: Date },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorePurchase' },
    purchaseDate: { type: Date },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreSupplier' },
    supplierName: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

StoreBatchSchema.index({ itemId: 1, batchNo: 1 }, { unique: true })
StoreBatchSchema.index({ expiry: 1 })

export const StoreBatchModel = mongoose.models.StoreBatch || mongoose.model('StoreBatch', StoreBatchSchema)
export type DocStoreBatch = mongoose.Document & {
  itemId: string
  batchNo: string
  quantity: number
  purchaseCost: number
  mrp?: number
  expiry?: Date
  purchaseId?: string
  purchaseDate?: Date
  supplierId?: string
  supplierName?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}
