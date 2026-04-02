import { Schema, model, models } from 'mongoose'

const ExpenseCategorySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export type ExpenseCategoryDoc = {
  _id: string
  name: string
  active?: boolean
}

export const ExpenseCategory = models.Hospital_ExpenseCategory || model('Hospital_ExpenseCategory', ExpenseCategorySchema)
