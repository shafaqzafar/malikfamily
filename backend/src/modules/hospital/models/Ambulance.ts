import mongoose from 'mongoose'

const AmbulanceSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['BLS', 'ALS', 'Patient Transport', 'Neonatal'], default: 'BLS' },
  driverName: { type: String, required: true },
  driverContact: { type: String },
  status: { type: String, enum: ['Available', 'On Duty', 'Maintenance'], default: 'Available' },
  notes: { type: String },
  totalTrips: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  lastTrip: { type: Date },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export const AmbulanceModel = mongoose.model('Ambulance', AmbulanceSchema)
