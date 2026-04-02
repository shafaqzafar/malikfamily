import { Request, Response } from 'express'
import { ExpenseDepartment } from '../models/ExpenseDepartment'
import { ExpenseCategory } from '../models/ExpenseCategory'

// ===== Expense Departments =====
export async function listExpenseDepartments(req: Request, res: Response){
  const rows = await ExpenseDepartment.find({ active: { $ne: false } }).sort({ name: 1 }).lean()
  res.json({ departments: rows })
}

export async function createExpenseDepartment(req: Request, res: Response){
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Name required' })
  const existing = await ExpenseDepartment.findOne({ name })
  if (existing) return res.status(400).json({ error: 'Department already exists' })
  const row = await ExpenseDepartment.create({ name })
  res.status(201).json({ department: row })
}

export async function deleteExpenseDepartment(req: Request, res: Response){
  const id = req.params.id
  const row = await ExpenseDepartment.findByIdAndUpdate(id, { active: false }, { new: true })
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
}

// ===== Expense Categories =====
export async function listExpenseCategories(req: Request, res: Response){
  const rows = await ExpenseCategory.find({ active: { $ne: false } }).sort({ name: 1 }).lean()
  res.json({ categories: rows })
}

export async function createExpenseCategory(req: Request, res: Response){
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Name required' })
  const existing = await ExpenseCategory.findOne({ name })
  if (existing) return res.status(400).json({ error: 'Category already exists' })
  const row = await ExpenseCategory.create({ name })
  res.status(201).json({ category: row })
}

export async function deleteExpenseCategory(req: Request, res: Response){
  const id = req.params.id
  const row = await ExpenseCategory.findByIdAndUpdate(id, { active: false }, { new: true })
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
}
