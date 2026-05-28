import { InferSchemaType, Schema, Types, model } from 'mongoose';

const saleItemSchema = new Schema(
  {
    item_id:                   { type: Schema.Types.ObjectId, required: true, ref: 'Inventory' },
    // sheets_sold: number of sheets sold for this item in this transaction
    sheets_sold:               { type: Number, required: true, min: 1 },
    // wholesale_price_per_sheet: price at time of sale (snapshot from inventory)
    wholesale_price_per_sheet: { type: Number, required: true, min: 0, default: 0 },
    // discount_amount: per-sheet discount negotiated at point of sale by delivery boy
    discount_amount:           { type: Number, required: true, min: 0, default: 0 },
    // final_price: (wholesale_price_per_sheet − discount_amount) × sheets_sold
    final_price:               { type: Number, required: true, min: 0, default: 0 },
    // profit: (final_price_per_sheet − production_cost_per_sheet) × sheets_sold
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
    // total_discount: sum of (discount_amount × sheets_sold) per item — measures discount impact on revenue
    total_discount: { type: Number, required: true, min: 0, default: 0 },
    // total_profit: sum of (final_price − production_cost) per item — realized gross profit before expenses
    total_profit:   { type: Number, required: true, default: 0 },
    payment_mode:   { type: String, enum: ['cash', 'online', 'pending'], required: true, default: 'cash' },
    timestamp:    { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

export type SaleDocument   = InferSchemaType<typeof saleSchema>;
export type SaleItemDocument = InferSchemaType<typeof saleItemSchema>;
export const SaleModel = model('Sale', saleSchema);
