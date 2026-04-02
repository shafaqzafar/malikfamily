import mongoose from 'mongoose'

const AmbulanceTripSchema = new mongoose.Schema({
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance', required: true },
  vehicleNumber: { type: String },
  patientName: { type: String },
  patientId: { type: String },
  pickupLocation: { type: String, required: true },
  destination: { type: String, required: true },
  purpose: { type: String, enum: ['Emergency Pickup', 'Transfer', 'Discharge', 'Home Collection', 'Other'], default: 'Emergency Pickup' },
  departureTime: { type: Date, required: true },
  returnTime: { type: Date },
  odometerStart: { type: Number, required: true },
  odometerEnd: { type: Number },
  distanceTraveled: { type: Number },
  driverName: { type: String },
  status: { type: String, enum: ['In Progress', 'Completed', 'Cancelled'], default: 'In Progress' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true })

AmbulanceTripSchema.index({ ambulanceId: 1, departureTime: -1 })
AmbulanceTripSchema.index({ status: 1 })

export const AmbulanceTripModel = mongoose.model('AmbulanceTrip', AmbulanceTripSchema)
