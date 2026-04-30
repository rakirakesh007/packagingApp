import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../services/sale.service';
import { AssignmentService } from '../services/assignment.service';
import { LoadingService } from '../services/loading.service';
import { Sale } from '../models/sale.model';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingPage {
  private saleService = inject(SaleService);
  private assignmentService = inject(AssignmentService);
  private loadingService = inject(LoadingService);

  activeAssignment = signal<{ item_id: string; qty: number; price: number; item_name?: string }[]>([]);
  customerName = signal('');
  totalAmount = signal(0);

  constructor() {
    this.fetchActiveAssignment();
  }

  fetchActiveAssignment() {
    this.loadingService.set(true);
    this.assignmentService
      .getActiveAssignment('deliveryBoyId') // Replace with actual ID
      .subscribe({
        next: (data) => this.activeAssignment.set((data.items as { item_id: string; qty: number; price: number; item_name?: string }[])),
        error: (err) => console.error('Failed to fetch assignment:', err),
        complete: () => this.loadingService.set(false),
      });
  }

  calculateTotal() {
    const total = this.activeAssignment().reduce(
      (sum, item: Sale['items'][number]) => sum + item.qty * item.price,
      0
    );
    this.totalAmount.set(total);
  }

  confirmAndSendBill() {
    const itemsToSell = this.activeAssignment().map((item: Sale['items'][number]) => ({
      item_id: item.item_id,
      qty: item.qty,
      price: item.price,
    }));

    this.saleService
      .createSale({
        customer_name: this.customerName(),
        items: itemsToSell,
        total_amount: this.totalAmount(),
        payment_mode: 'Cash', // Replace with actual selection
        delivery_boy_id: 'deliveryBoyId', // Replace with actual ID
      })
      .subscribe({
        next: () => {
          const message = `Hello ${this.customerName()}, thanks for your order!\nItems: ${itemsToSell
            .map((i) => `${i.qty}x ${i.item_id}`)
            .join(', ')}\nTotal: ₹${this.totalAmount()}\nPaid via: Cash.\n---\nTo place your next order, just reply to this message!`;
          window.open(
            `https://wa.me/NUMBER?text=${encodeURIComponent(message)}`,
            '_blank'
          );
        },
        error: (err) => console.error('Failed to create sale:', err),
      });
  }
}