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
import { InventoryService } from '../services/inventory.service';
import { SaleService } from '../services/sale.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';
import { InventoryItem } from '../models/inventory.model';
import { environment } from '../../environments/environment';

export interface CartItem {
  item: InventoryItem;
  qty: number;
}

@Component({
  selector: 'app-sales-cart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-cart.page.html',
  styleUrls: ['./sales-cart.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesCartPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private saleService       = inject(SaleService);
  private loading           = inject(GlobalLoadingService);
  private auth              = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────
  allItems     = signal<InventoryItem[]>([]);
  cart         = signal<Map<string, number>>(new Map());
  searchQuery  = signal('');
  showCheckout = signal(false);
  shopName     = signal('');
  shopMobile   = signal('');
  paymentMode  = signal<'cash' | 'online'>('cash');
  orderSuccess = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────
  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return q
      ? this.allItems().filter((i) => i.item_name.toLowerCase().includes(q))
      : this.allItems();
  });

  cartCount = computed(() => {
    let n = 0;
    this.cart().forEach((qty) => (n += qty));
    return n;
  });

  cartTotal = computed(() => {
    let total = 0;
    this.cart().forEach((qty, id) => {
      const item = this.allItems().find((i) => i.id === id);
      if (item) total += qty * item.unit_price;
    });
    return total;
  });

  cartItemsList = computed<CartItem[]>(() => {
    const list: CartItem[] = [];
    this.cart().forEach((qty, id) => {
      const item = this.allItems().find((i) => i.id === id);
      if (item && qty > 0) list.push({ item, qty });
    });
    return list;
  });

  ngOnInit(): void {
    this.loading.show();
    this.inventoryService.getItems().subscribe({
      next:     (items) => this.allItems.set(items),
      error:    (err)   => { console.error(err); this.loading.hide(); },
      complete: ()      => this.loading.hide(),
    });
  }

  getQty(id: string): number {
    return this.cart().get(id) ?? 0;
  }

  increment(id: string): void {
    this.cart.update((m) => {
      const next = new Map(m);
      next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
  }

  decrement(id: string): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur = next.get(id) ?? 0;
      if (cur <= 1) next.delete(id);
      else next.set(id, cur - 1);
      return next;
    });
  }

  openCheckout(): void {
    if (this.cartCount() === 0) return;
    this.showCheckout.set(true);
  }

  closeCheckout(): void {
    this.showCheckout.set(false);
  }

  placeOrder(): void {
    const deliveryBoyId = this.auth.userId();
    if (!deliveryBoyId || this.cartCount() === 0) return;

    const items = this.cartItemsList().map((ci) => ({
      item_id: ci.item.id,
      qty:     ci.qty,
      price:   ci.item.unit_price,
    }));

    this.loading.show();
    this.saleService
      .createSale({
        delivery_boy_id: deliveryBoyId,
        items,
        total_amount: this.cartTotal(),
        payment_mode: this.paymentMode(),
        shop_name:   this.shopName(),
        shop_mobile: this.shopMobile(),
      })
      .subscribe({
        next: () => {
          this.loading.hide();
          this.openWhatsApp();
          this.resetCart();
          this.orderSuccess.set(true);
          setTimeout(() => this.orderSuccess.set(false), 3000);
        },
        error: (err) => { console.error(err); this.loading.hide(); },
      });
  }

  private openWhatsApp(): void {
    const mobile = this.shopMobile().trim();
    if (!mobile) return;
    const date  = new Date().toLocaleDateString('en-IN');
    const lines = this.cartItemsList()
      .map((ci) => `${ci.item.item_name} x${ci.qty} = \u20B9${ci.qty * ci.item.unit_price}`)
      .join('\n');
    const mode = this.paymentMode() === 'cash' ? 'Cash' : 'Online';
    const msg  = [
      '*DesiMasalaHub - Order Receipt*',
      `Date: ${date}`,
      '------------------',
      lines,
      '------------------',
      `Total: \u20B9${this.cartTotal()}`,
      `Payment: ${mode}`,
      '------------------',
      `To order again, contact Rakesh: wa.me/${environment.ownerWhatsapp}`,
    ].join('\n');
    window.open(`https://wa.me/91${mobile}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  private resetCart(): void {
    this.cart.set(new Map());
    this.shopName.set('');
    this.shopMobile.set('');
    this.paymentMode.set('cash');
    this.showCheckout.set(false);
  }
}
