import { Schema, model, models } from 'mongoose'

const ExpenseDepartmentSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export type ExpenseDepartmentDoc = {
  _id: string
  name: string
  active?: boolean
}

export const ExpenseDepartment = models.Hospital_ExpenseDepartment || model('Hospital_ExpenseDepartment', ExpenseDepartmentSchema)
