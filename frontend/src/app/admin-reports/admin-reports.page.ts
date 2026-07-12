import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';
import { saveAs } from 'file-saver';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SheetQtyPipe } from '../core/sheet-qty.pipe';

interface EodByBoy {
  delivery_boy_id: string;
  delivery_boy_name: string;
  openingStock: number;
  sold: number;
  remaining: number;
  cashCollected: number;
}

interface EodByProduct {
  item_id: string;
  item_name: string;
  hindi_name: string;
  units_per_sheet: number;
  wholesale_price_per_sheet?: number;
  opening: number;
  sold: number;
  remaining: number;
}

interface DailySale {
  day: number;
  revenue: number;
}

interface MonthlySummary {
  month: number;
  year: number;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  overheadExpenses?: number;
  stockPurchased?: number;
  netProfit: number;
  expenseByCategory?: { category: string; amount: number }[];
}

interface ItemSaleRow {
  item_id: string;
  item_name: string;
  hindi_name: string;
  sheets_sold: number;
  revenue: number;
  profit: number;
  units_per_sheet: number;
  mrp_per_unit: number;
}

interface OverallSummary {
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  overheadExpenses?: number;
  stockPurchased?: number;
  netProfit: number;
  totalSheets: number;
  salesCount: number;
  firstSaleDate: string | null;
}

interface StaffRow {
  deliveryBoyId: string;
  boyName: string;
  totalSheets: number;
  totalSales: number;
  totalCashCollected: number;
  netCash: number;
  paymentStatus: string;
}

