import mongoose from 'mongoose'

const AmbulanceExpenseSchema = new mongoose.Schema({
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance', required: true },
  vehicleNumber: { type: String },
  category: { type: String, enum: ['Fuel', 'Maintenance', 'Repairs', 'Driver Allowance', 'Insurance', 'Registration', 'Other'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  receiptNo: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true })

AmbulanceExpenseSchema.index({ ambulanceId: 1, date: -1 })
AmbulanceExpenseSchema.index({ category: 1 })

export const AmbulanceExpenseModel = mongoose.model('AmbulanceExpense', AmbulanceExpenseSchema)
