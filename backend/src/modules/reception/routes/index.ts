import { Router } from 'express'
import * as Users from '../controllers/users.controller'
import * as Auth from '../controllers/auth.controller'
import * as Sidebar from '../controllers/sidebarPermission.controller'
import * as Reports from '../controllers/reports.controller'
import * as Intake from '../controllers/intake.controller'
import * as Shifts from '../controllers/shifts.controller'
import { auth } from '../../../common/middleware/auth'

const r = Router()

// Auth
r.post('/login', Auth.login)
r.post('/logout', Auth.logout)

// Shifts
r.get('/shifts', Shifts.list)
r.post('/shifts', Shifts.create)
r.put('/shifts/:id', Shifts.update)
r.delete('/shifts/:id', Shifts.remove)

// Users
r.get('/users', Users.list)
r.post('/users', Users.create)
r.put('/users/:id', Users.update)
r.delete('/users/:id', Users.remove)

// Sidebar Roles & Permissions
r.get('/sidebar-roles', Sidebar.listRoles)
r.post('/sidebar-roles', Sidebar.createRole)
r.delete('/sidebar-roles/:role', Sidebar.deleteRole)

r.get('/sidebar-permissions', Sidebar.getPermissions)
r.put('/sidebar-permissions/:role', Sidebar.updatePermissions)
r.post('/sidebar-permissions/:role/reset', Sidebar.resetToDefaults)

// Reports
r.get('/reports/my-activity', auth, Reports.myActivity)

// Intake (create Lab/Diagnostic tokens from Reception portal)
r.post('/intake/lab/orders', auth, Intake.createLabOrder)
r.post('/intake/diagnostic/orders', auth, Intake.createDiagnosticOrder)

export default r
