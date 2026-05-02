import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';

interface EodItem {
  item_id: string;
  item_name: string;
  opening: number;
  sold: number;
  remaining: number;
}

interface EodReport {
  closingStock: EodItem[];
  totalCash: number;
}

@Component({
  selector: 'app-eod-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eod-report.component.html',
  styleUrls: ['./eod-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodReportComponent implements OnInit {
  private http = inject(HttpClient);
  private loading = inject(GlobalLoadingService);
  private auth = inject(AuthService);

  reportData = signal<EodReport>({ closingStock: [], totalCash: 0 });

  ngOnInit(): void {
    const id = this.auth.userId();
    if (id) {
      this.fetchEodReport(id);
    }
  }

  private fetchEodReport(deliveryBoyId: string): void {
    this.loading.show();
    this.http.get<{ data: EodReport }>(`/reports/eod/${deliveryBoyId}`).subscribe({
      next: (res) => this.reportData.set(res.data),
      error: (err) => console.error('Failed to fetch EOD report:', err),
      complete: () => this.loading.hide(),
    });
  }

  shareViaWhatsApp(): void {
    const report = this.reportData();
    const lines = report.closingStock
      .map(
        (item) =>
          `${item.item_name}: Opening ${item.opening} | Sold ${item.sold} | Remaining ${item.remaining}`
      )
      .join('\n');
    const message = `EOD Report:\n\n${lines}\n\nTotal Cash to Deposit: \u20B9${report.totalCash}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  trackByItem(_index: number, item: EodItem): string {
    return item.item_id;
  }
}
