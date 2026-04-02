import mongoose from 'mongoose'

const AmbulanceFuelSchema = new mongoose.Schema({
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance', required: true },
  vehicleNumber: { type: String },
  date: { type: Date, required: true },
  quantity: { type: Number, required: true }, // liters
  cost: { type: Number, required: true },
  station: { type: String },
  odometer: { type: Number, required: true },
  receiptNo: { type: String },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true })

AmbulanceFuelSchema.index({ ambulanceId: 1, date: -1 })

export const AmbulanceFuelModel = mongoose.model('AmbulanceFuel', AmbulanceFuelSchema)
