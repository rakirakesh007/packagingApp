export interface Expense {
  _id: string;
  category: string;
  amount: number;
  description?: string;
  date?: Date;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface ExpenseSummary {
  grandTotal: number;
  byCategory: CategoryTotal[];
}
