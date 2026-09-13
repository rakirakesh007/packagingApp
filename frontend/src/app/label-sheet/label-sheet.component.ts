import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { InventoryService } from '../services/inventory.service';
import { InventoryItem } from '../models/inventory.model';
import { LABEL_COLS, LabelSize, sheetCapacity } from './label-capacity.util';

/**
 * One cell of the printed grid.
 *  - 'item'        a real label
 *  - 'placeholder' the grey "Sample Product" demo card (shown when no ids are given)
 *  - 'blank'       an intentionally empty cell
 *
 * 'blank' is load-bearing, not cosmetic: in print the grid is `height: 100vh` with
 * `grid-auto-rows: 1fr`, so rows stretch to fill the page. Rendering fewer cards
 * would make each row taller and the labels would no longer line up with the
 * pre-cut stickers. Every sheet therefore always renders exactly `capacity` cells,
 * padding with blanks — which also leaves those stickers clean for a later pass.
 */
type LabelCell =
  | { kind: 'item'; item: InventoryItem }
  | { kind: 'placeholder' }
  | { kind: 'blank' };

/** A run of consecutive labels for one item, e.g. 7 x Garam Masala. */
interface LabelRun {
  item: InventoryItem;
  count: number;
}

@Component({
  selector: 'app-label-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './label-sheet.component.html',
  styleUrls: ['./label-sheet.component.scss'],
})
export class LabelSheetComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);

  items = signal<InventoryItem[]>([]);
  totalLabels = signal(0);
  labelSize = signal<LabelSize>('normal');
  hasIngredients = computed(() => this.items().some(i => !!i.ingredients));
  logoDataUrl = signal<string | null>(null);
  vegDataUrl = signal<string | null>(null);

  /**
   * Mixed-sheet mode: explicit per-item counts, packed tight in this order.
   * Empty in legacy mode, where `items` is simply repeated to fill the sheet.
   */
  runs = signal<LabelRun[]>([]);
  /** Stickers to skip at the start, for re-feeding a part-used sheet. */
  startAt = signal(0);

  labels = computed<LabelCell[]>(() => {
    const total = this.totalLabels();
    if (total <= 0) return [];

    const runList = this.runs();
    const itemList = this.items();
    const blank = (): LabelCell => ({ kind: 'blank' });

    // ── Mixed mode: skip offset, lay runs down back to back, pad with blanks ──
    if (runList.length > 0) {
      const cells: LabelCell[] = [];
      const skip = Math.min(this.startAt(), total);
      for (let i = 0; i < skip; i += 1) cells.push(blank());
      for (const run of runList) {
        for (let i = 0; i < run.count && cells.length < total; i += 1) {
          cells.push({ kind: 'item', item: run.item });
        }
      }
      while (cells.length < total) cells.push(blank());
      return cells;
    }

    // ── Legacy mode: no ids -> demo placeholders; ids -> repeat to fill ──
    if (itemList.length === 0) {
      return Array.from({ length: total }, (): LabelCell => ({ kind: 'placeholder' }));
    }
    return Array.from({ length: total }, (_, i): LabelCell => ({
      kind: 'item',
      item: itemList[i % itemList.length],
    }));
  });

  pkdMonthYear = computed(() => {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const date = new Date();
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${year}`;
  });

  batchNumber = computed(() => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `DMH-${day}${month}${year}`;
  });

  readonly labelSheetConfig = {
    fssaiNo: '20426141000161',
  };

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const isBig = params['size'] === 'big';
      const size: LabelSize = isBig ? 'big' : 'normal';
      this.labelSize.set(size);
      this.startAt.set(Math.max(0, parseInt(params['start'], 10) || 0));

      // Mixed mode: `items=<id>:<count>,<id>:<count>` (order is preserved).
      // Legacy mode: `itemIds=<id>,<id>` — unchanged, still fills the whole sheet.
      const mixed = this.parseItemsParam(params['items']);
      const legacyIds: string[] = params['itemIds'] ? String(params['itemIds']).split(',') : [];
      const wantedIds = mixed.length > 0 ? mixed.map(m => m.id) : legacyIds;

      const cols = LABEL_COLS[size];
      const total = params['total'] ? parseInt(params['total'], 10) : 35;
      const paddedTotal = Math.ceil(Math.max(total, cols) / cols) * cols;

      if (wantedIds.length === 0) {
        this.totalLabels.set(paddedTotal);
        this.loadImages();
        return;
      }

      // One request for the whole catalog, then filter locally. The old
      // getItemsByIds() fired one request per id through forkJoin, so a single
      // deleted/404 id blanked the entire sheet; this skips it instead.
      this.inventoryService.getItems().subscribe({
        next: (all) => {
          const byId = new Map(all.map(i => [i.id, i]));
          const found = wantedIds.map(id => byId.get(id)).filter((i): i is InventoryItem => !!i);
          this.items.set(found);

          if (mixed.length > 0) {
            this.runs.set(
              mixed
                .map(m => ({ item: byId.get(m.id), count: m.count }))
                .filter((r): r is LabelRun => !!r.item && r.count > 0),
            );
          }

          this.totalLabels.set(sheetCapacity(size, found.some(i => !!i.ingredients)));
        },
        error: (err) => {
          console.error('Failed to fetch items:', err);
          this.totalLabels.set(paddedTotal);
        },
      });

      // Load logo and veg images
      this.loadImages();
    });
  }

  /** Parse `id:count,id:count`. Ignores malformed or non-positive entries. */
  private parseItemsParam(raw: unknown): Array<{ id: string; count: number }> {
    if (!raw) return [];
    return String(raw)
      .split(',')
      .map((chunk) => {
        const [id, rawCount] = chunk.split(':');
        return { id: (id ?? '').trim(), count: parseInt(rawCount, 10) || 0 };
      })
      .filter(entry => entry.id.length > 0 && entry.count > 0);
  }

  private loadImages(): void {
    const logoImg = new Image();
    logoImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.width;
      canvas.height = logoImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(logoImg, 0, 0);
        this.logoDataUrl.set(canvas.toDataURL('image/png'));
      }
    };
    logoImg.onerror = () => {
      console.warn('Failed to load logo image');
      this.logoDataUrl.set(null);
    };
    logoImg.src = 'assets/color-logo.png';

    const vegImg = new Image();
    vegImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = vegImg.width;
      canvas.height = vegImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vegImg, 0, 0);
        this.vegDataUrl.set(canvas.toDataURL('image/png'));
      }
    };
    vegImg.onerror = () => {
      console.warn('Failed to load veg icon image');
      this.vegDataUrl.set(null);
    };
    vegImg.src = 'assets/veg-icon.png';
  }

  formatPkdMonthYear(date: Date): string {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month}-${year}`;
  }
}
