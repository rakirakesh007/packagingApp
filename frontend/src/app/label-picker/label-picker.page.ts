import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InventoryService } from '../services/inventory.service';
import { InventoryItem } from '../models/inventory.model';
import { GlobalLoadingService } from '../services/global-loading.service';
import { LABEL_COLS, LabelSize, sheetCapacity } from '../label-sheet/label-capacity.util';

/**
 * Pick several items with a per-item label count and print them onto ONE sheet,
 * instead of burning a whole sheet per item.
 *
 * State is signals + a copy-on-write Map (same idiom as sales-cart.page.ts),
 * deliberately not a Reactive FormArray: this page is built around a live total,
 * and computed() cannot track a FormArray (see the note in assignment.page.ts).
 */
@Component({
  selector: 'app-label-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './label-picker.page.html',
  styleUrls: ['./label-picker.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelPickerPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private loading = inject(GlobalLoadingService);
  private router = inject(Router);

  items   = signal<InventoryItem[]>([]);
  /** itemId -> label count. Insertion order = print order. */
  counts  = signal<Map<string, number>>(new Map());
  size    = signal<LabelSize>('normal');
  /** Stickers already used on this sheet, to be skipped. */
  startAt = signal(0);
  search  = signal('');
  loadError = signal(false);

  visibleItems = computed(() => {
    const q = this.search().toLowerCase().trim();
    const all = this.items();
    if (!q) return all;
    return all.filter(i =>
      i.item_name.toLowerCase().includes(q) ||
      (i.hindi_name ?? '').toLowerCase().includes(q) ||
      (i.search_aliases ?? '').toLowerCase().includes(q),
    );
  });

  /** Chosen items, in the order they were first given a count. */
  selected = computed(() => {
    const byId = new Map(this.items().map(i => [i.id, i]));
    const out: Array<{ item: InventoryItem; count: number }> = [];
    this.counts().forEach((count, id) => {
      const item = byId.get(id);
      if (item && count > 0) out.push({ item, count });
    });
    return out;
  });

  totalSelected  = computed(() => this.selected().reduce((sum, s) => sum + s.count, 0));
  hasIngredients = computed(() => this.selected().some(s => !!s.item.ingredients));
  capacity       = computed(() => sheetCapacity(this.size(), this.hasIngredients()));
  /** Cells actually usable once the skipped stickers are excluded. */
  available      = computed(() => Math.max(0, this.capacity() - this.clampedStart()));
  clampedStart   = computed(() => Math.min(this.startAt(), this.capacity()));
  overflow       = computed(() => this.totalSelected() > this.available());
  canPrint       = computed(() => this.totalSelected() > 0 && !this.overflow());
  cols           = computed(() => LABEL_COLS[this.size()]);

  /**
   * One entry per sticker position, for the little preview grid:
   * 'skip' = already used, 'fill' = will be printed now, 'free' = left blank.
   */
  cellMap = computed<Array<'skip' | 'fill' | 'free'>>(() => {
    const cap = this.capacity();
    const skip = this.clampedStart();
    const fill = Math.min(this.totalSelected(), Math.max(0, cap - skip));
    return Array.from({ length: cap }, (_, i) =>
      i < skip ? 'skip' : i < skip + fill ? 'fill' : 'free',
    );
  });

  ngOnInit(): void {
    this.loading.show();
    this.inventoryService.getItems().subscribe({
      next: (items) => this.items.set(items),
      error: (err) => {
        console.error('Failed to load inventory for label picker:', err);
        this.loadError.set(true);
        this.loading.hide();
      },
      complete: () => this.loading.hide(),
    });
  }

  countFor(id: string): number {
    return this.counts().get(id) ?? 0;
  }

  setCount(id: string, raw: unknown): void {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    this.counts.update((m) => {
      const next = new Map(m);
      if (n > 0) next.set(id, n);
      else next.delete(id);   // dropping to 0 also drops it from the print order
      return next;
    });
  }

  bump(id: string, delta: number): void {
    this.setCount(id, this.countFor(id) + delta);
  }

  /** Top up the current selection to exactly fill the remaining stickers. */
  fillRemaining(id: string): void {
    const room = this.available() - this.totalSelected();
    if (room > 0) this.setCount(id, this.countFor(id) + room);
  }

  clearAll(): void {
    this.counts.set(new Map());
  }

  setSize(size: LabelSize): void {
    this.size.set(size);
  }

  setStartAt(raw: unknown): void {
    this.startAt.set(Math.max(0, Math.floor(Number(raw) || 0)));
  }

  print(): void {
    if (!this.canPrint()) return;
    const items = this.selected().map(s => `${s.item.id}:${s.count}`).join(',');
    this.router.navigate(['/label-sheet'], {
      queryParams: { items, size: this.size(), start: this.clampedStart() },
    });
  }
}
