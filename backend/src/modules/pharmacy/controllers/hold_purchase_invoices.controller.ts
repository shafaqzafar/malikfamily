import { Request, Response } from 'express'
import { HoldPurchaseInvoice } from '../models/HoldPurchaseInvoice'
import { holdPurchaseInvoiceCreateSchema } from '../validators/hold_purchase_invoice'

export async function list(req: Request, res: Response) {
  const items = await HoldPurchaseInvoice.find({}).sort({ createdAt: -1 }).limit(200).lean()
  res.json({ items })
}

export async function getOne(req: Request, res: Response) {
  const id = String(req.params.id || '')
  const doc = await HoldPurchaseInvoice.findById(id).lean()
  if (!doc) return res.status(404).json({ message: 'Not found' })
  res.json(doc)
}

export async function create(req: Request, res: Response) {
  const data = holdPurchaseInvoiceCreateSchema.parse(req.body)
  const createdAtIso = new Date().toISOString()
  const createdBy = (req as any).user?.username || (req as any).user?.name || 'purchase'
  const doc = await HoldPurchaseInvoice.create({
    createdAtIso,
    createdBy,
    invoiceNo: data.invoiceNo || '',
    invoiceDate: data.invoiceDate || '',
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    companyId: data.companyId,
    companyName: data.companyName,
    items: data.items,
    invoiceTaxes: data.invoiceTaxes || [],
    discount: data.discount || 0,
  })
  res.status(201).json(doc)
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id || '')
  await HoldPurchaseInvoice.findByIdAndDelete(id)
  res.json({ ok: true })
}
