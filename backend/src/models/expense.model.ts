import { InferSchemaType, Schema, model } from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Fuel',
  'Raw Material',
  'Transport',
  'Packaging',
  'Maintenance',
  'Salary',
  'Utilities',
  'Miscellaneous',
  'Other',
] as const;

const expenseSchema = new Schema(
  {
    date:        { type: Date, required: true, default: () => new Date(), index: true },
    category:    { type: String, required: true, enum: EXPENSE_CATEGORIES, trim: true },
    amount:      { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
  },
  { versionKey: false, timestamps: true }
);

export type ExpenseDocument = InferSchemaType<typeof expenseSchema>;
export const ExpenseModel = model('Expense', expenseSchema);
