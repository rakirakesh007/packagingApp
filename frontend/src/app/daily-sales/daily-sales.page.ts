import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleService } from '../services/sale.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';

export interface DailySaleRecord {
  _id: string;
  shop_name?: string;
  timestamp: string;
  total_amount: number;
  payment_mode: 'cash' | 'online';
}

@Component({
  selector: 'app-daily-sales',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-sales.page.html',
  styleUrls: ['./daily-sales.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailySalesPage implements OnInit {
  private saleService = inject(SaleService);
  private loading     = inject(GlobalLoadingService);
  private auth        = inject(AuthService);

  sales       = signal<DailySaleRecord[]>([]);
  selectedDate = signal(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

  totalSales = computed(() =>
    this.sales().reduce((s, r) => s + r.total_amount, 0)
  );

  totalCash = computed(() =>
    this.sales()
      .filter((r) => r.payment_mode === 'cash')
      .reduce((s, r) => s + r.total_amount, 0)
  );

  totalOnline = computed(() =>
    this.sales()
      .filter((r) => r.payment_mode === 'online')
      .reduce((s, r) => s + r.total_amount, 0)
  );

  ngOnInit(): void {
    this.fetchSales();
  }

  fetchSales(): void {
    const id = this.auth.userId();
    if (!id) return;
    this.loading.show();
    this.saleService.getTodaySales(id, this.selectedDate()).subscribe({
      next:     (data) => this.sales.set(data as unknown as DailySaleRecord[]),
      error:    (err)  => { console.error(err); this.loading.hide(); },
      complete: ()     => this.loading.hide(),
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  onDateChange(event: Event): void {
    this.selectedDate.set((event.target as HTMLInputElement).value);
    this.fetchSales();
  }
}
