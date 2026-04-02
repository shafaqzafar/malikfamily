import { Router } from 'express'
import { auth } from '../../../common/middleware/auth'
import {
  ambulanceDashboard,
  listAmbulances, createAmbulance, updateAmbulance, deleteAmbulance, getAmbulance,
  listTrips, createTrip, updateTrip, completeTrip, getTrip,
  listFuel, createFuel, updateFuel, deleteFuel,
  listExpenses, createExpense, updateExpense, deleteExpense,
  getReport,
} from '../controllers/ambulance.controller'

const router = Router()

// All routes require authentication
router.use(auth)

// Dashboard
router.get('/dashboard', ambulanceDashboard)

// Ambulance Master
router.get('/master', listAmbulances)
router.post('/master', createAmbulance)
router.put('/master/:id', updateAmbulance)
router.delete('/master/:id', deleteAmbulance)
router.get('/master/:id', getAmbulance)

// Trips
router.get('/trips', listTrips)
router.post('/trips', createTrip)
router.put('/trips/:id', updateTrip)
router.post('/trips/:id/complete', completeTrip)
router.get('/trips/:id', getTrip)

// Fuel
router.get('/fuel', listFuel)
router.post('/fuel', createFuel)
router.put('/fuel/:id', updateFuel)
router.delete('/fuel/:id', deleteFuel)

// Expenses
router.get('/expenses', listExpenses)
router.post('/expenses', createExpense)
router.put('/expenses/:id', updateExpense)
router.delete('/expenses/:id', deleteExpense)

// Reports
router.get('/reports/:reportType', getReport)

export default router