interface PayoutRow {
  date: string;
  delivery_boy_id: string;
  delivery_boy_name: string;
  sheets5: number;
  sheets10: number;
  packets: number;
  payout: number;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, SheetQtyPipe],
  templateUrl: './admin-reports.page.html',
  styleUrls: ['./admin-reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsPage implements OnInit {
  private http    = inject(HttpClient);
  private loading = inject(GlobalLoadingService);

  activeTab  = signal<'eod' | 'monthly' | 'staff' | 'payout'>('eod');

  eodByBoy     = signal<EodByBoy[]>([]);
  eodByProduct = signal<EodByProduct[]>([]);
  dailySales   = signal<DailySale[]>([]);
  monthlySummary = signal<MonthlySummary>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    totalRevenue: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0,
  });
  staffMonthly = signal<StaffRow[]>([]);
  payoutRows   = signal<PayoutRow[]>([]);
  itemSales    = signal<ItemSaleRow[]>([]);
  overall      = signal<OverallSummary | null>(null);
  selectedMonth = signal(this.currentMonthKey());

  payoutTotals = computed(() => this.payoutRows().reduce(
    (acc, r) => ({
      sheets5: acc.sheets5 + r.sheets5,
      sheets10: acc.sheets10 + r.sheets10,
      packets: acc.packets + (r.packets ?? 0),
      payout: acc.payout + r.payout,
    }),
    { sheets5: 0, sheets10: 0, packets: 0, payout: 0 },
  ));

  selectedMonthLabel = computed(() => {
    const [year, month] = this.selectedMonth().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  });

  maxDailyRevenue = computed(() => Math.max(...this.dailySales().map(d => d.revenue), 1));

  ngOnInit(): void { this.loadAll(); }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private split(key: string): { year: number; month: number } {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  }

  /** Fallback so one failed API doesn't blank every tab (each request catches its own error). */
  private emptyMonthly(): MonthlySummary {
    const { year, month } = this.split(this.selectedMonth());
    return { month, year, totalRevenue: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, expenseByCategory: [] };
  }

  loadAll(): void {
    this.loading.show();
    const { year, month } = this.split(this.selectedMonth());
    forkJoin({
      eodBoy:     this.http.get<EodByBoy[]>('/admin/reports/eod').pipe(catchError(() => of([] as EodByBoy[]))),
      eodProduct: this.http.get<EodByProduct[]>('/admin/reports/eod-by-product').pipe(catchError(() => of([] as EodByProduct[]))),
      monthly:    this.http.get<MonthlySummary>(`/admin/reports/monthly?month=${month}&year=${year}`).pipe(catchError(() => of(this.emptyMonthly()))),
      staff:      this.http.get<{ staff: StaffRow[] }>(`/admin/reports/staff-monthly?month=${month}&year=${year}`).pipe(catchError(() => of({ staff: [] as StaffRow[] }))),
      daily:      this.http.get<DailySale[]>(`/admin/reports/daily-sales?month=${month}&year=${year}`).pipe(catchError(() => of([] as DailySale[]))),
      payout:     this.http.get<PayoutRow[]>(`/admin/reports/boy-payout?month=${month}&year=${year}`).pipe(catchError(() => of([] as PayoutRow[]))),
      itemSales:  this.http.get<ItemSaleRow[]>(`/admin/reports/item-sales?month=${month}&year=${year}`).pipe(catchError(() => of([] as ItemSaleRow[]))),
      overall:    this.http.get<OverallSummary>('/admin/reports/overall').pipe(catchError(() => of(null as OverallSummary | null))),
    }).subscribe({
      next: ({ eodBoy, eodProduct, monthly, staff, daily, payout, itemSales, overall }) => {
        this.eodByBoy.set(eodBoy);
        this.eodByProduct.set(eodProduct);
        this.monthlySummary.set(monthly);
        this.staffMonthly.set(staff.staff);
        this.dailySales.set(daily);
        this.payoutRows.set(payout);
        this.itemSales.set(itemSales);
        this.overall.set(overall);
      },
      error: (err) => console.error('Reports load failed:', err),
      complete: () => this.loading.hide(),
    });
  }

  onMonthChange(key: string): void {
    this.selectedMonth.set(key);
    this.loading.show();
    const { year, month } = this.split(key);
    forkJoin({
      monthly:   this.http.get<MonthlySummary>(`/admin/reports/monthly?month=${month}&year=${year}`).pipe(catchError(() => of(this.emptyMonthly()))),
      staff:     this.http.get<{ staff: StaffRow[] }>(`/admin/reports/staff-monthly?month=${month}&year=${year}`).pipe(catchError(() => of({ staff: [] as StaffRow[] }))),
      daily:     this.http.get<DailySale[]>(`/admin/reports/daily-sales?month=${month}&year=${year}`).pipe(catchError(() => of([] as DailySale[]))),
      payout:    this.http.get<PayoutRow[]>(`/admin/reports/boy-payout?month=${month}&year=${year}`).pipe(catchError(() => of([] as PayoutRow[]))),
      itemSales: this.http.get<ItemSaleRow[]>(`/admin/reports/item-sales?month=${month}&year=${year}`).pipe(catchError(() => of([] as ItemSaleRow[]))),
    }).subscribe({
      next: ({ monthly, staff, daily, payout, itemSales }) => {
        this.monthlySummary.set(monthly);
        this.staffMonthly.set(staff.staff);
        this.dailySales.set(daily);
        this.payoutRows.set(payout);
        this.itemSales.set(itemSales);
      },
      error: (err) => console.error('Monthly refresh failed:', err),
      complete: () => this.loading.hide(),
    });
  }

  setTab(tab: 'eod' | 'monthly' | 'staff' | 'payout'): void { this.activeTab.set(tab); }

  exportPayoutCSV(): void {
    const rows = this.payoutRows().map(r =>
      `${r.date},${r.delivery_boy_name},${r.sheets5},${r.sheets10},${r.packets},${r.payout}`);
    const t = this.payoutTotals();
    const csv = [
      'Date,Boy,₹5 Sheets,₹10 Sheets,50g Pkts,Payout',
      ...rows,
      `TOTAL,,${t.sheets5},${t.sheets10},${t.packets},${t.payout}`,
    ].join('\n');
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Boy_Payout.csv');
  }

  /** One CSV with both EOD sections (by boy, then by product). */
  exportCSV(): void {
    const boyRows = this.eodByBoy().map(s =>
      `${s.delivery_boy_name},${s.openingStock},${s.sold},${s.remaining},${s.cashCollected}`);
    const productRows = this.eodByProduct().map(s =>
      `${s.item_name},${s.hindi_name},${s.opening},${s.sold},${s.remaining}`);
    const csv = [
      'BY DELIVERY BOY',
      'Name,Opening,Sold,Remaining,Cash',
      ...boyRows,
      '',
      'BY PRODUCT',
      'Item,HindiName,Opening,Sold,Remaining',
      ...productRows,
    ].join('\n');
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'EOD_Report.csv');
  }

  downloadMonthlyPdf(): void {
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return;
    const label   = this.selectedMonthLabel();
    const summary = this.monthlySummary();
    const rows    = this.staffMonthly()
      .map(r => `<tr>
        <td>${r.boyName}</td>
        <td class="tr">${r.totalSheets}</td>
        <td class="tr">₹${r.totalSales.toFixed(0)}</td>
        <td class="tr">₹${r.netCash.toFixed(0)}</td>
        <td>${r.paymentStatus}</td>
      </tr>`).join('');

    w.document.write(`<html><head><title>Monthly Report — ${label}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1,h2{margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
      .card{border:1px solid #d1d5db;border-radius:12px;padding:14px}
      .label{color:#6b7280;font-size:12px;text-transform:uppercase}.value{font-size:22px;font-weight:700;margin-top:6px}
      table{width:100%;border-collapse:collapse;margin-top:18px}
      th,td{border:1px solid #d1d5db;padding:10px;font-size:12px}th{background:#f3f4f6}.tr{text-align:right}
      </style></head><body>
      <h1>DesiMasalaHub — Monthly Report</h1><h2>${label}</h2>
      <div class="grid">
        <div class="card"><div class="label">Revenue</div><div class="value">₹${summary.totalRevenue.toFixed(0)}</div></div>
        <div class="card"><div class="label">Gross Profit</div><div class="value">₹${(summary.totalProfit ?? 0).toFixed(0)}</div></div>
        <div class="card"><div class="label">Overhead</div><div class="value">₹${(summary.overheadExpenses ?? summary.totalExpenses).toFixed(0)}</div></div>
        <div class="card"><div class="label">Net Profit</div><div class="value">₹${summary.netProfit.toFixed(0)}</div></div>
      </div>
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px">Stock purchased (materials/packing/delivery — already inside cost per sheet, not counted in Net Profit): ₹${(summary.stockPurchased ?? 0).toFixed(0)}</p>
      <table><thead><tr>
        <th>Boy Name</th><th class="tr">Sheets Sold</th>
        <th class="tr">Sales</th><th class="tr">Net Cash</th><th>Status</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),250);};<\/script>
      </body></html>`);
    w.document.close();
  }
}
