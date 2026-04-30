import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { globalLoading } from '../services/global-loading.service';

@Component({
  selector: 'app-eod-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './eod-report.component.html',
  styleUrls: ['./eod-report.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodReportComponent implements OnInit {
  private http = inject(HttpClient);
  reportData = signal<{ closingStock: { item_id: string; opening: number; sold: number; remaining: number }[]; totalCash: number }>({ closingStock: [], totalCash: 0 });
  globalLoading = globalLoading;

  ngOnInit() {
    this.fetchEodReport('delivery_boy_id_placeholder');
  }

  fetchEodReport(deliveryBoyId: string) {
    globalLoading.set(true);
    this.http.get(`/reports/eod/${deliveryBoyId}`).subscribe({
      next: (data: any) => {
        this.reportData.set(data.data);
        globalLoading.set(false);
      },
      error: () => {
        globalLoading.set(false);
      },
    });
  }

  shareViaWhatsApp() {
    const report = this.reportData();
    const message = `EOD Report:\n\n` +
      report.closingStock
        .map(
          (item: any) =>
            `Item: ${item.item_id}, Opening: ${item.opening}, Sold: ${item.sold}, Remaining: ${item.remaining}`,
        )
        .join('\n') +
      `\n\nTotal Cash to Deposit: ${report.totalCash}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  trackByItem(index: number, item: any) {
    return item.item_id;
  }
}