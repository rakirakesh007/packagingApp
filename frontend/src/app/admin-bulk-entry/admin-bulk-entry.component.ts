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
  // ── Pack override (distributor deals) ────────────────────────────────────
  // Grams actually packed for THIS sale, and the cost that follows. Defaults to
  // the item's standard values, so an untouched row behaves exactly as before.
  /** Grams per pouch for this sale (item's standard weight unless changed) */
  grams_per_unit:            FormControl<number>;
  /** ₹ per kg of raw material (typed when the item has none stored) */
  rate_per_kg:               FormControl<number>;
  /** Cost ₹/sheet INCLUDING packing. Auto-derived, but directly editable. */
  cost_per_sheet:            FormControl<number>;
}

/** Partial mirror of SaleRowControls values for calculation helpers */
type RowValue = Partial<{
  itemId:                    string;
  sale_type:                 SaleType;
  quantity_sold:             number;
  selling_price:             number;
  wholesale_price_per_sheet: number;
  units_per_sheet:           number;
  mrp_per_unit:              number;
  grams_per_unit:            number;
  rate_per_kg:               number;
  cost_per_sheet:            number;
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
      grams_per_unit:            this.fb.control(0),
      rate_per_kg:               this.fb.control(0),
      cost_per_sheet:            this.fb.control(0),
    });
  }

  // ── Pack override panel ───────────────────────────────────────────────────
  /** Rows whose pack panel is open. Same Set-signal idiom used across this app. */
  expandedPackRows = signal<Set<number>>(new Set());

  isPackOpen(i: number): boolean {
    return this.expandedPackRows().has(i);
  }

  togglePack(i: number): void {
    this.expandedPackRows.update((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  /** True when this row's pack differs from the item's standard weight. */
  isCustomPack(i: number): boolean {
    const v = this.rows.at(i).value;
    const item = this.inventoryItems().find((x) => x.id === v.itemId);
    if (!item) return false;
    const grams = Number(v.grams_per_unit) || 0;
    return grams > 0 && grams !== (item.quantity_per_unit ?? 0);
  }

  /**
   * Recompute this row's cost from grams × rate, mirroring the backend's
   * computePackCost() exactly (utils/pack-cost.util.ts):
   *   grams × rate/kg × units ÷ 1000 × 1.02 + labour + packing + delivery
   *
   * The result INCLUDES packing — never add packing on top of it again.
   * Leaves the cost untouched when grams or rate is missing, so the typed value
   * (the escape hatch for items with no stored packing) survives.
   */
  recomputeRowCost(i: number): void {
    const row = this.rows.at(i);
    const v = row.getRawValue();
    const item = this.inventoryItems().find((x) => x.id === v.itemId);
    const grams = Number(v.grams_per_unit) || 0;
    const rate = Number(v.rate_per_kg) || 0;
    const units = Math.max(1, Number(v.units_per_sheet) || 1);
    if (grams <= 0 || rate <= 0) return;

    const material = (grams * rate * units) / 1000 * 1.02;
    const extras =
      (item?.labour_cost_per_sheet ?? 0) +
      (item?.packing_cost_per_sheet ?? 0) +
      (item?.delivery_cost_per_sheet ?? 0);
    row.patchValue({ cost_per_sheet: Math.round((material + extras) * 100) / 100 });
    this.recalcTotals();
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
      // Pack defaults = the item's standard spec. Untouched ⇒ identical to before.
      grams_per_unit:            item.quantity_per_unit ?? 0,
      rate_per_kg:               item.rate_per_kg ?? 0,
      // Seed the cost ONLY for items priced by cost. Seeding it on a flat-profit
      // item would make the cost branch win over flat and silently change its
      // profit — no live item has both today, but don't depend on that.
      cost_per_sheet:            (item.flat_profit_per_pouch ?? 0) > 0 ? 0 : (item.cost_per_sheet ?? 0),
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

  /**
   * Mirrors backend `computeProfit()` (utils/profit.util.ts) EXACTLY, so the
   * live preview shown while entering a row matches what gets saved on submit.
   *
   * BUG FIXED (2026-09-07): this used to always apply the legacy 10%-of-wholesale
   * (wholesale) / selling-minus-wholesale (retail) formula, ignoring cost_per_sheet
   * and flat_profit_per_pouch entirely — those fields were never even loaded into
   * this page. Verified against live data: all 46 in-stock items showed a wrong
   * profit preview, understating real profit by up to ~3x (e.g. Chilli Powder ₹10:
   * screen showed ₹85, backend actually saved ₹272.20 for the same row).
   *
   * Precedence, per item — same as the backend:
   *   0. row cost override > 0     → final_price − override × sheets  (pack panel)
   *   1. flat_profit_per_pouch > 0 → flat × units_per_sheet × sheets
   *   2. cost_per_sheet > 0        → final_price − cost_per_sheet × sheets
   *   3. uncosted wholesale        → 10% of per-sheet wholesale × sheets (legacy)
   *   3. uncosted retail           → (selling_per_unit − wholesale_per_pkt) × packets (legacy)
   */
  private calcProfit(v: RowValue): number {
    const qty             = v.quantity_sold ?? 0;
    const price            = Math.max(0, v.selling_price ?? 0);
    const units             = v.units_per_sheet ?? 1;
    const wholesalePerPkt = v.wholesale_price_per_sheet ?? 0; // field holds per-packet wholesale
    const item              = this.inventoryItems().find((i) => i.id === v.itemId);
    const flat              = item?.flat_profit_per_pouch ?? 0;
    // Row cost wins over the item's stored cost — the pack panel seeds it from the
    // item, so an untouched row produces exactly the same number as before.
    const rowCost           = Number(v.cost_per_sheet) || 0;
    const cost              = rowCost > 0 ? rowCost : (item?.cost_per_sheet ?? 0);

    if (v.sale_type === 'retail') {
      const packets   = qty;
      const sheets    = packets / Math.max(1, units); // fractional, matches backend
      const finalPrice = price * packets;
      if (rowCost > 0) return finalPrice - rowCost * sheets;   // 0. pack override
      const hasRealCost = flat > 0 || cost > 0;
      if (!hasRealCost) return (price - wholesalePerPkt) * packets; // legacy retail fallback
      if (flat > 0) return flat * units * sheets;
      return finalPrice - cost * sheets;
    }

    // Wholesale
    const sheets     = qty;
    const finalPrice = price * sheets;
    // 0. Pack override beats flat-profit — a flat ₹/pouch figure is for the item's
    //    standard weight and is meaningless once the pack size changes.
    if (rowCost > 0) return finalPrice - rowCost * sheets;
    if (flat > 0) return flat * units * sheets;
    if (cost > 0) return finalPrice - cost * sheets;
    return wholesalePerPkt * units * 0.10 * sheets; // legacy fallback (uncosted item)
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
        // Pack spec. The backend recomputes/validates; these are its inputs, and
        // get snapshotted onto the sale so the cost basis is auditable later.
        grams_per_unit:  v.grams_per_unit,
        rate_per_kg:     v.rate_per_kg,
        cost_per_sheet:  v.cost_per_sheet,
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
