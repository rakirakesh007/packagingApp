import { InferSchemaType, Schema, model } from 'mongoose';

const inventorySchema = new Schema(
  {
    item_name: {
      type: String,
      required: true,
      trim: true,
    },
    hindi_name: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // units_per_sheet: individual units packed per sheet (e.g. 10 or 12 packets per sheet)
    units_per_sheet: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    // quantity_per_unit: weight/volume per individual packet in grams (printed on label)
    quantity_per_unit: {
      type: Number,
      min: 0,
      default: 0,
    },
    // mrp_per_unit: Maximum Retail Price printed on individual unit packet
    mrp_per_unit: {
      type: Number,
      min: 0,
      default: 0,
    },
    total_stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // reserved_stock: sheets currently loaded onto delivery boys but not yet sold.
    // available_stock (for admin UI) = total_stock - reserved_stock
    reserved_stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // wholesale_price_per_sheet: default selling price per sheet; pre-filled in delivery boy cart
    wholesale_price_per_sheet: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    low_stock_threshold: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    image_url: {
      type: String,
      trim: true,
      default: null,
    },
    // ingredients: comma-separated list printed on label (e.g. "Coriander, Salt, Chilli")
    ingredients: {
      type: String,
      trim: true,
      default: '',
    },
    // search_aliases: space/comma-separated alternate names for search (e.g. "methi, fenugreek seeds")
    search_aliases: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    variant_name: {
      type: String,
      trim: true,
      default: '',
    },
    in_stock: {
      type: Boolean,
      default: true,
    },
    sale_mode: {
      type: String,
      enum: ['sheet', 'packet'],
      default: 'sheet',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

export type InventoryDocument = InferSchemaType<typeof inventorySchema>;

export const InventoryModel = model('Inventory', inventorySchema);
