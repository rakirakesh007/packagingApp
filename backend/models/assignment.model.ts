import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment extends Document {
  delivery_boy_id: mongoose.Types.ObjectId;
  items: { item_id: mongoose.Types.ObjectId; qty: number }[];
  status: 'Active' | 'Completed';
  timestamp: Date;
}

const AssignmentSchema: Schema = new Schema({
  delivery_boy_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      item_id: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
      qty: { type: Number, required: true },
    },
  ],
  status: { type: String, enum: ['Active', 'Completed'], default: 'Active' },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);