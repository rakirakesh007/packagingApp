import { InferSchemaType, Schema, Types, model } from 'mongoose';

const loadingItemSchema = new Schema(
  {
    item_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Inventory',
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  },
);

const loadingSchema = new Schema(
  {
    delivery_boy_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    items: {
      type: [loadingItemSchema],
      required: true,
      validate: {
        validator: (value: Types.DocumentArray<InferSchemaType<typeof loadingItemSchema>>) => value.length > 0,
        message: 'Loading assignment must include at least one item.',
      },
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

export type LoadingDocument = InferSchemaType<typeof loadingSchema>;
export type LoadingItemDocument = InferSchemaType<typeof loadingItemSchema>;

export const LoadingModel = model('Loading', loadingSchema);
