import { Schema, model, models } from 'mongoose'

const PurchaseOrderItemSchema = new Schema({
  medicineId: { type: String },
  name: { type: String, required: true },
  category: { type: String },
  qty: { type: Number, required: true },
  unit: { type: String }, // e.g., 'packs', 'boxes', 'units'
})

const PurchaseOrderSchema = new Schema({
  poNumber: { type: String, required: true, unique: true },
  orderDate: { type: String, required: true }, // yyyy-mm-dd
  expectedDelivery: { type: String }, // yyyy-mm-dd
  supplierId: { type: String },
  supplierName: { type: String, required: true },
  supplierContact: { type: String },
  supplierPhone: { type: String },
  companyName: { type: String }, // MedSynch in the image
  deliveryAddress: { type: String },
  items: { type: [PurchaseOrderItemSchema], default: [] },
  notes: { type: String },
  terms: { type: String },
  status: { type: String, enum: ['Pending', 'Sent', 'Received', 'Complete', 'Cancelled'], default: 'Pending' },
  authorizedBy: { type: String },
}, { timestamps: true, collection: 'pharmacy_purchase_orders' })

export type PurchaseOrderDoc = {
  _id: string
  poNumber: string
  orderDate: string
  expectedDelivery?: string
  supplierId?: string
  supplierName: string
  supplierContact?: string
  supplierPhone?: string
  companyName?: string
  deliveryAddress?: string
  items: {
    medicineId?: string
    name: string
    category?: string
    qty: number
    unit?: string
  }[]
  notes?: string
  terms?: string
  status: 'Pending' | 'Sent' | 'Received' | 'Complete' | 'Cancelled'
  authorizedBy?: string
}

export const PurchaseOrder = models.Pharmacy_PurchaseOrder || model('Pharmacy_PurchaseOrder', PurchaseOrderSchema)
