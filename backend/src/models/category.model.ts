import { InferSchemaType, Schema, model } from 'mongoose';

const categorySchema = new Schema(
  {
    name:       { type: String, required: true, unique: true, trim: true },
    hindi_name: { type: String, trim: true, default: '' },
  },
  { versionKey: false, timestamps: true }
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;
export const CategoryModel = model('Category', categorySchema);
