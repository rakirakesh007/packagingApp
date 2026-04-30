import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Expense } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);

  getExpenses() {
    return this.http.get<Expense[]>('/expenses');
  }

  addExpense(data: { category: string; amount: number; description?: string; date?: Date }) {
    return this.http.post<Expense>('/expenses', data);
  }

  deleteExpense(id: string) {
    return this.http.delete(`/expenses/${id}`);
  }
}