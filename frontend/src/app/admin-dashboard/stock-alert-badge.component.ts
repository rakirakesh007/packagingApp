import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stock-alert-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-alert-badge.component.html',
  styleUrls: ['./stock-alert-badge.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockAlertBadgeComponent implements OnInit {
  private http = inject(HttpClient);
  lowStockCount = signal(0);

  ngOnInit() {
    this.fetchLowStockCount();
  }

  fetchLowStockCount() {
    this.http.get('/inventory/low-stock').subscribe({
      next: (response: any) => {
        this.lowStockCount.set(response.data.length);
      },
      error: (err) => {
        console.error('Failed to fetch low stock count:', err);
      },
    });
  }
}