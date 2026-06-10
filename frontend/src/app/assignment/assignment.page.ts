import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { AssignmentService, User } from '../services/assignment.service';
import { InventoryService } from '../services/inventory.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { InventoryItem } from '../models/inventory.model';
import { getPricingRule } from '../core/pricing.config';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assignment.page.html',
  styleUrls: ['./assignment.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentPage implements OnInit {
  private fb                = inject(FormBuilder);
  private assignmentService = inject(AssignmentService);
  private inventoryService  = inject(InventoryService);
  private loading           = inject(GlobalLoadingService);

  // ── Signals ───────────────────────────────────────────────────────────────
  deliveryBoys    = signal<User[]>([]);
  selectedBoyId   = signal('');
  selectedDate    = signal(todayISO());
  submitError     = signal('');
  submitSuccess   = signal(false);
  alreadyAssigned = signal(false);

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
      // Get correct wholesale price from pricing config based on MRP
      const rule = getPricingRule(item.mrp_per_unit || 0);
      const correctWholesalePrice = rule?.wholesalePricePerSheet ?? item.wholesale_price_per_sheet ?? 0;

      this.rows.push(this.fb.group({
        item_id:         [item.id],
        item_name:       [item.item_name],
        hindi_name:      [item.hindi_name ?? ''],
        mrp_per_unit:    [item.mrp_per_unit ?? 0],
        wholesale_price_per_sheet: [correctWholesalePrice],
        warehouse_stock: [item.total_stock],
        assignedQty: [0, [Validators.min(0), Validators.max(item.total_stock)]],
      }));
    }
    this.recalcTotals();
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  onBoyChange(id: string): void {
    this.selectedBoyId.set(id);
    this.submitError.set('');
    this.submitSuccess.set(false);
    this.alreadyAssigned.set(false);
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
      this.submitError.set('Some quantities exceed available warehouse stock.');
      return;
    }

    const items = (this.rows.value as {
      item_id: string; item_name: string; hindi_name: string; wholesale_price_per_sheet: number; warehouse_stock: number; assignedQty: number;
    }[])
      .filter((r) => Number(r.assignedQty) > 0)
      .map((r) => ({ item_id: r.item_id, qty: Number(r.assignedQty), item_name: r.item_name, hindi_name: r.hindi_name, wholesale_price_per_sheet: r.wholesale_price_per_sheet }));

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
          // Update warehouse stock in form, reset qty after additive assignment
          this.rows.controls.forEach((row) => {
            const assigned = Number(row.get('assignedQty')?.value) || 0;
            const current  = Number(row.get('warehouse_stock')?.value) || 0;
            const newStock = current - assigned;
            row.patchValue({ assignedQty: 0, warehouse_stock: newStock });
            row.get('assignedQty')?.setValidators([Validators.min(0), Validators.max(newStock)]);
            row.get('assignedQty')?.updateValueAndValidity();
          });
          this.selectedBoyId.set('');
        },
        error: (err) => {
          this.loading.hide();
          this.submitError.set(err.error?.message ?? 'Assignment failed. Please try again.');
        },
      });
  }
}
