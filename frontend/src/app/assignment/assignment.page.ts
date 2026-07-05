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
  ReactiveFormsModule,
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AssignmentService, User, Holding } from '../services/assignment.service';
import { InventoryService } from '../services/inventory.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { ToastService } from '../services/toast.service';
import { InventoryItem } from '../models/inventory.model';
import { SheetQtyPipe } from '../core/sheet-qty.pipe';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SheetQtyPipe],
  templateUrl: './assignment.page.html',
  styleUrls: ['./assignment.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentPage implements OnInit {
  private fb                = inject(FormBuilder);
  private assignmentService = inject(AssignmentService);
  private inventoryService  = inject(InventoryService);
  private loading           = inject(GlobalLoadingService);
  private toast             = inject(ToastService);

  // ── Signals ───────────────────────────────────────────────────────────────
  deliveryBoys    = signal<User[]>([]);
  selectedBoyId   = signal('');
  selectedDate    = signal(todayISO());
  submitError     = signal('');
  submitSuccess   = signal(false);
  alreadyAssigned = signal(false);

  // ── Search ────────────────────────────────────────────────────────────────
  searchQuery = signal('');
  // rowNames is a Signal so computed() can track it when inventory reloads.
  private rowNames = signal<{ item_name: string; hindi_name: string; search_aliases: string; variant_name: string; sale_mode: string }[]>([]);

  filteredIndices = computed(() => {
    const q     = this.searchQuery().toLowerCase().trim();
    const names = this.rowNames();
    if (!q) return names.map((_, i) => i);
    return names
      .map((n, i) => ({ n, i }))
      .filter(({ n }) =>
        n.item_name.toLowerCase().includes(q) ||
        n.hindi_name.toLowerCase().includes(q) ||
        n.search_aliases.toLowerCase().includes(q) ||
        n.variant_name.toLowerCase().includes(q)
      )
      .map(({ i }) => i);
  });

  // ── Accordion grouping ────────────────────────────────────────────────────
  groupedRows = computed<{ name: string; hindi_name: string; indices: number[] }[]>(() => {
    const names = this.rowNames();
    const order = new Map<string, { name: string; hindi_name: string; indices: number[] }>();
    for (const i of this.filteredIndices()) {
      const n = names[i];
      if (!n) continue;
      const key = n.item_name.toLowerCase().trim();
      if (!order.has(key)) {
        order.set(key, { name: n.item_name, hindi_name: n.hindi_name, indices: [] });
      }
      order.get(key)!.indices.push(i);
    }
    return [...order.values()];
  });

  expandedGroups = signal<Set<string>>(new Set());

  toggleGroup(name: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  isExpanded(name: string): boolean {
    return this.expandedGroups().has(name);
  }

  // ── Current Load (running balance) ─────────────────────────────────────────
  holdings  = signal<Holding[]>([]);
  returnQty = signal<Map<string, number>>(new Map());

  selectedBoyName = (): string =>
    this.deliveryBoys().find((b) => b._id === this.selectedBoyId())?.name ?? '';

  // ── Form ──────────────────────────────────────────────────────────────────
  form = this.fb.group({ rows: this.fb.array<FormGroup>([]) });

  get rows(): FormArray<FormGroup> {
    return this.form.get('rows') as FormArray<FormGroup>;
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  // NOTE: computed() cannot track FormArray changes — use a writable signal
  // updated via form.valueChanges instead.
  totalItemsAssigned = signal(0);
  nonZeroCount       = signal(0);

  private recalcTotals(): void {
    const vals: number[] = this.rows.controls.map(
      (r) => Number(r.get('assignedQty')?.value) || 0
    );
    this.totalItemsAssigned.set(vals.reduce((a, b) => a + b, 0));
    this.nonZeroCount.set(vals.filter((v) => v > 0).length);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.assignmentService.getDeliveryBoys().subscribe({
      next: (boys) => this.deliveryBoys.set(boys),
      error: (err)  => console.error('Delivery boys fetch failed:', err),
    });
    this.loadInventory();
    // Keep totalItemsAssigned & nonZeroCount in sync with form
    this.form.valueChanges.subscribe(() => this.recalcTotals());
  }

  private loadInventory(): void {
    this.loading.show();
    this.inventoryService.getItems().subscribe({
      next: (items) => this.buildRows(items),
      error: (err)  => { console.error('Inventory fetch failed:', err); this.loading.hide(); },
      complete: ()  => this.loading.hide(),
    });
  }

  private buildRows(items: InventoryItem[]): void {
    this.rows.clear();
    for (const item of items) {
      // Informational reference only — assignment is not capped by stock.
      // Floor to whole sheets: retail sales can leave fractional stock; assignment is always whole sheets.
      const inStock = Math.floor(Math.max(0, item.total_stock));
      this.rows.push(this.fb.group({
        item_id:         [item.id],
        item_name:       [item.item_name],
        hindi_name:      [item.hindi_name ?? ''],
        variant_name:    [item.variant_name ?? ''],
        sale_mode:       [item.sale_mode ?? 'sheet'],
        mrp_per_unit:    [item.mrp_per_unit ?? 0],
        wholesale_price_per_sheet: [item.wholesale_price_per_sheet ?? 0],
        units_per_sheet: [item.units_per_sheet ?? 12],
        warehouse_stock: [inStock],
        assignedQty: [0, [Validators.min(0)]],
      }));
    }
    // Set rowNames after FormArray is fully populated so filteredIndices is always in sync.
    this.rowNames.set(items.map(i => ({ item_name: i.item_name, hindi_name: i.hindi_name ?? '', search_aliases: i.search_aliases ?? '', variant_name: i.variant_name ?? '', sale_mode: i.sale_mode ?? 'sheet' })));
    this.recalcTotals();
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  onBoyChange(id: string): void {
    this.selectedBoyId.set(id);
    this.submitError.set('');
    this.submitSuccess.set(false);
    this.alreadyAssigned.set(false);
    this.loadHoldings();
  }

  private loadHoldings(): void {
    const id = this.selectedBoyId();
    if (!id) { this.holdings.set([]); return; }
    this.assignmentService.getHoldings(id).subscribe({
      next: (data) => this.holdings.set(data),
      error: (err) => console.error('Holdings fetch failed:', err),
    });
  }

  getReturnQty(itemId: string): number {
    return this.returnQty().get(itemId) ?? 0;
  }

  setReturnQty(itemId: string, qty: number): void {
    this.returnQty.update((m) => {
      const next = new Map(m);
      next.set(itemId, Math.max(0, qty));
      return next;
    });
  }

  incrementReturnQty(itemId: string, max: number): void {
    const cur = this.getReturnQty(itemId);
    if (cur < max) this.setReturnQty(itemId, cur + 1);
  }

  decrementReturnQty(itemId: string): void {
    const cur = this.getReturnQty(itemId);
    if (cur > 0) this.setReturnQty(itemId, cur - 1);
  }

  recordReturn(h: Holding, qty: number): void {
    const amount = Math.min(Math.max(0, qty), h.withBoy);
    if (amount <= 0) return;
    this.loading.show();
    this.assignmentService.returnItems(this.selectedBoyId(), [{ item_id: h.item_id, qty: amount }]).subscribe({
      next: (updated) => {
        this.holdings.set(updated);
        this.setReturnQty(h.item_id, 0);
        this.toast.success('Return recorded.');
        this.loading.hide();
      },
      error: (err) => {
        this.loading.hide();
        this.toast.error(err?.error?.message ?? 'Could not record return.');
      },
    });
  }

  returnAll(h: Holding): void {
    this.recordReturn(h, h.withBoy);
  }

  onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.submitError.set('');
    this.submitSuccess.set(false);
    this.alreadyAssigned.set(false);
  }

  onEnter(event: Event, index: number): void {
    event.preventDefault();
    const inputs = document.querySelectorAll<HTMLInputElement>('.qty-input');
    const next = inputs[index + 1];
    if (next) { next.focus(); next.select(); }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  confirmAssignment(): void {
    this.submitError.set('');
    this.submitSuccess.set(false);
    this.alreadyAssigned.set(false);

    if (!this.selectedBoyId()) {
      this.submitError.set('Please select a delivery boy.');
      return;
    }
    if (this.form.invalid) {
      this.submitError.set('Please enter valid quantities.');
      return;
    }

    const items = (this.rows.value as {
      item_id: string; item_name: string; hindi_name: string; variant_name: string; wholesale_price_per_sheet: number; warehouse_stock: number; assignedQty: number;
    }[])
      .filter((r) => Number(r.assignedQty) > 0)
      .map((r) => ({ item_id: r.item_id, qty: Number(r.assignedQty), item_name: r.item_name, hindi_name: r.hindi_name, variant_name: r.variant_name, wholesale_price_per_sheet: r.wholesale_price_per_sheet }));

    if (items.length === 0) {
      this.submitError.set('Please assign at least one item.');
      return;
    }

    this.loading.show();
    this.assignmentService
      .createAssignment({ delivery_boy_id: this.selectedBoyId(), items, date: this.selectedDate() })
      .subscribe({
        next: () => {
          this.submitSuccess.set(true);
          this.loading.hide();
          // Reset entered quantities. Assignment does not change warehouse stock.
          this.rows.controls.forEach((row) => row.patchValue({ assignedQty: 0 }));
          // Keep the boy selected and refresh the Current Load panel.
          this.loadHoldings();
        },
        error: (err) => {
          this.loading.hide();
          this.submitError.set(err.error?.message ?? 'Assignment failed. Please try again.');
        },
      });
  }
}
