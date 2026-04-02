import { z } from 'zod'

export const settingsUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoDataUrl: z.string().optional(),
  code: z.string().optional(),
  slipFooter: z.string().optional(),
  bankName: z.string().optional(),
  accountTitle: z.string().optional(),
  accountNumber: z.string().optional(),
  jazzCashNumber: z.string().optional(),
  jazzCashTitle: z.string().optional(),
})
