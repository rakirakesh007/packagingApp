import { InferSchemaType, Schema, model } from 'mongoose';

const inventorySchema = new Schema(
  {
    item_name: {
      type: String,
      required: true,
      trim: true,
    },
    total_stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },
    purchase_price: {
      type: Number,
      required: true,
      min: 0,
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
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

export type InventoryDocument = InferSchemaType<typeof inventorySchema>;

export const InventoryModel = model('Inventory', inventorySchema);
