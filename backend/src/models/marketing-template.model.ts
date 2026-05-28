import { InferSchemaType, Schema, model } from 'mongoose';

const marketingTemplateSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['follow_up', 'offer', 'festival', 'payment', 'general'],
      default: 'general',
      trim: true,
    },
    body: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { versionKey: false, timestamps: true }
);

export type MarketingTemplateDocument = InferSchemaType<typeof marketingTemplateSchema>;
export const MarketingTemplateModel = model('MarketingTemplate', marketingTemplateSchema);
