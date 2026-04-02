import mongoose from 'mongoose'

const StoreCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

StoreCategorySchema.index({ name: 1 }, { unique: true })

export const StoreCategoryModel = mongoose.models.StoreCategory || mongoose.model('StoreCategory', StoreCategorySchema)
export type DocStoreCategory = mongoose.Document & {
  name: string
  description?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}
