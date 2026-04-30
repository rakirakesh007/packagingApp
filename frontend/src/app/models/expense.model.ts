export interface Expense {
  _id: string;
  category: string;
  amount: number;
  description?: string;
  date?: Date;
}
