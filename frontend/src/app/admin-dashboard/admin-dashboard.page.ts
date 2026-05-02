import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';
import { saveAs } from 'file-saver';

interface EodSummary {
  delivery_boy_id: string;
  openingStock: number;
  sold: number;
  remaining: number;
  cashCollected: number;
}

interface MonthlySummary {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage implements OnInit {
  private http = inject(HttpClient);
  private loading = inject(GlobalLoadingService);

  eodSummary = signal<EodSummary[]>([]);
  monthlySummary = signal<MonthlySummary>({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  ngOnInit(): void {
    this.fetchEodSummary();
    this.fetchMonthlySummary();
  }

  private fetchEodSummary(): void {
    this.loading.show();
    this.http.get<EodSummary[]>('/admin/reports/eod').subscribe({
      next: (data) => this.eodSummary.set(data),
      error: (err) => console.error('Failed to fetch EOD summary:', err),
      complete: () => this.loading.hide(),
    });
  }

  private fetchMonthlySummary(): void {
    this.http.get<MonthlySummary>('/admin/reports/monthly').subscribe({
      next: (data) => this.monthlySummary.set(data),
      error: (err) => console.error('Failed to fetch monthly summary:', err),
    });
  }

  exportToCSV(): void {
    const rows = this.eodSummary().map((s) =>
      `${s.delivery_boy_id},${s.openingStock},${s.sold},${s.remaining},${s.cashCollected}`
    );
    const csv = [
      'DeliveryBoy,OpeningStock,Sold,Remaining,CashCollected',
      ...rows,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'EOD_Report.csv');
  }
}
