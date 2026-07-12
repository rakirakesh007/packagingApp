import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Expense, ExpenseSummary } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);

  /** List expenses, optionally scoped to a calendar month (month: 1-12). */
  getExpenses(month?: number, year?: number) {
    const q = month && year ? `?month=${month}&year=${year}` : '';
    return this.http.get<Expense[]>(`/expenses${q}`);
  }

  /** All-time totals grouped by category (+ grand total). */
  getSummary() {
    return this.http.get<ExpenseSummary>('/expenses/summary');
  }

  addExpense(data: { category: string; amount: number; description?: string; date?: string }) {
    return this.http.post<Expense>('/expenses', data);
  }

  updateExpense(id: string, data: { category: string; amount: number; description?: string; date?: string }) {
    return this.http.put<Expense>(`/expenses/${id}`, data);
  }

  deleteExpense(id: string) {
    return this.http.delete(`/expenses/${id}`);
  }
}