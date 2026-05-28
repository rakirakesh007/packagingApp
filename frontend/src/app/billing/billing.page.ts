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
import { SaleService } from '../services/sale.service';
import { AssignmentService } from '../services/assignment.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';

export interface BillingItem {
  item_id: string;
  item_name?: string;
  hindi_name?: string;
  sheets_sold: number;
  discount_amount: number;
  wholesale_price_per_sheet: number;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingPage implements OnInit {
  private saleService       = inject(SaleService);
  private assignmentService = inject(AssignmentService);
  private loading           = inject(GlobalLoadingService);
  private auth              = inject(AuthService);

  activeAssignment = signal<BillingItem[]>([]);
  customerName     = signal('');

  /** Auto-computed total from current quantities. */
  totalAmount = computed(() =>
    this.activeAssignment().reduce((sum, item) => {
      const finalPerSheet = Math.max(0, item.wholesale_price_per_sheet - item.discount_amount);
      return sum + item.sheets_sold * finalPerSheet;
    }, 0)
  );

  ngOnInit(): void {
    this.fetchActiveAssignment();
  }

  private fetchActiveAssignment(): void {
    const id = this.auth.userId();
    if (!id) return;
    this.loading.show();
    this.assignmentService.getActiveAssignment(id).subscribe({
      next: (assignment) =>
        this.activeAssignment.set(
          assignment.items.map((i: any) => ({
            item_id:    i.item_id,
            item_name:  i.item_name,
            hindi_name: i.hindi_name,
            wholesale_price_per_sheet: i.wholesale_price_per_sheet ?? 0,
            discount_amount: 0,
            sheets_sold: 0,
          }))
        ),
      error: (err) => { console.error('Failed to fetch assignment:', err); this.loading.hide(); },
      complete: () => this.loading.hide(),
    });
  }

  /** Increment qty for item at index (immutable signal update). */
  incrementQty(index: number): void {
    this.activeAssignment.update((items) =>
      items.map((item, i) => i === index ? { ...item, sheets_sold: item.sheets_sold + 1 } : item)
    );
  }

  /** Decrement qty for item at index (min 0). */
  decrementQty(index: number): void {
    this.activeAssignment.update((items) =>
      items.map((item, i) =>
        i === index ? { ...item, sheets_sold: Math.max(0, item.sheets_sold - 1) } : item
      )
    );
  }

  confirmAndSendBill(): void {
    const deliveryBoyId = this.auth.userId();
    if (!deliveryBoyId || !this.customerName()) return;

    const itemsToSell = this.activeAssignment()
      .filter((item) => item.sheets_sold > 0)
      .map((item) => ({
        item_id:         item.item_id,
        item_name:       item.item_name,
        hindi_name:      item.hindi_name,
        sheets_sold:     item.sheets_sold,
        discount_amount: item.discount_amount,
      }));

    if (itemsToSell.length === 0) return;

    this.loading.show();
    this.saleService.createSale({
      delivery_boy_id: deliveryBoyId,
      items:          itemsToSell,
      payment_mode:   'cash',
      shop_name:      this.customerName(),
    }).subscribe({
      next: () => {
        this.loading.hide();
        const lines    = itemsToSell
          .map((i) => `${i.sheets_sold} sheets ${i.hindi_name || i.item_name || i.item_id}`)
          .join(', ');
        const message  = `नमस्ते ${this.customerName()}, आपका ऑर्डर: ${lines}. कुल: \u20B9${this.totalAmount()}. धन्यवाद!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        // Reset form
        this.customerName.set('');
        this.activeAssignment.update((items) => items.map((i) => ({ ...i, sheets_sold: 0 })));
      },
      error: (err) => { console.error('Failed to create sale:', err); this.loading.hide(); },
    });
  }
}
