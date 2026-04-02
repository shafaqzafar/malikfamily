import { Router } from 'express'
import * as Auth from '../controllers/auth.controller'
import * as Appointments from '../controllers/appointments.controller'
import * as Prescriptions from '../controllers/prescriptions.controller'
import { auth } from '../../../common/middleware/auth'

const r = Router()

r.post('/register', Auth.register)
r.post('/login', Auth.login)

r.post('/appointments', auth, Appointments.create)
r.get('/appointments', auth, Appointments.list)
r.patch('/appointments/:id', auth, Appointments.update)
r.delete('/appointments/:id', auth, Appointments.remove)
r.post('/appointments/:id/upload', auth, Appointments.upload)

r.get('/prescriptions', auth, Prescriptions.list)
r.get('/prescriptions/:id', auth, Prescriptions.getById)

export default r
