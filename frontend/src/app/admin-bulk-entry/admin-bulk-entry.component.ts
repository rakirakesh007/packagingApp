import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';
import { InventoryService } from '../services/inventory.service';
import { InventoryItem } from '../models/inventory.model';

interface SaleRowControls {
  shopName:       FormControl<string>;
  shopMobile:     FormControl<string>;
  itemId:         FormControl<string>;
  itemSearch:     FormControl<string>;
  itemHindiName:  FormControl<string>;
  sheets_sold:    FormControl<number>;
  discount_amount: FormControl<number>;
  wholesale_price_per_sheet: FormControl<number>;
  production_cost_per_sheet: FormControl<number>;
}

@Component({
  selector: 'app-admin-bulk-entry',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './admin-bulk-entry.component.html',
  styleUrls: ['./admin-bulk-entry.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBulkEntryComponent implements OnInit {
  private fb             = inject(NonNullableFormBuilder);
  private http           = inject(HttpClient);
  private loading        = inject(GlobalLoadingService);
  private inventorySvc   = inject(InventoryService);
  private destroyRef     = inject(DestroyRef);

  // Full inventory list (loaded once)
  inventoryItems = signal<InventoryItem[]>([]);

  // Per-row filtered options — array index matches rows.controls index
  filteredOptions = signal<InventoryItem[][]>([]);

  bulkEntryForm = this.fb.group({
    rows: this.fb.array<FormGroup<SaleRowControls>>([this.createRow()]),
  });

  get rows(): FormArray<FormGroup<SaleRowControls>> {
    return this.bulkEntryForm.get('rows') as FormArray<FormGroup<SaleRowControls>>;
  }

  // Live totals (updated via form.valueChanges — avoids computed()+FormArray mismatch)
  grandTotal   = signal(0);
  totalProfit  = signal(0);
  submitSuccess = signal(false);

  ngOnInit(): void {
    // Load inventory once
    this.inventorySvc.getItems().subscribe({
      next: (items) => {
        this.inventoryItems.set(items);
        // Initialise filteredOptions for the first row
        this.filteredOptions.set([items]);
      },
    });

    // Recompute totals on every value change
    this.bulkEntryForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcTotals());
  }

  createRow(): FormGroup<SaleRowControls> {
    return this.fb.group({
      shopName:       this.fb.control('', Validators.required),
      shopMobile:     this.fb.control(''),
      itemId:         this.fb.control('', Validators.required),
      itemSearch:     this.fb.control('', Validators.required),
      itemHindiName:  this.fb.control(''),
      sheets_sold:    this.fb.control(0, [Validators.required, Validators.min(1)]),
      discount_amount: this.fb.control(0, [Validators.min(0)]),
      wholesale_price_per_sheet: this.fb.control(0),
      production_cost_per_sheet: this.fb.control(0),
    });
  }

  addRow(): void {
    this.rows.push(this.createRow());
    // Add empty filter list for new row
    this.filteredOptions.update((opts) => [...opts, this.inventoryItems()]);
    // Auto-focus shopName of the new row
    setTimeout(() => {
      const shopInputs = document.querySelectorAll<HTMLInputElement>('.shop-name-input');
      shopInputs[shopInputs.length - 1]?.focus();
    }, 0);
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
      this.filteredOptions.update((opts) => opts.filter((_, i) => i !== index));
    }
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────
  filterItems(query: string, rowIndex: number): void {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? this.inventoryItems().filter((i) =>
          i.item_name.toLowerCase().includes(q) || (i.hindi_name ?? '').toLowerCase().includes(q)
        )
      : this.inventoryItems();
    this.filteredOptions.update((opts) =>
      opts.map((o, i) => (i === rowIndex ? filtered : o))
    );
    // Clear the hidden itemId if the user is typing (not yet selected)
    this.rows.at(rowIndex).get('itemId')?.setValue('');
  }

  selectItem(item: InventoryItem, rowIndex: number): void {
    const row = this.rows.at(rowIndex);
    row.patchValue({
      itemId:    item.id,
      itemSearch: item.hindi_name || item.item_name,
      itemHindiName: item.hindi_name ?? '',
      wholesale_price_per_sheet: item.wholesale_price_per_sheet ?? 0,
      production_cost_per_sheet: item.production_cost_per_sheet ?? 0,
    });
  }

  displayFn(item: InventoryItem | string): string {
    return typeof item === 'string' ? item : item?.hindi_name || item?.item_name || '';
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  private recalcTotals(): void {
    let total = 0, profit = 0;
    for (const row of this.rows.controls) {
      const { sheets_sold = 0, discount_amount = 0, wholesale_price_per_sheet = 0, production_cost_per_sheet = 0 } = row.value;
      const finalPerSheet = Math.max(0, (wholesale_price_per_sheet ?? 0) - (discount_amount ?? 0));
      total  += (sheets_sold ?? 0) * finalPerSheet;
      profit += (sheets_sold ?? 0) * (finalPerSheet - (production_cost_per_sheet ?? 0));
    }
    this.grandTotal.set(total);
    this.totalProfit.set(profit);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submitBulkEntry(): void {
    if (this.bulkEntryForm.invalid) return;
    const payload = this.rows.controls.map((row) => {
      const v = row.getRawValue();
      return {
        shopName:      v.shopName,
        shopMobile:    v.shopMobile || '',
        item:          v.itemId,
        itemName:      v.itemSearch,
        hindiName:     v.itemHindiName,
        sheets_sold:   v.sheets_sold,
        discount_amount: v.discount_amount,
      };
    });
    this.loading.show();
    this.http.post('/sale/bulk', payload).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.loading.hide();
        this.bulkEntryForm.reset();
        this.rows.clear();
        this.rows.push(this.createRow());
        this.filteredOptions.set([this.inventoryItems()]);
        this.recalcTotals();
        setTimeout(() => this.submitSuccess.set(false), 4000);
      },
      error: (err) => { console.error('Bulk entry failed:', err); this.loading.hide(); },
    });
  }

  trackByIndex(index: number): number { return index; }
}
