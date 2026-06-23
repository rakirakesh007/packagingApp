import { InferSchemaType, Schema, Types, model } from 'mongoose';

const saleItemSchema = new Schema(
  {
    item_id:                   { type: Schema.Types.ObjectId, required: true, ref: 'Inventory' },
    // sale_type: 'wholesale' = sell by sheet (delivery boys + admin); 'retail' = sell individual packets (admin only)
    sale_type:                 { type: String, enum: ['wholesale', 'retail'], default: 'wholesale' },
    // sheets_sold: canonical inventory unit. Whole number for wholesale; fractional (packets/units_per_sheet) for retail.
    sheets_sold:               { type: Number, required: true, min: 0.001 },
    // packets_sold: set only for retail sales; null for wholesale
    packets_sold:              { type: Number, default: null },
    // wholesale_price_per_sheet: snapshot from inventory at time of sale (default price + retail cost basis)
    wholesale_price_per_sheet: { type: Number, required: true, min: 0, default: 0 },
    // selling_price_per_sheet: actual negotiated rate charged, normalized per sheet (retail = per-packet price × units_per_sheet)
    selling_price_per_sheet:   { type: Number, required: true, min: 0, default: 0 },
    // final_price: revenue collected for this line item (backend-computed, never trust frontend)
    final_price:               { type: Number, required: true, min: 0, default: 0 },
    // profit: final_price minus production cost allocated to sheets consumed
    profit:                    { type: Number, required: true, default: 0 },
    item_name:                 { type: String, required: true, trim: true, default: '' },
    hindi_name:                { type: String, trim: true, default: '' },
    description:               { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    delivery_boy_id: { type: Schema.Types.ObjectId, required: false, default: null, index: true },
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
    total_amount:   { type: Number, required: true, min: 0 },
    // total_profit: sum of per-item profit (wholesale = 10% of selling price; retail = selling − wholesale cost)
    total_profit:   { type: Number, required: true, default: 0 },
    payment_mode:   { type: String, enum: ['cash', 'online', 'pending'], required: true, default: 'cash' },
    timestamp:    { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

export type SaleDocument   = InferSchemaType<typeof saleSchema>;
export type SaleItemDocument = InferSchemaType<typeof saleItemSchema>;
export const SaleModel = model('Sale', saleSchema);
