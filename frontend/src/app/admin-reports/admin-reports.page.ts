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
import { forkJoin } from 'rxjs';

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
  opening: number;
  sold: number;
  remaining: number;
}

interface MonthlySummary {
  month: number;
  year: number;
  totalRevenue: number;
  totalDiscount: number;
  totalExpenses: number;
  netProfit: number;
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

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.page.html',
  styleUrls: ['./admin-reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsPage implements OnInit {
  private http    = inject(HttpClient);
  private loading = inject(GlobalLoadingService);

  activeTab  = signal<'eod' | 'monthly' | 'staff'>('eod');
  eodView    = signal<'by-boy' | 'by-product'>('by-boy');

  eodByBoy     = signal<EodByBoy[]>([]);
  eodByProduct = signal<EodByProduct[]>([]);
  monthlySummary = signal<MonthlySummary>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    totalRevenue: 0, totalDiscount: 0, totalExpenses: 0, netProfit: 0,
  });
  staffMonthly = signal<StaffRow[]>([]);
  selectedMonth = signal(this.currentMonthKey());

  selectedMonthLabel = computed(() => {
    const [year, month] = this.selectedMonth().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  });

  ngOnInit(): void { this.loadAll(); }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private split(key: string): { year: number; month: number } {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  }

  loadAll(): void {
    this.loading.show();
    const { year, month } = this.split(this.selectedMonth());
    forkJoin({
      eodBoy:     this.http.get<EodByBoy[]>('/admin/reports/eod'),
      eodProduct: this.http.get<EodByProduct[]>('/admin/reports/eod-by-product'),
      monthly:    this.http.get<MonthlySummary>(`/admin/reports/monthly?month=${month}&year=${year}`),
      staff:      this.http.get<{ staff: StaffRow[] }>(`/admin/reports/staff-monthly?month=${month}&year=${year}`),
    }).subscribe({
      next: ({ eodBoy, eodProduct, monthly, staff }) => {
        this.eodByBoy.set(eodBoy);
        this.eodByProduct.set(eodProduct);
        this.monthlySummary.set(monthly);
        this.staffMonthly.set(staff.staff);
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
      monthly: this.http.get<MonthlySummary>(`/admin/reports/monthly?month=${month}&year=${year}`),
      staff:   this.http.get<{ staff: StaffRow[] }>(`/admin/reports/staff-monthly?month=${month}&year=${year}`),
    }).subscribe({
      next: ({ monthly, staff }) => { this.monthlySummary.set(monthly); this.staffMonthly.set(staff.staff); },
      error: (err) => console.error('Monthly refresh failed:', err),
      complete: () => this.loading.hide(),
    });
  }

  setTab(tab: 'eod' | 'monthly' | 'staff'): void { this.activeTab.set(tab); }

  exportCSV(): void {
    if (this.eodView() === 'by-boy') {
      const rows = this.eodByBoy().map(s =>
        `${s.delivery_boy_name},${s.openingStock},${s.sold},${s.remaining},${s.cashCollected}`);
      const csv = ['Name,Opening,Sold,Remaining,Cash', ...rows].join('\n');
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'EOD_By_Boy.csv');
    } else {
      const rows = this.eodByProduct().map(s =>
        `${s.item_name},${s.hindi_name},${s.opening},${s.sold},${s.remaining}`);
      const csv = ['Item,HindiName,Opening,Sold,Remaining', ...rows].join('\n');
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'EOD_By_Product.csv');
    }
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
        <div class="card"><div class="label">Discounts</div><div class="value">₹${(summary.totalDiscount ?? 0).toFixed(0)}</div></div>
        <div class="card"><div class="label">Expenses</div><div class="value">₹${summary.totalExpenses.toFixed(0)}</div></div>
        <div class="card"><div class="label">Net Profit</div><div class="value">₹${summary.netProfit.toFixed(0)}</div></div>
      </div>
      <table><thead><tr>
        <th>Boy Name</th><th class="tr">Sheets Sold</th>
        <th class="tr">Sales</th><th class="tr">Net Cash</th><th>Status</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),250);};<\/script>
      </body></html>`);
    w.document.close();
  }
}
