import { z } from 'zod'

const ErAllocationSchema = z.object({
  billingItemId: z.string(),
  amount: z.coerce.number().min(0.01),
})

export const createErPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01),
  method: z.string().optional(),
  refNo: z.string().optional(),
  receivedBy: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  allocations: z.array(ErAllocationSchema).optional(),
})

export const updateErPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01).optional(),
  method: z.string().optional(),
  refNo: z.string().optional(),
  receivedBy: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  allocations: z.array(ErAllocationSchema).optional(),
})
