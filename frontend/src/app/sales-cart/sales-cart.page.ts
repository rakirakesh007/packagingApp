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
import { AssignmentService } from '../services/assignment.service';
import { SaleService } from '../services/sale.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../auth/auth.service';
import { InventoryService } from '../services/inventory.service';
import { InventoryItem } from '../models/inventory.model';
import { environment } from '../../environments/environment';

export interface CartItem {
  item: InventoryItem;
  sheets_sold: number;
  discount_amount: number;
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
  private assignmentService = inject(AssignmentService);
  private saleService       = inject(SaleService);
  private loading           = inject(GlobalLoadingService);
  private toast             = inject(ToastService);
  private auth              = inject(AuthService);
  private inventoryService  = inject(InventoryService);

  // ── State ──────────────────────────────────────────────────────────────
  allItems     = signal<InventoryItem[]>([]);
  catalogItems = signal<InventoryItem[]>([]);   // full inventory for catalog
  cart         = signal<Map<string, { sheets_sold: number; discount_amount: number }>>(new Map());
  searchQuery  = signal('');
  showCheckout = signal(false);
  shopName     = signal('');
  shopMobile   = signal('');
  paymentMode  = signal<'cash' | 'online'>('cash');
  orderSuccess = signal(false);
  /** Guards against double-tapping Place Order while the sale request is in flight. */
  submitting   = signal(false);
  noAssignment = signal(false);   // true when no loading record exists for today

