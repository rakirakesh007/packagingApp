import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { Expense } from '../models/expense.model';

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-4">
      <h2 class="text-xl font-bold mb-4">Expenses</h2>
      <form [formGroup]="expenseForm" (ngSubmit)="addExpense()" class="mb-4">
        <input formControlName="category" placeholder="Category" class="border p-2 mr-2" />
        <input formControlName="amount" type="number" placeholder="Amount" class="border p-2 mr-2" />
        <input formControlName="description" placeholder="Description" class="border p-2 mr-2" />
        <button type="submit" class="bg-blue-500 text-white px-4 py-2">Add</button>
      </form>
      <ul>
        <li *ngFor="let expense of expenses()" class="flex justify-between border-b py-2">
          <span>{{ expense.category }} - ₹{{ expense.amount }}</span>
          <button (click)="confirmDelete(expense._id)" class="text-red-500">Delete</button>
        </li>
      </ul>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensePage {
  private expenseService = inject(ExpenseService);
  private fb = inject(FormBuilder);

  expenses = signal<Expense[]>([]);

  expenseForm = this.fb.group({
    category: ['', Validators.required],
    amount: [0, Validators.required],
    description: [''],
  });

  constructor() {
    this.loadExpenses();
  }

  loadExpenses() {
    this.expenseService.getExpenses().subscribe({
      next: (data) => this.expenses.set(data),
      error: (err) => console.error('Failed to load expenses:', err),
    });
  }

  addExpense() {
    if (this.expenseForm.invalid) return;
    const val = this.expenseForm.value;
    this.expenseService.addExpense({
      category: val.category!,
      amount: val.amount!,
      description: val.description ?? undefined,
    }).subscribe({
      next: () => {
        this.expenseForm.reset();
        this.loadExpenses();
      },
      error: (err) => console.error('Failed to add expense:', err),
    });
  }

  confirmDelete(expenseId: string) {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.expenseService.deleteExpense(expenseId).subscribe({
        next: () => {
          alert('Expense deleted successfully!');
          this.loadExpenses();
        },
        error: (err) => console.error('Failed to delete expense:', err),
      });
    }
  }
}