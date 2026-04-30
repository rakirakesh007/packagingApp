import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  category: 'Fuel' | 'Raw Material' | 'Wage' | 'Misc';
  amount: number;
  description: string;
  date: Date;
}

const ExpenseSchema: Schema = new Schema({
  category: { type: String, enum: ['Fuel', 'Raw Material', 'Wage', 'Misc'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: false },
  date: { type: Date, default: Date.now },
});

export default mongoose.model<IExpense>('Expense', ExpenseSchema);