import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';

// Fixing type issues for eodSummary
interface EodSummary {
  delivery_boy_id: string;
  openingStock: number;
  sold: number;
  remaining: number;
  cashCollected: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private http = inject(HttpClient);

  eodSummary = signal<EodSummary[]>([]);
  monthlySummary = signal({ totalSales: 0, totalExpenses: 0, netProfit: 0 });

  constructor() {
    this.fetchEodSummary();
    this.fetchMonthlySummary();
  }

  fetchEodSummary() {
    this.http.get<EodSummary[]>('/admin/reports/eod').subscribe({
      next: (data) => this.eodSummary.set(data),
      error: (err) => console.error('Failed to fetch EOD summary:', err),
    });
  }

  fetchMonthlySummary() {
    this.http.get<any>('/admin/reports/monthly').subscribe({
      next: (data) => this.monthlySummary.set(data),
      error: (err) => console.error('Failed to fetch monthly summary:', err),
    });
  }

  exportToCSV() {
    const data = this.eodSummary().map((summary) => ({
      DeliveryBoy: summary.delivery_boy_id,
      OpeningStock: summary.openingStock,
      Sold: summary.sold,
      Remaining: summary.remaining,
      CashCollected: summary.cashCollected,
    }));

    const csvContent = [
      'DeliveryBoy,OpeningStock,Sold,Remaining,CashCollected',
      ...data.map((row) =>
        `${row.DeliveryBoy},${row.OpeningStock},${row.Sold},${row.Remaining},${row.CashCollected}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'EOD_Report.csv');
  }
}