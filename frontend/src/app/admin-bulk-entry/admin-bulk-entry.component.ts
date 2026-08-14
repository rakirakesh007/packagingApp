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

export type SaleType = 'wholesale' | 'retail';

interface SaleRowControls {
  shopName:                  FormControl<string>;
  shopMobile:                FormControl<string>;
  itemId:                    FormControl<string>;
  itemSearch:                FormControl<string>;
  itemHindiName:             FormControl<string>;
  /** 'wholesale' = sell by sheet | 'retail' = sell individual packets */
  sale_type:                 FormControl<SaleType>;
  /** Sheets (wholesale) or packets (retail) — as entered by admin */
  quantity_sold:             FormControl<number>;
  /** Editable negotiated price: per sheet (wholesale) or per packet (retail) */
  selling_price:             FormControl<number>;
  wholesale_price_per_sheet: FormControl<number>;
  /** Individual packets packed per sheet for this item */
  units_per_sheet:           FormControl<number>;
  /** MRP printed on individual packet — default retail price */
  mrp_per_unit:              FormControl<number>;
}

/** Partial mirror of SaleRowControls values for calculation helpers */
type RowValue = Partial<{
  sale_type:                 SaleType;
  quantity_sold:             number;
  selling_price:             number;
  wholesale_price_per_sheet: number;
  units_per_sheet:           number;
  mrp_per_unit:              number;
}>;

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

  grandTotal    = signal(0);
  totalProfit   = signal(0);
  submitSuccess = signal(false);
  errorMsg      = signal('');

  ngOnInit(): void {
    this.inventorySvc.getItems().subscribe({
      next: (items) => {
        this.inventoryItems.set(items);
        this.filteredOptions.set([items]);
      },
    });
    this.bulkEntryForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcTotals());
  }

  createRow(): FormGroup<SaleRowControls> {
    return this.fb.group({
      shopName:                  this.fb.control('', Validators.required),
      shopMobile:                this.fb.control(''),
      itemId:                    this.fb.control('', Validators.required),
      itemSearch:                this.fb.control('', Validators.required),
      itemHindiName:             this.fb.control(''),
      sale_type:                 this.fb.control<SaleType>('wholesale'),
      quantity_sold:             this.fb.control(0, [Validators.required, Validators.min(1)]),
      selling_price:             this.fb.control(0, [Validators.min(0)]),
      wholesale_price_per_sheet: this.fb.control(0),
      units_per_sheet:           this.fb.control(10),
      mrp_per_unit:              this.fb.control(0),
    });
  }

  addRow(): void {
    this.rows.push(this.createRow());
    this.filteredOptions.update((opts) => [...opts, this.inventoryItems()]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.shop-name-input');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
      this.filteredOptions.update((opts) => opts.filter((_, i) => i !== index));
    }
  }

  /**
   * Switch sale type and reset selling price to that type's default.
   * wholesale_price_per_sheet holds the per-packet wholesale, so a sheet's price = it × units_per_sheet.
   * wholesale → wholesale_price_per_sheet × units_per_sheet | retail → mrp_per_unit
   */
  setType(rowIndex: number, type: SaleType): void {
    const row = this.rows.at(rowIndex);
    const v = row.getRawValue();
    const defaultPrice = type === 'retail'
      ? (v.mrp_per_unit ?? 0)
      : Math.round((v.wholesale_price_per_sheet ?? 0) * (v.units_per_sheet ?? 1));
    row.patchValue({ sale_type: type, selling_price: defaultPrice });
    this.recalcTotals();
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
    this.rows.at(rowIndex).get('itemId')?.setValue('');
  }

  selectItem(item: InventoryItem, rowIndex: number): void {
    const row = this.rows.at(rowIndex);
    const mrp = item.mrp_per_unit ?? 0;
    const wholesalePerPkt = item.wholesale_price_per_sheet ?? 0; // field holds per-packet wholesale
    const units = item.units_per_sheet ?? 10;
    const isRetail = row.getRawValue().sale_type === 'retail';

    row.patchValue({
      itemId:                    item.id,
      itemSearch:                item.hindi_name || item.item_name,
      itemHindiName:             item.hindi_name ?? '',
      wholesale_price_per_sheet: wholesalePerPkt,
      units_per_sheet:           units,
      mrp_per_unit:              mrp,
      // Default selling price = wholesale × units (sheet) or MRP (packet); admin can override.
      selling_price:             isRetail ? mrp : wholesalePerPkt * units,
    });
  }

  displayFn(item: InventoryItem | string): string {
    return typeof item === 'string' ? item : item?.hindi_name || item?.item_name || '';
  }

  // ── Row calculation helpers (called from template) ────────────────────────
  rowSubtotal(i: number): number {
    return this.calcSubtotal(this.rows.at(i).value);
  }

  rowProfit(i: number): number {
    return this.calcProfit(this.rows.at(i).value);
  }

  private calcSubtotal(v: RowValue): number {
    const qty   = v.quantity_sold ?? 0;
    const price = Math.max(0, v.selling_price ?? 0);
    // Price is per sheet (wholesale) or per packet (retail); qty matches.
    return price * qty;
  }

  private calcProfit(v: RowValue): number {
    const qty           = v.quantity_sold ?? 0;
    const price         = Math.max(0, v.selling_price ?? 0);
    const wholesalePerPkt = v.wholesale_price_per_sheet ?? 0; // field holds per-packet wholesale

    if (v.sale_type === 'retail') {
      // Retail: profit per packet = selling price (per packet) − wholesale cost per packet.
      return (price - wholesalePerPkt) * qty;
    }
    // Wholesale: 10% of per-sheet wholesale cost (wholesale_price_per_sheet × units_per_sheet).
    return wholesalePerPkt * (v.units_per_sheet ?? 1) * 0.10 * qty;
  }

  // ── Grand totals ──────────────────────────────────────────────────────────
  private recalcTotals(): void {
    let total = 0, profit = 0;
    for (const row of this.rows.controls) {
      total  += this.calcSubtotal(row.value);
      profit += this.calcProfit(row.value);
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
        shopName:        v.shopName,
        shopMobile:      v.shopMobile || '',
        item:            v.itemId,
        itemName:        v.itemSearch,
        hindiName:       v.itemHindiName,
        sale_type:       v.sale_type,
        unit_type:       v.sale_type === 'retail' ? 'packet' : 'sheet',
        quantity_sold:   v.quantity_sold,
        selling_price:   v.selling_price,
      };
    });
    this.loading.show();
    this.errorMsg.set('');
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
      error: (err) => {
        const msg = err?.error?.message || 'Submission failed. Please try again.';
        this.errorMsg.set(msg);
        this.loading.hide();
      },
    });
  }

  trackByIndex(index: number): number { return index; }
}
