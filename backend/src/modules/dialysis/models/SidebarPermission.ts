import { Schema, model, models } from 'mongoose'

const PermissionSchema = new Schema({
  path: { type: String, required: true },
  label: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, required: true },
}, { _id: false })

const SidebarPermissionSchema = new Schema({
  role: { type: String, required: true, index: true },
  permissions: { type: [PermissionSchema], default: [] },
  updatedBy: { type: String },
}, { timestamps: true })

export type DialysisSidebarPermissionDoc = {
  _id: string
  role: string
  permissions: Array<{ path: string; label: string; visible: boolean; order: number }>
  updatedBy?: string
}

export const DialysisSidebarPermission = models.Dialysis_SidebarPermission || model('Dialysis_SidebarPermission', SidebarPermissionSchema)
