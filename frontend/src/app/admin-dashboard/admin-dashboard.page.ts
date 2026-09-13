import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SheetQtyPipe } from '../core/sheet-qty.pipe';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface WeekTotals {
  totalRevenue: number;
  totalSales: number;
  totalProfit: number;
  cashCollected: number;
}

interface WeekStats extends WeekTotals {
  activeBoys: number;
  topItems: { item_id: string; item_name: string; hindi_name: string; sheets_sold: number; units_per_sheet: number; revenue: number }[];
  lastWeek: WeekTotals;
}

/** A delivery boy's current state, regardless of whether anything happened
 *  today — see GET /admin/reports/boys-snapshot. */
interface BoySnapshot {
  delivery_boy_id: string;
  delivery_boy_name: string;
  sheetsHeld: number;
  sheetsSoldThisWeek: number;
  cashCollectedThisWeek: number;
}

interface LowStockItem {
  id: string;
  item_name: string;
  hindi_name?: string;
  total_stock: number;
  low_stock_threshold: number;
}

interface ItemSold {
  item_id: string;
  item_name: string;
  hindi_name: string;
  units_per_sheet: number;
  mrp_per_unit: number;
  sheets_sold: number;
  revenue: number;
  profit: number;
}

/** All-time snapshot — GET /admin/reports/overall. */
interface OverallStats {
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  overheadExpenses: number;
  stockPurchased: number;
  netProfit: number;
  totalSheets: number;
  salesCount: number;
  firstSaleDate: string | null;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SheetQtyPipe],
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage implements OnInit {
  private http    = inject(HttpClient);
  private loading = inject(GlobalLoadingService);

  private readonly defaultWeek: WeekStats = {
    totalRevenue: 0, totalSales: 0, totalProfit: 0, cashCollected: 0, activeBoys: 0, topItems: [],
    lastWeek: { totalRevenue: 0, totalSales: 0, totalProfit: 0, cashCollected: 0 },
  };
  private readonly defaultOverall: OverallStats = {
    totalRevenue: 0, totalProfit: 0, totalExpenses: 0, overheadExpenses: 0,
    stockPurchased: 0, netProfit: 0, totalSheets: 0, salesCount: 0, firstSaleDate: null,
  };

  weekStats    = signal<WeekStats>(this.defaultWeek);
  overall      = signal<OverallStats>(this.defaultOverall);
  boysSnapshot = signal<BoySnapshot[]>([]);
  lowStock     = signal<LowStockItem[]>([]);
  monthItems   = signal<ItemSold[]>([]);

  todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  /**
   * % change vs the same metric last week (rolling 7-day windows, not
   * calendar weeks), for KPI-card context. Returns null when both windows
   * are 0 — showing "+0%" there would be noise, not a signal.
   */
  vsLastWeek(thisWeek: number, lastWeek: number): { pct: number; up: boolean } | null {
    if (lastWeek === 0) return thisWeek === 0 ? null : { pct: 100, up: true };
    const pct = ((thisWeek - lastWeek) / Math.abs(lastWeek)) * 100;
    return { pct: Math.round(Math.abs(pct)), up: pct >= 0 };
  }

  /** Widest bar in Best-Selling This Week, for proportional bar widths. */
  topItemMax(): number {
    return Math.max(1, ...this.weekStats().topItems.map((i) => i.sheets_sold));
  }

  sinceLabel(): string {
    const d = this.overall().firstSaleDate;
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  ngOnInit(): void { this.loadDashboard(); }

  loadDashboard(): void {
    this.loading.show();
    forkJoin({
      week:      this.http.get<WeekStats>('/admin/reports/this-week').pipe(catchError(() => of(this.defaultWeek))),
      overall:   this.http.get<OverallStats>('/admin/reports/overall').pipe(catchError(() => of(this.defaultOverall))),
      boys:      this.http.get<BoySnapshot[]>('/admin/reports/boys-snapshot').pipe(catchError(() => of([] as BoySnapshot[]))),
      inventory: this.http.get<LowStockItem[]>('/inventory').pipe(catchError(() => of([] as LowStockItem[]))),
      itemSales: this.http.get<ItemSold[]>('/admin/reports/item-sales').pipe(catchError(() => of([] as ItemSold[]))),
    }).subscribe({
      next: ({ week, overall, boys, inventory, itemSales }) => {
        this.weekStats.set(week);
        this.overall.set(overall);
        this.boysSnapshot.set(boys);
        this.monthItems.set(itemSales);
        // Computed but not rendered — see the @if(false ...) in the template.
        // total_stock isn't being kept current (no real purchase/restock
        // tracking yet, confirmed with the owner 2026-09-07), so this fired on
        // almost the whole catalog and was pure noise, not a useful alert.
        // Re-enable once stock is actually maintained.
        this.lowStock.set(
          inventory.filter(i => i.total_stock <= i.low_stock_threshold)
        );
      },
      error: (err) => console.error('Dashboard load failed:', err),
      complete: () => this.loading.hide(),
    });
  }

}
