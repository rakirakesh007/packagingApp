import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  FormArray,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { fromEvent } from 'rxjs';

interface InventoryRow {
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
export class AdminBulkEntryComponent {
  private fb = inject(NonNullableFormBuilder);

  bulkEntryForm = this.fb.group({
    rows: this.fb.array<FormGroup<InventoryRow>>([
      this.createRow(),
    ]),
  });

  get rows(): FormArray<FormGroup<InventoryRow>> {
    return this.bulkEntryForm.get('rows') as FormArray<FormGroup<InventoryRow>>;
  }

  grandTotal = computed(() =>
    this.rows.controls.reduce((total, row) => {
      const quantity = row.value.quantity || 0;
      const price = row.value.price || 0;
      return total + quantity * price;
    }, 0),
  );

  totalProfit = computed(() =>
    this.rows.controls.reduce((profit, row) => {
      const quantity = row.value.quantity || 0;
      const price = row.value.price || 0;
      const purchasePrice = row.value.purchasePrice || 0;
      return profit + quantity * (price - purchasePrice);
    }, 0),
  );

  constructor() {
    effect(() => {
      fromEvent<KeyboardEvent>(document, 'keydown').subscribe((event) => {
        if (event.key === 'Enter') {
          this.handleEnterKey();
        }
      });
    });
  }

  createRow(): FormGroup<InventoryRow> {
    return this.fb.group({
      shopName: this.fb.control('', Validators.required),
      item: this.fb.control('', Validators.required),
      quantity: this.fb.control(0, [Validators.required, Validators.min(1)]),
      price: this.fb.control(0, [Validators.required, Validators.min(0)]),
      purchasePrice: this.fb.control(0, [Validators.required, Validators.min(0)]),
    });
  }

  addRow() {
    this.rows.push(this.createRow());
  }

  handleEnterKey() {
    const lastRow = this.rows.at(this.rows.length - 1);
    if (lastRow.valid) {
      this.addRow();
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
