import { InferSchemaType, Schema, model } from 'mongoose';

const expenseCategoryValues = [
  'Fuel',
  'Raw Material',
  'Transport',
  'Packaging',
  'Maintenance',
  'Salary',
  'Utilities',
  'Other',
] as const;

const expenseSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: expenseCategoryValues,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

export type ExpenseDocument = InferSchemaType<typeof expenseSchema>;

export const ExpenseModel = model('Expense', expenseSchema);
