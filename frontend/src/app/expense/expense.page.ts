import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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
import { Expense, ExpenseSummary, CategoryTotal } from '../models/expense.model';

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

/** Today as a yyyy-MM-dd string for <input type="date">. */
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

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

  // Selected month — table is scoped to this calendar month (resets fresh each month).
  selMonth = signal(new Date().getMonth() + 1); // 1-12
  selYear  = signal(new Date().getFullYear());

  /** True when viewing the current calendar month (hides the "next" affordance edge cases). */
  isCurrentMonth = computed(() => {
    const now = new Date();
    return this.selMonth() === now.getMonth() + 1 && this.selYear() === now.getFullYear();
  });

  monthLabel = computed(() =>
    new Date(this.selYear(), this.selMonth() - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })
  );

  /** yyyy-MM string for the <input type="month"> control. */
  monthValue = computed(
    () => `${this.selYear()}-${String(this.selMonth()).padStart(2, '0')}`
  );

  total = computed(() => this.expenses().reduce((sum, e) => sum + (e.amount ?? 0), 0));

  /** Selected month's expenses grouped by category, largest first. */
  monthByCategory = computed<CategoryTotal[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of this.expenses()) {
      const c = map.get(e.category) ?? { total: 0, count: 0 };
      c.total += e.amount ?? 0;
      c.count += 1;
      map.set(e.category, c);
    }
    return [...map.entries()]
      .map(([category, v]) => ({ category, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);
  });

  /** All-time totals by category (loaded from the backend summary endpoint). */
  summary = signal<ExpenseSummary | null>(null);

  editingId = signal<string | null>(null);

  expenseForm = this.fb.group({
    category: this.fb.control<ExpenseCategory>('Fuel', Validators.required),
    amount: this.fb.control(0, [Validators.required, Validators.min(1)]),
    description: this.fb.control(''),
    date: this.fb.control(todayISO(), Validators.required),
  });

  ngOnInit(): void {
    this.loadExpenses();
    this.loadSummary();
  }

  private loadExpenses(): void {
    this.loading.show();
    this.expenseService.getExpenses(this.selMonth(), this.selYear()).subscribe({
      next: (data) => this.expenses.set(data),
      error: (err) => console.error('Failed to load expenses:', err),
      complete: () => this.loading.hide(),
    });
  }

  /** Refresh the all-time by-category summary (after any add/edit/delete). */
  private loadSummary(): void {
    this.expenseService.getSummary().subscribe({
      next: (data) => this.summary.set(data),
      error: (err) => console.error('Failed to load expense summary:', err),
    });
  }

  /** Step the selected month by ±1 and reload. */
  changeMonth(delta: number): void {
    const d = new Date(this.selYear(), this.selMonth() - 1 + delta, 1);
    this.selMonth.set(d.getMonth() + 1);
    this.selYear.set(d.getFullYear());
    this.cancelEdit();
    this.loadExpenses();
  }

  /** Handle the month picker (value is yyyy-MM). */
  onMonthChange(value: string): void {
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return;
    this.selYear.set(y);
    this.selMonth.set(m);
    this.cancelEdit();
    this.loadExpenses();
  }

  saveExpense(): void {
    if (this.expenseForm.invalid) return;
    const { category, amount, description, date } = this.expenseForm.getRawValue();
    const payload = { category, amount, description: description || undefined, date };
    const id = this.editingId();

    this.loading.show();
    const request = id
      ? this.expenseService.updateExpense(id, payload)
      : this.expenseService.addExpense(payload);

    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Expense updated.' : 'Expense added.');
        this.cancelEdit();
        this.loadExpenses();
        this.loadSummary();
      },
      error: (err) => {
        console.error('Failed to save expense:', err);
        this.toast.error('Could not save expense. Please try again.');
        this.loading.hide();
      },
    });
  }

  startEdit(expense: Expense): void {
    this.editingId.set(expense._id);
    this.expenseForm.setValue({
      category: (expense.category as ExpenseCategory) ?? 'Fuel',
      amount: expense.amount,
      description: expense.description ?? '',
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : todayISO(),
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.expenseForm.reset({ category: 'Fuel', amount: 0, description: '', date: todayISO() });
  }

  deleteExpense(id: string): void {
    if (!confirm('Delete this expense?')) return;
    this.loading.show();
    this.expenseService.deleteExpense(id).subscribe({
      next: () => {
        this.toast.success('Expense deleted.');
        if (this.editingId() === id) this.cancelEdit();
        this.loadExpenses();
        this.loadSummary();
      },
      error: (err) => {
        console.error('Failed to delete expense:', err);
        this.toast.error('Could not delete expense. Please try again.');
        this.loading.hide();
      },
    });
  }
}
