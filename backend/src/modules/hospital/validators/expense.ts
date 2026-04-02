import { z } from 'zod'

export const createExpenseSchema = z.object({
  dateIso: z.string().min(1),
  departmentId: z.string().optional(), // legacy
  expenseDepartmentId: z.string().optional(), // new expense-only department
  departmentName: z.string().optional(), // denormalized
  category: z.string().min(1), // legacy string
  expenseCategoryId: z.string().optional(), // new category reference
  categoryName: z.string().optional(), // denormalized
  amount: z.number().min(0),
  note: z.string().optional(),
  method: z.string().optional(),
  ref: z.string().optional(),
  createdByUsername: z.string().optional(), // Performed By
})

export const listExpenseSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})
