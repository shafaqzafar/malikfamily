import mongoose from 'mongoose'

const StoreIssueItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
  itemName: { type: String, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreBatch', required: true },
  batchNo: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'pcs' },
  costPerUnit: { type: Number, required: true, min: 0 },
})

const StoreIssueSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital_Department', required: true },
    departmentName: { type: String, required: true },
    issuedTo: { type: String },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: { type: String },
    items: [StoreIssueItemSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  },
  { timestamps: true }
)

StoreIssueSchema.index({ departmentId: 1 })
StoreIssueSchema.index({ date: -1 })

export const StoreIssueModel = mongoose.models.StoreIssue || mongoose.model('StoreIssue', StoreIssueSchema)
export type DocStoreIssue = mongoose.Document & {
  date: Date
  departmentId: string
  departmentName: string
  issuedTo?: string
  totalAmount: number
  notes?: string
  items: Array<{
    itemId: string
    itemName: string
    batchId: string
    batchNo: string
    quantity: number
    unit: string
    costPerUnit: number
  }>
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}
