import { InferSchemaType, Schema, model } from 'mongoose';

/**
 * Return — append-only log of stock a delivery boy hands back to the warehouse.
 * Used to compute a boy's running balance:
 *   withBoy = Σ assigned (Loading) − Σ sold (Sale) − Σ returned (Return)
 */
const returnSchema = new Schema(
  {
    delivery_boy_id: { type: Schema.Types.ObjectId, required: true, index: true },
    item_id:         { type: Schema.Types.ObjectId, required: true, ref: 'Inventory' },
    qty:             { type: Number, required: true, min: 0 },
    date:            { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false, timestamps: true }
);

export type ReturnDocument = InferSchemaType<typeof returnSchema>;
export const ReturnModel = model('Return', returnSchema);
