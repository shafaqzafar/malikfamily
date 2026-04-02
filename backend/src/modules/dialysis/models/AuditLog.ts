import { Schema, model, models } from 'mongoose'

const AuditLogSchema = new Schema({
  actor: { type: String },
  action: { type: String },
  label: { type: String },
  method: { type: String },
  path: { type: String },
  at: { type: String },
  detail: { type: String },
}, { timestamps: true })

export type DialysisAuditLogDoc = {
  _id: string
  actor?: string
  action?: string
  label?: string
  method?: string
  path?: string
  at?: string
  detail?: string
}

export const DialysisAuditLog = models.Dialysis_AuditLog || model('Dialysis_AuditLog', AuditLogSchema)
