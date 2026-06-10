import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { ToastService } from '../services/toast.service';
import { Expense } from '../models/expense.model';

const EXPENSE_CATEGORIES = [
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

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expense.page.html',
  styleUrls: ['./expense.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensePage implements OnInit {
  private expenseService = inject(ExpenseService);
  private loading = inject(GlobalLoadingService);
  private toast = inject(ToastService);
  private fb = inject(NonNullableFormBuilder);

  readonly categories = EXPENSE_CATEGORIES;
  expenses = signal<Expense[]>([]);

  expenseForm = this.fb.group({
    category: this.fb.control<ExpenseCategory>('Fuel', Validators.required),
    amount: this.fb.control(0, [Validators.required, Validators.min(1)]),
    description: this.fb.control(''),
  });

  ngOnInit(): void {
    this.loadExpenses();
  }

  private loadExpenses(): void {
    this.loading.show();
    this.expenseService.getExpenses().subscribe({
      next: (data) => this.expenses.set(data),
      error: (err) => console.error('Failed to load expenses:', err),
      complete: () => this.loading.hide(),
    });
  }

  addExpense(): void {
    if (this.expenseForm.invalid) return;
    const { category, amount, description } = this.expenseForm.getRawValue();
    this.loading.show();
    this.expenseService
      .addExpense({ category, amount, description: description || undefined })
      .subscribe({
        next: () => {
          this.toast.success('Expense added.');
          this.expenseForm.reset({ category: 'Fuel', amount: 0, description: '' });
          this.loadExpenses();
        },
        error: (err) => {
          console.error('Failed to add expense:', err);
          this.toast.error('Could not add expense. Please try again.');
          this.loading.hide();
        },
      });
  }

  deleteExpense(id: string): void {
    if (!confirm('Delete this expense?')) return;
    this.loading.show();
    this.expenseService.deleteExpense(id).subscribe({
      next: () => {
        this.toast.success('Expense deleted.');
        this.loadExpenses();
      },
      error: (err) => {
        console.error('Failed to delete expense:', err);
        this.toast.error('Could not delete expense. Please try again.');
        this.loading.hide();
      },
    });
  }
}
