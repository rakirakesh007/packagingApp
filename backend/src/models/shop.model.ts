import { InferSchemaType, Schema, model } from 'mongoose';

const shopSchema = new Schema(
  {
    name:               { type: String, required: true, trim: true },
    mobile:             { type: String, required: true, unique: true, trim: true, index: true },
    address:            { type: String, trim: true, default: '' },
    total_orders_count: { type: Number, default: 0, min: 0 },
  },
  { versionKey: false, timestamps: true }
);

export type ShopDocument = InferSchemaType<typeof shopSchema>;
export const ShopModel = model('Shop', shopSchema);
