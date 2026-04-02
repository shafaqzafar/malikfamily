import { z } from 'zod'

export const holdPurchaseLineSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  genericName: z.string().optional(),
  expiry: z.string().optional(),
  packs: z.coerce.number().nonnegative().optional(),
  unitsPerPack: z.coerce.number().nonnegative().optional(),
  buyPerPack: z.coerce.number().nonnegative().optional(),
  salePerPack: z.coerce.number().nonnegative().optional(),
  totalItems: z.coerce.number().nonnegative().optional(),
  buyPerUnit: z.coerce.number().nonnegative().optional(),
  salePerUnit: z.coerce.number().nonnegative().optional(),
  lineTaxType: z.enum(['percent', 'fixed']).optional(),
  lineTaxValue: z.coerce.number().nonnegative().optional(),
  category: z.string().optional(),
  barcode: z.string().optional(),
  minStock: z.coerce.number().nonnegative().optional(),
  inventoryKey: z.string().optional(),
  defaultDiscountPct: z.coerce.number().nonnegative().optional(),
  collapsed: z.boolean().optional(),
})

export const holdInvoiceTaxSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  value: z.coerce.number().nonnegative().optional(),
  type: z.enum(['percent', 'fixed']).optional(),
  applyOn: z.enum(['gross', 'net']).optional(),
})

export const holdPurchaseInvoiceCreateSchema = z.object({
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  items: z.array(holdPurchaseLineSchema).min(1),
  invoiceTaxes: z.array(holdInvoiceTaxSchema).optional(),
  discount: z.coerce.number().nonnegative().optional(),
})
