import { Router } from 'express'
import * as usersCtrl from '../controllers/users.controller'
import * as sidebarCtrl from '../controllers/sidebarPermission.controller'

const r = Router()

// User routes
r.post('/users/login', usersCtrl.login)
r.post('/users/logout', usersCtrl.logout)
r.get('/users', usersCtrl.list)
r.post('/users', usersCtrl.create)
r.put('/users/:id', usersCtrl.update)
r.delete('/users/:id', usersCtrl.remove)
r.get('/users/roles', usersCtrl.listRoles)

// Sidebar permission routes
r.get('/sidebar-permissions', sidebarCtrl.getPermissions)
r.post('/sidebar-permissions', sidebarCtrl.createRole)
r.get('/sidebar-permissions/roles', sidebarCtrl.listRoles)
r.delete('/sidebar-permissions/:role', sidebarCtrl.deleteRole)
r.put('/sidebar-permissions/:role', sidebarCtrl.updatePermissions)
r.post('/sidebar-permissions/:role/reset', sidebarCtrl.resetToDefaults)

export default r
