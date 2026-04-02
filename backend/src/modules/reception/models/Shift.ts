import { Schema, model, models } from 'mongoose'

const ShiftSchema = new Schema({
  name: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { timestamps: true })

export type ReceptionShiftDoc = {
  _id: string
  name: string
  start: string
  end: string
}

export const ReceptionShift = models.Reception_Shift || model('Reception_Shift', ShiftSchema)
