import mongoose, { Schema, Document } from 'mongoose';

export interface ISale extends Document {
  customer_name: string;
  items: { item_id: mongoose.Types.ObjectId; qty: number; price: number }[];
  total_amount: number;
  payment_mode: 'Cash' | 'Online';
  delivery_boy_id: mongoose.Types.ObjectId;
  timestamp: Date;
}

const SaleSchema: Schema = new Schema({
  customer_name: { type: String, required: true },
  items: [
    {
      item_id: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
      qty: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  total_amount: { type: Number, required: true },
  payment_mode: { type: String, enum: ['Cash', 'Online'], required: true },
  delivery_boy_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<ISale>('Sale', SaleSchema);