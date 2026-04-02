import { Request, Response } from 'express'
import { AmbulanceModel } from '../models/Ambulance'
import { AmbulanceTripModel } from '../models/AmbulanceTrip'
import { AmbulanceFuelModel } from '../models/AmbulanceFuel'
import { AmbulanceExpenseModel } from '../models/AmbulanceExpense'

// Pagination helper
const getPagination = (query: any) => {
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

 const startOfDay = (d: Date) => {
   const x = new Date(d)
   x.setHours(0, 0, 0, 0)
   return x
 }

 const endOfDay = (d: Date) => {
   const x = new Date(d)
   x.setHours(23, 59, 59, 999)
   return x
 }

 const buildDateRange = (from?: unknown, to?: unknown) => {
   const range: any = {}
   if (from) range.$gte = startOfDay(new Date(from as string))
   if (to) range.$lte = endOfDay(new Date(to as string))
   return Object.keys(range).length ? range : null
 }

// ==================== DASHBOARD ====================
export const ambulanceDashboard = async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = now.toISOString().slice(0, 10)

    const [totalAmbulances, available, onDuty, maintenance, todayTrips, monthTrips, monthDistAgg, monthFuelAgg, monthExpAgg, activeTrips] = await Promise.all([
      AmbulanceModel.countDocuments({ active: true }),
      AmbulanceModel.countDocuments({ active: true, status: 'Available' }),
      AmbulanceModel.countDocuments({ active: true, status: 'On Duty' }),
      AmbulanceModel.countDocuments({ active: true, status: 'Maintenance' }),
      AmbulanceTripModel.countDocuments({ departureTime: { $gte: new Date(today) } }),
      AmbulanceTripModel.countDocuments({ departureTime: { $gte: startOfMonth } }),
      AmbulanceTripModel.aggregate([
        { $match: { departureTime: { $gte: startOfMonth }, status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$distanceTraveled' } } },
      ]),
      AmbulanceFuelModel.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ]),
      AmbulanceExpenseModel.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      AmbulanceTripModel.find({ status: 'In Progress' })
        .populate('ambulanceId', 'vehicleNumber')
        .sort({ departureTime: -1 })
        .limit(5)
        .lean(),
    ])

    res.json({
      stats: {
        totalAmbulances,
        available,
        onDuty,
        maintenance,
        todayTrips,
        monthTrips,
        monthDistance: monthDistAgg[0]?.total || 0,
        monthFuel: monthFuelAgg[0]?.total || 0,
        monthExpenses: monthExpAgg[0]?.total || 0,
        activeTrips: activeTrips.map(t => ({
          id: String(t._id),
          vehicleNumber: (t.ambulanceId as any)?.vehicleNumber || t.vehicleNumber || '',
          patientName: t.patientName,
          destination: t.destination,
          departureTime: t.departureTime,
        })),
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== AMBULANCE MASTER ====================
export const listAmbulances = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = { active: true }
    if (status) filter.status = status
    if (search) {
      const s = new RegExp(search as string, 'i')
      filter.$or = [{ vehicleNumber: s }, { driverName: s }]
    }

    const [ambulances, total] = await Promise.all([
      AmbulanceModel.find(filter).sort({ vehicleNumber: 1 }).skip(skip).limit(limit).lean(),
      AmbulanceModel.countDocuments(filter),
    ])

    res.json({ ambulances, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createAmbulance = async (req: Request, res: Response) => {
  try {
    const { vehicleNumber, type, driverName, driverContact, status, notes } = req.body
    const amb = await AmbulanceModel.create({
      vehicleNumber,
      type: type || 'BLS',
      driverName,
      driverContact,
      status: status || 'Available',
      notes,
    })
    res.status(201).json({ ambulance: amb })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateAmbulance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { vehicleNumber, type, driverName, driverContact, status, notes } = req.body
    const amb = await AmbulanceModel.findByIdAndUpdate(
      id,
      { vehicleNumber, type, driverName, driverContact, status, notes },
      { new: true }
    )
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })
    res.json({ ambulance: amb })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const deleteAmbulance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const amb = await AmbulanceModel.findByIdAndUpdate(id, { active: false }, { new: true })
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getAmbulance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const amb = await AmbulanceModel.findById(id).lean()
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })
    res.json({ ambulance: amb })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== TRIPS ====================
export const listTrips = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, from, to, status, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (ambulanceId) filter.ambulanceId = ambulanceId
    if (status) filter.status = status
    const range = buildDateRange(from, to)
    if (range) filter.departureTime = range
    if (search) {
      const s = new RegExp(search as string, 'i')
      filter.$or = [{ patientName: s }, { pickupLocation: s }, { destination: s }]
    }

    const [trips, total] = await Promise.all([
      AmbulanceTripModel.find(filter)
        .populate('ambulanceId', 'vehicleNumber driverName')
        .sort({ departureTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AmbulanceTripModel.countDocuments(filter),
    ])

    res.json({
      trips: trips.map(t => ({
        ...t,
        id: String(t._id),
        vehicleNumber: (t.ambulanceId as any)?.vehicleNumber || t.vehicleNumber || '',
        driverName: (t.ambulanceId as any)?.driverName || t.driverName || '',
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createTrip = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, patientName, patientId, pickupLocation, destination, purpose, departureTime, odometerStart, driverName, notes } = req.body

    const amb = await AmbulanceModel.findById(ambulanceId)
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })

    const trip = await AmbulanceTripModel.create({
      ambulanceId,
      vehicleNumber: amb.vehicleNumber,
      patientName,
      patientId,
      pickupLocation,
      destination,
      purpose: purpose || 'Emergency Pickup',
      departureTime: departureTime ? new Date(departureTime) : new Date(),
      odometerStart,
      driverName: driverName || amb.driverName,
      status: 'In Progress',
      notes,
      createdBy: (req as any).user?.id,
    })

    // Update ambulance status
    amb.status = 'On Duty'
    await amb.save()

    res.status(201).json({ trip })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { returnTime, odometerEnd, distanceTraveled, status, notes } = req.body

    const trip = await AmbulanceTripModel.findByIdAndUpdate(
      id,
      { returnTime: returnTime ? new Date(returnTime) : undefined, odometerEnd, distanceTraveled, status, notes },
      { new: true }
    )
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    res.json({ trip })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const completeTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { returnTime, odometerEnd } = req.body

    const trip = await AmbulanceTripModel.findById(id).populate('ambulanceId')
    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    const distance = odometerEnd - trip.odometerStart

    trip.returnTime = returnTime ? new Date(returnTime) : new Date()
    trip.odometerEnd = odometerEnd
    trip.distanceTraveled = distance
    trip.status = 'Completed'
    await trip.save()

    // Update ambulance stats
    await AmbulanceModel.findByIdAndUpdate(trip.ambulanceId, {
      $inc: { totalTrips: 1, totalDistance: distance },
      $set: { status: 'Available', lastTrip: new Date() },
    })

    res.json({ trip })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const getTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const trip = await AmbulanceTripModel.findById(id).populate('ambulanceId').lean()
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    res.json({ trip })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== FUEL ====================
export const listFuel = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, from, to, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (ambulanceId) filter.ambulanceId = ambulanceId
    const range = buildDateRange(from, to)
    if (range) filter.date = range
    if (search) {
      const s = new RegExp(search as string, 'i')
      filter.$or = [{ station: s }, { receiptNo: s }, { vehicleNumber: s }]
    }

    const [fuel, total] = await Promise.all([
      AmbulanceFuelModel.find(filter)
        .populate('ambulanceId', 'vehicleNumber')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AmbulanceFuelModel.countDocuments(filter),
    ])

    res.json({
      fuel: fuel.map(f => ({
        ...f,
        id: String(f._id),
        vehicleNumber: (f.ambulanceId as any)?.vehicleNumber || f.vehicleNumber || '',
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createFuel = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, date, quantity, cost, station, odometer, receiptNo, notes } = req.body

    const amb = await AmbulanceModel.findById(ambulanceId)
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })

    const fuel = await AmbulanceFuelModel.create({
      ambulanceId,
      vehicleNumber: amb.vehicleNumber,
      date: date ? new Date(date) : new Date(),
      quantity,
      cost,
      station,
      odometer,
      receiptNo,
      notes,
      createdBy: (req as any).user?.id,
    })

    res.status(201).json({ fuel })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateFuel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { date, quantity, cost, station, odometer, receiptNo, notes } = req.body

    const fuel = await AmbulanceFuelModel.findByIdAndUpdate(
      id,
      { date: date ? new Date(date) : undefined, quantity, cost, station, odometer, receiptNo, notes },
      { new: true }
    )
    if (!fuel) return res.status(404).json({ error: 'Fuel record not found' })
    res.json({ fuel })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const deleteFuel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const fuel = await AmbulanceFuelModel.findByIdAndDelete(id)
    if (!fuel) return res.status(404).json({ error: 'Fuel record not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== EXPENSES ====================
export const listExpenses = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, category, from, to, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (ambulanceId) filter.ambulanceId = ambulanceId
    if (category) filter.category = category
    const range = buildDateRange(from, to)
    if (range) filter.date = range
    if (search) {
      const s = new RegExp(search as string, 'i')
      filter.$or = [{ description: s }, { receiptNo: s }, { vehicleNumber: s }]
    }

    const [expenses, total] = await Promise.all([
      AmbulanceExpenseModel.find(filter)
        .populate('ambulanceId', 'vehicleNumber')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AmbulanceExpenseModel.countDocuments(filter),
    ])

    res.json({
      expenses: expenses.map(e => ({
        ...e,
        id: String(e._id),
        vehicleNumber: (e.ambulanceId as any)?.vehicleNumber || e.vehicleNumber || '',
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createExpense = async (req: Request, res: Response) => {
  try {
    const { ambulanceId, category, amount, date, description, receiptNo } = req.body

    const amb = await AmbulanceModel.findById(ambulanceId)
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' })

    const expense = await AmbulanceExpenseModel.create({
      ambulanceId,
      vehicleNumber: amb.vehicleNumber,
      category,
      amount,
      date: date ? new Date(date) : new Date(),
      description,
      receiptNo,
      createdBy: (req as any).user?.id,
    })

    res.status(201).json({ expense })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { category, amount, date, description, receiptNo } = req.body

    const expense = await AmbulanceExpenseModel.findByIdAndUpdate(
      id,
      { category, amount, date: date ? new Date(date) : undefined, description, receiptNo },
      { new: true }
    )
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json({ expense })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const expense = await AmbulanceExpenseModel.findByIdAndDelete(id)
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== REPORTS ====================
export const getReport = async (req: Request, res: Response) => {
  try {
    const { reportType } = req.params
    const { from, to, ambulanceId } = req.query

    const dateFilter = buildDateRange(from, to) || {}

    let data: any = {}

    switch (reportType) {
      case 'usage': {
        const ambFilter: any = { active: true }
        const ambulances = await AmbulanceModel.find(ambFilter).lean()

        const byAmbulance = await Promise.all(ambulances.map(async amb => {
          const tripFilter: any = { ambulanceId: amb._id, status: 'Completed' }
          if (Object.keys(dateFilter).length) tripFilter.departureTime = dateFilter

          const fuelFilter: any = { ambulanceId: amb._id }
          if (Object.keys(dateFilter).length) fuelFilter.date = dateFilter

          const expFilter: any = { ambulanceId: amb._id }
          if (Object.keys(dateFilter).length) expFilter.date = dateFilter

          const [trips, fuelAgg, expAgg] = await Promise.all([
            AmbulanceTripModel.find(tripFilter).lean(),
            AmbulanceFuelModel.aggregate([
              { $match: fuelFilter },
              { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$cost' } } },
            ]),
            AmbulanceExpenseModel.aggregate([
              { $match: expFilter },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
          ])

          const distance = trips.reduce((s, t) => s + (t.distanceTraveled || 0), 0)
          const fuelCost = fuelAgg[0]?.totalCost || 0
          const expenses = expAgg[0]?.total || 0
          const costPerKm = distance > 0 ? (fuelCost + expenses) / distance : 0

          return {
            ambulanceId: String(amb._id),
            vehicleNumber: amb.vehicleNumber,
            trips: trips.length,
            distance,
            fuel: fuelAgg[0]?.totalQty || 0,
            fuelCost,
            expenses,
            costPerKm,
          }
        }))

        const summary = {
          totalTrips: byAmbulance.reduce((s, a) => s + a.trips, 0),
          totalDistance: byAmbulance.reduce((s, a) => s + a.distance, 0),
          totalFuel: byAmbulance.reduce((s, a) => s + a.fuel, 0),
          totalFuelCost: byAmbulance.reduce((s, a) => s + a.fuelCost, 0),
          totalExpenses: byAmbulance.reduce((s, a) => s + a.expenses, 0),
          avgCostPerKm: 0,
        }
        summary.avgCostPerKm = summary.totalDistance > 0 ? (summary.totalFuelCost + summary.totalExpenses) / summary.totalDistance : 0

        data = { summary, byAmbulance }
        break
      }

      case 'trips': {
        const filter: any = {}
        if (ambulanceId) filter.ambulanceId = ambulanceId
        if (Object.keys(dateFilter).length) filter.departureTime = dateFilter

        const trips = await AmbulanceTripModel.find(filter)
          .populate('ambulanceId', 'vehicleNumber')
          .sort({ departureTime: -1 })
          .lean()

        data = {
          trips: trips.map(t => ({
            id: String(t._id),
            vehicleNumber: (t.ambulanceId as any)?.vehicleNumber || t.vehicleNumber || '',
            patientName: t.patientName,
            pickupLocation: t.pickupLocation,
            destination: t.destination,
            purpose: t.purpose,
            departureTime: t.departureTime,
            distanceTraveled: t.distanceTraveled,
            status: t.status,
          })),
        }
        break
      }

      case 'fuel': {
        const filter: any = {}
        if (ambulanceId) filter.ambulanceId = ambulanceId
        if (Object.keys(dateFilter).length) filter.date = dateFilter

        const fuel = await AmbulanceFuelModel.find(filter)
          .populate('ambulanceId', 'vehicleNumber')
          .sort({ date: -1 })
          .lean()

        data = {
          fuel: fuel.map(f => ({
            vehicleNumber: (f.ambulanceId as any)?.vehicleNumber || f.vehicleNumber || '',
            date: f.date.toISOString().slice(0, 10),
            quantity: f.quantity,
            cost: f.cost,
            station: f.station,
          })),
        }
        break
      }

      case 'expenses': {
        const filter: any = {}
        if (ambulanceId) filter.ambulanceId = ambulanceId
        if (Object.keys(dateFilter).length) filter.date = dateFilter

        const expenses = await AmbulanceExpenseModel.find(filter)
          .populate('ambulanceId', 'vehicleNumber')
          .sort({ date: -1 })
          .lean()

        data = {
          expenses: expenses.map(e => ({
            vehicleNumber: (e.ambulanceId as any)?.vehicleNumber || e.vehicleNumber || '',
            category: e.category,
            amount: e.amount,
            date: e.date.toISOString().slice(0, 10),
            description: e.description,
          })),
        }
        break
      }

      case 'cost-per-km': {
        const ambFilter: any = { active: true }
        const ambulances = await AmbulanceModel.find(ambFilter).lean()

        const byAmbulance = await Promise.all(ambulances.map(async amb => {
          const tripFilter: any = { ambulanceId: amb._id, status: 'Completed' }
          if (Object.keys(dateFilter).length) tripFilter.departureTime = dateFilter

          const fuelFilter: any = { ambulanceId: amb._id }
          if (Object.keys(dateFilter).length) fuelFilter.date = dateFilter

          const expFilter: any = { ambulanceId: amb._id }
          if (Object.keys(dateFilter).length) expFilter.date = dateFilter

          const [trips, fuelAgg, expAgg] = await Promise.all([
            AmbulanceTripModel.find(tripFilter).lean(),
            AmbulanceFuelModel.aggregate([
              { $match: fuelFilter },
              { $group: { _id: null, total: { $sum: '$cost' } } },
            ]),
            AmbulanceExpenseModel.aggregate([
              { $match: expFilter },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
          ])

          const distance = trips.reduce((s, t) => s + (t.distanceTraveled || 0), 0)
          const fuelCost = fuelAgg[0]?.total || 0
          const expenses = expAgg[0]?.total || 0

          return {
            ambulanceId: String(amb._id),
            vehicleNumber: amb.vehicleNumber,
            distance,
            fuelCost,
            expenses,
            costPerKm: distance > 0 ? (fuelCost + expenses) / distance : 0,
          }
        }))

        data = { byAmbulance }
        break
      }

      case 'patient-transport': {
        const filter: any = {}
        if (ambulanceId) filter.ambulanceId = ambulanceId
        if (Object.keys(dateFilter).length) filter.departureTime = dateFilter

        const trips = await AmbulanceTripModel.find(filter)
          .populate('ambulanceId', 'vehicleNumber')
          .sort({ departureTime: -1 })
          .lean()

        data = {
          patientTransport: trips.map(t => ({
            patientName: t.patientName,
            patientId: t.patientId,
            vehicleNumber: (t.ambulanceId as any)?.vehicleNumber || t.vehicleNumber || '',
            purpose: t.purpose,
            pickupLocation: t.pickupLocation,
            destination: t.destination,
            departureTime: t.departureTime,
            distanceTraveled: t.distanceTraveled,
          })),
        }
        break
      }

      default:
        return res.status(400).json({ error: 'Invalid report type' })
    }

    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
