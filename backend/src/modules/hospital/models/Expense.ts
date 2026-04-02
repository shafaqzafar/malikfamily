import { Schema, model, models } from 'mongoose'

const ExpenseSchema = new Schema({
  dateIso: { type: String, required: true, index: true },
  // Support both old and new references
  departmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department' }, // old
  expenseDepartmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_ExpenseDepartment' }, // new expense-only department
  departmentName: { type: String }, // denormalized name for display
  category: { type: String, required: true }, // old: string like "Rent"
  expenseCategoryId: { type: Schema.Types.ObjectId, ref: 'Hospital_ExpenseCategory' }, // new category reference
  categoryName: { type: String }, // denormalized name for display
  amount: { type: Number, required: true, min: 0 },
  note: { type: String },
  method: { type: String },
  ref: { type: String },
  createdBy: { type: String }, // legacy field
  createdByUsername: { type: String }, // new field for Performed By
}, { timestamps: true })

export type HospitalExpenseDoc = {
  _id: string
  dateIso: string
  departmentId?: string
  expenseDepartmentId?: string
  departmentName?: string
  category: string
  expenseCategoryId?: string
  categoryName?: string
  amount: number
  note?: string
  method?: string
  ref?: string
  createdBy?: string
  createdByUsername?: string
}

export const HospitalExpense = models.Hospital_Expense || model('Hospital_Expense', ExpenseSchema)
