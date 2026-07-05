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

interface TodayStats {
  totalRevenue: number;
  totalSales: number;
  totalProfit: number;
  cashCollected: number;
  activeBoys: number;
  topItems: { item_id: string; item_name: string; hindi_name: string; sheets_sold: number; units_per_sheet: number; revenue: number }[];
}

interface EodBoy {
  delivery_boy_id: string;
  delivery_boy_name: string;
  openingStock: number;
  sold: number;
  remaining: number;
  cashCollected: number;
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

  todayStats   = signal<TodayStats>({
    totalRevenue: 0, totalSales: 0, totalProfit: 0, cashCollected: 0, activeBoys: 0, topItems: [],
  });
  eodSummary   = signal<EodBoy[]>([]);
  lowStock     = signal<LowStockItem[]>([]);
  monthItems   = signal<ItemSold[]>([]);

  todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  ngOnInit(): void { this.loadDashboard(); }

  loadDashboard(): void {
    this.loading.show();
    const defaultToday: TodayStats = { totalRevenue: 0, totalSales: 0, totalProfit: 0, cashCollected: 0, activeBoys: 0, topItems: [] };
    forkJoin({
      today:     this.http.get<TodayStats>('/admin/reports/today').pipe(catchError(() => of(defaultToday))),
      eod:       this.http.get<EodBoy[]>('/admin/reports/eod').pipe(catchError(() => of([] as EodBoy[]))),
      inventory: this.http.get<LowStockItem[]>('/inventory').pipe(catchError(() => of([] as LowStockItem[]))),
      itemSales: this.http.get<ItemSold[]>('/admin/reports/item-sales').pipe(catchError(() => of([] as ItemSold[]))),
    }).subscribe({
      next: ({ today, eod, inventory, itemSales }) => {
        this.todayStats.set(today);
        this.eodSummary.set(eod);
        this.monthItems.set(itemSales);
        this.lowStock.set(
          inventory.filter(i => i.total_stock <= i.low_stock_threshold)
        );
      },
      error: (err) => console.error('Dashboard load failed:', err),
      complete: () => this.loading.hide(),
    });
  }

}