  // ── Computed ───────────────────────────────────────────────────────────
  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return q
      ? this.allItems().filter((i) =>
          i.item_name.toLowerCase().includes(q) || (i.hindi_name ?? '').toLowerCase().includes(q)
        )
      : this.allItems();
  });

  cartCount = computed(() => {
    let n = 0;
    this.cart().forEach((entry) => (n += entry.sheets_sold));
    return n;
  });

  cartTotal = computed(() => {
    let total = 0;
    this.cart().forEach((entry, id) => {
      const item = this.allItems().find((i) => i.id === id);
      if (item) {
        const finalPerSheet = Math.max(0, item.wholesale_price_per_sheet - entry.discount_amount);
        total += entry.sheets_sold * finalPerSheet;
      }
    });
    return total;
  });

  cartItemsList = computed<CartItem[]>(() => {
    const list: CartItem[] = [];
    this.cart().forEach((entry, id) => {
      const item = this.allItems().find((i) => i.id === id);
      if (item && entry.sheets_sold > 0) list.push({ item, sheets_sold: entry.sheets_sold, discount_amount: entry.discount_amount });
    });
    return list;
  });

  ngOnInit(): void {
    const userId = this.auth.userId();
    if (!userId) return;

    // Load full inventory once for the digital catalog
    this.inventoryService.getItems().subscribe({
      next: (items) => this.catalogItems.set(items),
      error: (err) => console.error('Catalog fetch failed:', err),
    });

    this.loading.show();
    this.assignmentService.getActiveAssignment(userId).subscribe({
      next: (assignment) => {
        this.noAssignment.set(false);
        // Map denormalized assignment items → InventoryItem shape
        const items: InventoryItem[] = assignment.items.map((ai: any) => ({
          id:                         ai.item_id,
          item_name:                  ai.item_name,
          hindi_name:                 ai.hindi_name,
          wholesale_price_per_sheet:  ai.wholesale_price_per_sheet ?? 0,
          total_stock:                ai.qty,
          units_per_sheet:            0,
          low_stock_threshold:        0,
        }));
        this.allItems.set(items);
      },
      error: (err) => {
        if (err.status === 404) {
          this.noAssignment.set(true);
        } else {
          console.error('Assignment fetch failed:', err);
        }
        this.loading.hide();
      },
      complete: () => this.loading.hide(),
    });
  }

  getQty(id: string): number {
    return this.cart().get(id)?.sheets_sold ?? 0;
  }

  increment(id: string): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur  = next.get(id) ?? { sheets_sold: 0, discount_amount: 0 };
      next.set(id, { ...cur, sheets_sold: cur.sheets_sold + 1 });
      return next;
    });
  }

  decrement(id: string): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur  = next.get(id);
      if (!cur || cur.sheets_sold <= 1) next.delete(id);
      else next.set(id, { ...cur, sheets_sold: cur.sheets_sold - 1 });
      return next;
    });
  }

  /** Set or update per-sheet discount for a cart item. */
  setDiscount(id: string, discount: number): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur  = next.get(id);
      if (cur) next.set(id, { ...cur, discount_amount: Math.max(0, discount) });
      return next;
    });
  }
  getDiscount(id: string): number {
    return this.cart().get(id)?.discount_amount ?? 0;
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
    if (!deliveryBoyId || this.cartCount() === 0 || this.submitting()) return;
    this.submitting.set(true);

    const items = this.cartItemsList().map((ci) => ({
      item_id:         ci.item.id,
      item_name:       ci.item.item_name,
      hindi_name:      ci.item.hindi_name,
      sheets_sold:     ci.sheets_sold,
      discount_amount: ci.discount_amount,
    }));

    this.loading.show();
    this.saleService
      .createSale({
        delivery_boy_id: deliveryBoyId,
        items,
        payment_mode: this.paymentMode(),
        shop_name:    this.shopName(),
        shop_mobile:  this.shopMobile(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.loading.hide();
          this.toast.success('Sale recorded!');
          this.openWhatsApp();
          this.resetCart();
          this.orderSuccess.set(true);
          setTimeout(() => this.orderSuccess.set(false), 3000);
        },
        error: (err) => {
          console.error(err);
          this.submitting.set(false);
          this.loading.hide();
          this.toast.error(err?.error?.message ?? 'Could not record sale. Please try again.');
        },
      });
  }

  private openWhatsApp(): void {
    const mobile = this.shopMobile().trim();
    if (!mobile) return;
    const date  = new Date().toLocaleDateString('en-IN');
    const lines = this.cartItemsList()
      .map((ci) => {
        const name    = ci.item.hindi_name || ci.item.item_name;
        const english = ci.item.hindi_name ? ` (${ci.item.item_name})` : '';
        const finalPrice  = Math.max(0, ci.item.wholesale_price_per_sheet - ci.discount_amount) * ci.sheets_sold;
        const discountNote = ci.discount_amount > 0 ? ` (disc. ₹${ci.discount_amount}/sheet)` : '';
        return `${ci.sheets_sold} sheets ${name}${english}${discountNote} = ₹${finalPrice}`;
      })
      .join('\n');
    const mode = this.paymentMode() === 'cash' ? 'Cash' : 'Online';
    const catalog = this.generateCatalog(this.catalogItems());
    const msg  = [
      `नमस्ते ${this.shopName() || 'ग्राहक'}, आपका ऑर्डर:`,
      `Date: ${date}`,
      lines,
      `Total: \u20B9${this.cartTotal()}`,
      `Payment: ${mode}`,
      `To order again, contact Rakesh: wa.me/${environment.ownerWhatsapp}`,
      ...(catalog ? ['', catalog] : []),
    ].join('\n');
    window.open(`https://wa.me/91${mobile}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  /**
   * Generates a digital catalog section for WhatsApp using the provided inventory.
   * Only items with total_stock >= 5 are included.
   */
  private generateCatalog(items: InventoryItem[]): string {
    const eligible = items.filter((item) => (item.total_stock ?? 0) >= 5);
    if (eligible.length === 0) return '';

    const rows = eligible
      .map((item, i) => {
        const name  = item.hindi_name ? `${item.hindi_name} (${item.item_name})` : item.item_name;
        const price = `₹${item.wholesale_price_per_sheet}/sheet`;
        return `${i + 1}. ${name} — ${price}`;
      })
      .join('\n');

    return [
      '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
      '\uD83C\uDF36\uFE0F *DesiMasalaHub — डिजिटल कैटलॉग*',
      rows,
      '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
      '\uD83D\uDCE6 ताज़ा और शुद्ध मसाले — सीधे आपके दरवाज़े तक।',
       '\uD83D\uDCAC अपना ऑर्डर देने के लिए कृपया यहाँ लिखें:',
       '1. मसालों की सूची (नाम और मात्रा)',
       '2. अपना पूरा पता (Address)',
    ].join('\n');
  }

  private resetCart(): void {
    this.cart.set(new Map());
    this.shopName.set('');
    this.shopMobile.set('');
    this.paymentMode.set('cash');
    this.showCheckout.set(false);
  }
}
