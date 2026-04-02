import { Router } from 'express'
import { auth } from '../../../common/middleware/auth'
import {
  storeDashboard,
  listCategories, createCategory, updateCategory, deleteCategory,
  listSuppliers, createSupplier, updateSupplier, deleteSupplier, getSupplierLedger, createSupplierPayment,
  listInventory, createItem, updateItem, listBatches,
  listPurchases, createPurchase, getPurchase,
  listIssues, createIssue, getIssue,
  listAlerts, acknowledgeAlert, resolveAlert,
  getReport,
  listDepartments,
} from '../controllers/store.controller'

const router = Router()

// All routes require authentication
router.use(auth)

// Dashboard
router.get('/dashboard', storeDashboard)

// Categories
router.get('/categories', listCategories)
router.post('/categories', createCategory)
router.put('/categories/:id', updateCategory)
router.delete('/categories/:id', deleteCategory)

// Suppliers
router.get('/suppliers', listSuppliers)
router.post('/suppliers', createSupplier)
router.put('/suppliers/:id', updateSupplier)
router.delete('/suppliers/:id', deleteSupplier)
router.get('/suppliers/:supplierId/ledger', getSupplierLedger)
router.post('/suppliers/payments', createSupplierPayment)

// Inventory
router.get('/inventory', listInventory)
router.post('/inventory', createItem)
router.put('/inventory/:id', updateItem)
router.get('/inventory/:itemId/batches', listBatches)

// Purchases
router.get('/purchases', listPurchases)
router.post('/purchases', createPurchase)
router.get('/purchases/:id', getPurchase)

// Issues
router.get('/issues', listIssues)
router.post('/issues', createIssue)
router.get('/issues/:id', getIssue)

// Alerts
router.get('/alerts', listAlerts)
router.post('/alerts/:id/acknowledge', acknowledgeAlert)
router.post('/alerts/:id/resolve', resolveAlert)

// Reports
router.get('/reports/:reportType', getReport)

// Departments (for issue form)
router.get('/departments', listDepartments)

export default router
