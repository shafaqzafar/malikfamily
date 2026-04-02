import { z } from 'zod'

export const purchaseOrderCreateSchema = z.object({
  orderDate: z.string(),
  expectedDelivery: z.string().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().min(1),
  supplierContact: z.string().optional(),
  supplierPhone: z.string().optional(),
  companyName: z.string().optional(),
  deliveryAddress: z.string().optional(),
  items: z.array(z.object({
    medicineId: z.string().optional(),
    name: z.string().min(1),
    category: z.string().optional(),
    qty: z.number().min(1),
    unit: z.string().optional(),
  })).min(1),
  notes: z.string().optional(),
  terms: z.string().optional(),
  authorizedBy: z.string().optional(),
})

export const purchaseOrderUpdateSchema = purchaseOrderCreateSchema.partial()

export const purchaseOrderStatusSchema = z.object({
  status: z.enum(['Pending', 'Sent', 'Received', 'Complete', 'Cancelled'])
})

export type PurchaseOrderCreate = z.infer<typeof purchaseOrderCreateSchema>
export type PurchaseOrderUpdate = z.infer<typeof purchaseOrderUpdateSchema>
export type PurchaseOrderStatusUpdate = z.infer<typeof purchaseOrderStatusSchema>
