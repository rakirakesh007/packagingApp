import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';

interface SaleRowControls {
  shopName: FormControl<string>;
  item: FormControl<string>;
  quantity: FormControl<number>;
  price: FormControl<number>;
  purchasePrice: FormControl<number>;
}

@Component({
  selector: 'app-admin-bulk-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-bulk-entry.component.html',
  styleUrls: ['./admin-bulk-entry.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBulkEntryComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private http = inject(HttpClient);
  private loading = inject(GlobalLoadingService);
  private destroyRef = inject(DestroyRef);

  bulkEntryForm = this.fb.group({
    rows: this.fb.array<FormGroup<SaleRowControls>>([this.createRow()]),
  });

  get rows(): FormArray<FormGroup<SaleRowControls>> {
    return this.bulkEntryForm.get('rows') as FormArray<FormGroup<SaleRowControls>>;
  }

  /** Live summary signals — recomputed when signal sources change. */
  private _formVersion = signal(0);

  grandTotal = computed(() => {
    void this._formVersion(); // track changes
    return this.rows.controls.reduce((total, row) => {
      const { quantity = 0, price = 0 } = row.value;
      return total + quantity * price;
    }, 0);
  });

  totalProfit = computed(() => {
    void this._formVersion();
    return this.rows.controls.reduce((profit, row) => {
      const { quantity = 0, price = 0, purchasePrice = 0 } = row.value;
      return profit + quantity * (price - purchasePrice);
    }, 0);
  });

  submitSuccess = signal(false);

  ngOnInit(): void {
    // Attach Enter-key listener without a memory leak (DestroyRef cleans up).
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Enter') {
          this.handleEnterKey();
        }
      });

    // Invalidate computed summaries whenever the form value changes.
    this.bulkEntryForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._formVersion.update((v) => v + 1));
  }

  createRow(): FormGroup<SaleRowControls> {
    return this.fb.group({
      shopName: this.fb.control('', Validators.required),
      item: this.fb.control('', Validators.required),
      quantity: this.fb.control(0, [Validators.required, Validators.min(1)]),
      price: this.fb.control(0, [Validators.required, Validators.min(0)]),
      purchasePrice: this.fb.control(0, [Validators.required, Validators.min(0)]),
    });
  }

  addRow(): void {
    this.rows.push(this.createRow());
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
    }
  }

  private handleEnterKey(): void {
    const last = this.rows.at(this.rows.length - 1);
    if (last.valid) {
      this.addRow();
      // Auto-focus the first input of the new row.
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.bulk-row input');
        const lastRowInputs = Array.from(inputs).slice(-5);
        lastRowInputs[0]?.focus();
      }, 0);
    }
  }

  submitBulkEntry(): void {
    if (this.bulkEntryForm.invalid) return;
    const payload = this.rows.controls.map((row) => row.getRawValue());
    this.loading.show();
    this.http.post('/sale/bulk', payload).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.loading.hide();
        this.bulkEntryForm.reset();
        this.rows.clear();
        this.rows.push(this.createRow());
      },
      error: (err) => {
        console.error('Bulk entry failed:', err);
        this.loading.hide();
      },
    });
  }

  trackByIndex(index: number): number {
    return index;
  }
}
