import { Request, Response } from 'express'
import { DialysisSidebarPermission } from '../models/SidebarPermission'
import { z } from 'zod'

// Default sidebar items for Dialysis module
const defaultSidebarItems = [
  { path: '/dialysis', label: 'Dashboard', order: 1 },
  { path: '/dialysis/token-generator', label: 'Token Generator', order: 2 },
  { path: '/dialysis/token-history', label: 'Token History', order: 3 },
  { path: '/dialysis/patients', label: 'Patients', order: 4 },
  { path: '/dialysis/sessions', label: 'Dialysis Sessions', order: 5 },
  { path: '/dialysis/appointments', label: 'Appointments', order: 6 },
  { path: '/dialysis/machines', label: 'Machines', order: 7 },
  { path: '/dialysis/user-management', label: 'Users', order: 50 },
  { path: '/dialysis/sidebar-permissions', label: 'Sidebar Permissions', order: 51 },
  { path: '/dialysis/audit', label: 'Audit Log', order: 52 },
  { path: '/dialysis/settings', label: 'Settings', order: 53 },
]

const permissionSchema = z.object({
  path: z.string(),
  label: z.string(),
  visible: z.boolean(),
  order: z.number(),
})

export const sidebarPermissionCreateSchema = z.object({
  role: z.string().min(1),
  permissions: z.array(permissionSchema).optional(),
})

export const sidebarPermissionUpdateSchema = z.object({
  permissions: z.array(permissionSchema),
})

export const sidebarPermissionQuerySchema = z.object({
  role: z.string().optional(),
})

const defaultVisibility: Record<string, Array<{ path: string; label: string; visible: boolean; order: number }>> = {
  admin: defaultSidebarItems.map(item => ({ ...item, visible: true })),
  staff: defaultSidebarItems.map(item => ({
    ...item,
    visible: [
      '/dialysis/user-management',
      '/dialysis/sidebar-permissions',
      '/dialysis/audit',
      '/dialysis/settings',
    ].includes(item.path) ? false : true,
  })),
  nurse: defaultSidebarItems.map(item => ({
    ...item,
    visible: [
      '/dialysis/user-management',
      '/dialysis/sidebar-permissions',
      '/dialysis/audit',
      '/dialysis/settings',
    ].includes(item.path) ? false : true,
  })),
  technician: defaultSidebarItems.map(item => ({
    ...item,
    visible: [
      '/dialysis/user-management',
      '/dialysis/sidebar-permissions',
      '/dialysis/audit',
      '/dialysis/settings',
    ].includes(item.path) ? false : true,
  })),
}

function normRole(role: string) { return String(role || '').trim().toLowerCase() }
const defaultAllVisible = defaultSidebarItems.map(item => ({ ...item, visible: true }))

function getDefaultForRole(role: string) {
  const r = normRole(role)
  const preset = (defaultVisibility as any)[r]
  return Array.isArray(preset) ? preset : defaultAllVisible
}

export async function listRoles(_req: Request, res: Response) {
  const docs = await DialysisSidebarPermission.find({}, { role: 1 }).sort({ role: 1 }).lean()
  const items = (docs || []).map(d => d.role).filter(r => normRole(r) !== 'superadmin')
  res.json({ items })
}

export async function createRole(req: Request, res: Response) {
  const parsed = sidebarPermissionCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Validation failed', issues: parsed.error.issues })
  const role = normRole(parsed.data.role)
  if (!role) return res.status(400).json({ message: 'Role is required' })
  if (role === 'superadmin') return res.status(403).json({ message: 'Reserved role' })
  const actor = (req as any).user?.name || (req as any).user?.email || 'system'
  const existing = await DialysisSidebarPermission.findOne({ role }).lean()
  if (existing) return res.status(400).json({ message: 'Role already exists' })
  const created = await DialysisSidebarPermission.create({
    role,
    permissions: parsed.data.permissions?.length ? parsed.data.permissions : getDefaultForRole(role),
    updatedBy: actor,
  })
  res.status(201).json(created)
}

export async function deleteRole(req: Request, res: Response) {
  const role = normRole(req.params.role)
  if (!role) return res.status(400).json({ message: 'Role is required' })
  if (['admin', 'staff', 'superadmin'].includes(role)) return res.status(400).json({ message: 'Default roles cannot be deleted' })
  await DialysisSidebarPermission.deleteOne({ role })
  res.json({ ok: true })
}

export async function getPermissions(req: Request, res: Response) {
  const parsed = sidebarPermissionQuerySchema.safeParse(req.query)
  const { role } = parsed.success ? (parsed.data as any) : {}
  const filter: any = {}
  if (role) {
    const r = normRole(role)
    if (r === 'superadmin') return res.status(403).json({ message: 'Reserved role cannot be queried' })
    filter.role = r
  }
  const rows = await DialysisSidebarPermission.find(filter).lean()
  if (rows.length === 0 && !role) {
    const defaults = await createDefaultPermissions()
    return res.json(defaults)
  }
  if (rows.length === 0 && role) {
    const roleDefault = getDefaultForRole(role)
    const doc = await DialysisSidebarPermission.create({
      role: normRole(role),
      permissions: roleDefault,
      updatedBy: (req as any).user?.name || 'system',
    })
    return res.json([doc])
  }
  res.json(rows)
}

export async function updatePermissions(req: Request, res: Response) {
  const { role } = req.params
  const data = sidebarPermissionUpdateSchema.parse(req.body)
  const actor = (req as any).user?.name || (req as any).user?.email || 'system'
  if (normRole(role) === 'superadmin') return res.status(403).json({ message: 'Reserved role cannot be modified' })
  const updated = await DialysisSidebarPermission.findOneAndUpdate(
    { role: normRole(role) },
    { permissions: data.permissions, updatedBy: actor },
    { new: true, upsert: true }
  )
  res.json(updated)
}

export async function resetToDefaults(req: Request, res: Response) {
  const { role } = req.params
  const actor = (req as any).user?.name || (req as any).user?.email || 'system'
  const roleDefault = getDefaultForRole(role)
  const reset = await DialysisSidebarPermission.findOneAndUpdate(
    { role: normRole(role) },
    { permissions: roleDefault, updatedBy: actor },
    { new: true, upsert: true }
  )
  res.json(reset)
}

export async function createDefaultPermissions() {
  const roles = ['admin', 'staff']
  const docs: any[] = []
  for (const r of roles) {
    const ex = await DialysisSidebarPermission.findOne({ role: r }).lean()
    if (!ex) {
      docs.push(await DialysisSidebarPermission.create({ role: r, permissions: getDefaultForRole(r), updatedBy: 'system' }))
    }
  }
  if (docs.length === 0) return await DialysisSidebarPermission.find({}).lean()
  return docs
}
