import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
  item_name: string;
  total_stock: number;
  unit_price: number;
  purchase_price: number;
  low_stock_threshold: number;
  image_url?: string;
}

const InventorySchema: Schema = new Schema({
  item_name: { type: String, required: true },
  total_stock: { type: Number, default: 0 },
  unit_price: { type: Number, required: true },
  purchase_price: { type: Number, required: true },
  low_stock_threshold: { type: Number, default: 10 },
  image_url: { type: String },
});

export default mongoose.model<IInventory>('Inventory', InventorySchema);