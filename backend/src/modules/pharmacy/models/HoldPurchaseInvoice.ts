import { Schema, model, models } from 'mongoose'

const HoldPurchaseLineSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  genericName: { type: String },
  expiry: { type: String },
  packs: { type: Number, default: 0 },
  unitsPerPack: { type: Number, default: 1 },
  buyPerPack: { type: Number, default: 0 },
  salePerPack: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  buyPerUnit: { type: Number, default: 0 },
  salePerUnit: { type: Number, default: 0 },
  lineTaxType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  lineTaxValue: { type: Number, default: 0 },
  category: { type: String },
  barcode: { type: String },
  minStock: { type: Number },
  inventoryKey: { type: String },
  defaultDiscountPct: { type: Number },
  collapsed: { type: Boolean, default: false },
})

const HoldInvoiceTaxSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  value: { type: Number, default: 0 },
  type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
})

const HoldPurchaseInvoiceSchema = new Schema({
  createdAtIso: { type: String, required: true },
  createdBy: { type: String },
  invoiceNo: { type: String, default: '' },
  invoiceDate: { type: String, default: '' },
  supplierId: { type: String },
  supplierName: { type: String },
  companyId: { type: String },
  companyName: { type: String },
  items: { type: [HoldPurchaseLineSchema], default: [] },
  invoiceTaxes: { type: [HoldInvoiceTaxSchema], default: [] },
  discount: { type: Number, default: 0 },
}, { timestamps: true, collection: 'pharmacy_hold_purchase_invoices' })

export type HoldPurchaseInvoiceDoc = {
  _id: string
  createdAtIso: string
  createdBy?: string
  invoiceNo?: string
  invoiceDate?: string
  supplierId?: string
  supplierName?: string
  companyId?: string
  companyName?: string
  items: Array<any>
  invoiceTaxes?: Array<any>
  discount?: number
}

export const HoldPurchaseInvoice = models.Pharmacy_HoldPurchaseInvoice || model('Pharmacy_HoldPurchaseInvoice', HoldPurchaseInvoiceSchema)
