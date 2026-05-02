import { InferSchemaType, Schema, Types, model } from 'mongoose';

const saleItemSchema = new Schema(
  {
    item_id: { type: Schema.Types.ObjectId, required: true, ref: 'Inventory' },
    qty:     { type: Number, required: true, min: 1 },
    price:   { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    delivery_boy_id: { type: Schema.Types.ObjectId, required: true, index: true },
    shop_id:          { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    shop_name:        { type: String, trim: true, default: '' },
    customer_name:    { type: String, trim: true, default: '' },
    items: {
      type: [saleItemSchema],
      required: true,
      validate: {
        validator: (v: Types.DocumentArray<InferSchemaType<typeof saleItemSchema>>) => v.length > 0,
        message: 'A sale must contain at least one item.',
      },
    },
    total_amount: { type: Number, required: true, min: 0 },
    payment_mode: { type: String, enum: ['cash', 'online', 'pending'], required: true, default: 'cash' },
    timestamp:    { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

export type SaleDocument   = InferSchemaType<typeof saleSchema>;
export type SaleItemDocument = InferSchemaType<typeof saleItemSchema>;
export const SaleModel = model('Sale', saleSchema);
