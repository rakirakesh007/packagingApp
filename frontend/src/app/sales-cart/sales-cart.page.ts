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
import { forkJoin } from 'rxjs';

export interface CartItem {
  item: InventoryItem;
  sheets_sold: number;
  selling_price_per_sheet: number;
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
  cart         = signal<Map<string, { sheets_sold: number; selling_price_per_sheet: number }>>(new Map());
  searchQuery  = signal('');
  showCheckout = signal(false);
  shopName     = signal('');
  shopMobile   = signal('');
  paymentMode  = signal<'cash' | 'online'>('cash');
  orderSuccess = signal(false);
  /** Guards against double-tapping Place Order while the sale request is in flight. */
  submitting   = signal(false);
  noAssignment = signal(false);   // true when no stock currently held by this boy

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
        total += entry.sheets_sold * Math.max(0, entry.selling_price_per_sheet);
      }
    });
    return total;
  });

  cartItemsList = computed<CartItem[]>(() => {
    const list: CartItem[] = [];
    this.cart().forEach((entry, id) => {
      const item = this.allItems().find((i) => i.id === id);
      if (item && entry.sheets_sold > 0) list.push({ item, sheets_sold: entry.sheets_sold, selling_price_per_sheet: entry.selling_price_per_sheet });
    });
    return list;
  });

  ngOnInit(): void {
    const userId = this.auth.userId();
    if (!userId) return;

    this.loading.show();
    forkJoin({
      holdings: this.assignmentService.getHoldings(userId),
      catalog:  this.inventoryService.getItems(),
    }).subscribe({
      next: ({ holdings, catalog }) => {
        this.catalogItems.set(catalog);
        if (holdings.length === 0) {
          this.noAssignment.set(true);
          return;
        }
        this.noAssignment.set(false);
        const catalogMap = new Map(catalog.map((c) => [c.id, c]));
        const items: InventoryItem[] = holdings.map((h) => ({
          id:                        h.item_id,
          item_name:                 h.item_name,
          hindi_name:                h.hindi_name,
          wholesale_price_per_sheet: catalogMap.get(h.item_id)?.wholesale_price_per_sheet ?? 0,
          total_stock:               h.withBoy,
          units_per_sheet:           h.units_per_sheet,
          low_stock_threshold:       0,
        }));
        this.allItems.set(items);
      },
      error: (err) => {
        console.error('Load failed:', err);
        this.noAssignment.set(true);
        this.loading.hide();
      },
      complete: () => this.loading.hide(),
    });
  }

  getQty(id: string): number {
    return this.cart().get(id)?.sheets_sold ?? 0;
  }

  /** Units per sheet for an item — assignment items don't carry it, so read from the full catalog. */
  private unitsFor(id: string): number {
    return this.catalogItems().find((i) => i.id === id)?.units_per_sheet || 1;
  }

  /** Default per-sheet selling price = per-packet wholesale × units per sheet. */
  sheetPrice(item: InventoryItem): number {
    return (item.wholesale_price_per_sheet ?? 0) * this.unitsFor(item.id);
  }

  increment(id: string): void {
    this.cart.update((m) => {
      const next = new Map(m);
      // First add defaults the selling price to the item's per-sheet wholesale (editable afterwards).
      const item = this.allItems().find((i) => i.id === id);
      const defaultPrice = item ? this.sheetPrice(item) : 0;
      const cur  = next.get(id) ?? { sheets_sold: 0, selling_price_per_sheet: defaultPrice };
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

  /** Set or update the negotiated per-sheet selling price for a cart item. */
  setPrice(id: string, price: number): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur  = next.get(id);
      if (cur) next.set(id, { ...cur, selling_price_per_sheet: Math.max(0, price) });
      return next;
    });
  }
  getPrice(id: string): number {
    return this.cart().get(id)?.selling_price_per_sheet ?? 0;
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
      item_id:                 ci.item.id,
      item_name:               ci.item.item_name,
      hindi_name:              ci.item.hindi_name,
      sheets_sold:             ci.sheets_sold,
      selling_price_per_sheet: ci.selling_price_per_sheet,
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
          // Refresh available stock so quantities are accurate for the next sale
          const uid = this.auth.userId();
          if (uid) {
            this.assignmentService.getHoldings(uid).subscribe({
              next: (holdings) => {
                const catalogMap = new Map(this.catalogItems().map((c) => [c.id, c]));
                this.allItems.set(holdings.map((h) => ({
                  id:                        h.item_id,
                  item_name:                 h.item_name,
                  hindi_name:                h.hindi_name,
                  wholesale_price_per_sheet: catalogMap.get(h.item_id)?.wholesale_price_per_sheet ?? 0,
                  total_stock:               h.withBoy,
                  units_per_sheet:           h.units_per_sheet,
                  low_stock_threshold:       0,
                })));
                if (holdings.length === 0) this.noAssignment.set(true);
              },
            });
          }
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
    const date   = new Date().toLocaleDateString('en-IN');
    const mode   = this.paymentMode() === 'cash' ? 'Cash' : 'Online';

    const lines = this.cartItemsList()
      .map((ci) => {
        const name       = ci.item.hindi_name || ci.item.item_name;
        const english    = ci.item.hindi_name ? ` (${ci.item.item_name})` : '';
        const finalPrice = Math.max(0, ci.selling_price_per_sheet) * ci.sheets_sold;
        return `${ci.sheets_sold} sheets ${name}${english} @ ₹${ci.selling_price_per_sheet}/sheet = ₹${finalPrice}`;
      })
      .join('\n');

    // Bill to the shop (customer)
    if (mobile) {
      const catalog = this.generateCatalog(this.catalogItems());
      const shopMsg = [
        `नमस्ते ${this.shopName() || 'ग्राहक'}, आपका ऑर्डर:`,
        `Date: ${date}`,
        lines,
        `Total: ₹${this.cartTotal()}`,
        `Payment: ${mode}`,
        `To order again, contact Rakesh: wa.me/${environment.ownerWhatsapp}`,
        ...(catalog ? ['', catalog] : []),
      ].join('\n');
      window.open(`https://wa.me/91${mobile}?text=${encodeURIComponent(shopMsg)}`, '_blank');
    }

    // Notify owner on every sale
    const boyName  = this.auth.userName() ?? 'Delivery Boy';
    const ownerMsg = [
      `🚚 Sale — ${boyName}`,
      `Shop: ${this.shopName() || '—'} | Date: ${date}`,
      lines,
      `Total: ₹${this.cartTotal()} | Payment: ${mode}`,
    ].join('\n');
    window.open(`https://wa.me/${environment.ownerWhatsapp}?text=${encodeURIComponent(ownerMsg)}`, '_blank');
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
        const price = `₹${this.sheetPrice(item)}/sheet`;
        return `${i + 1}. ${name} — ${price}`;
      })
      .join('\n');

    return [
      '──────────────────',
      '🌶️ *DesiMasalaHub — डिजिटल कैटलॉग*',
      rows,
      '──────────────────',
      '📦 ताज़ा और शुद्ध मसाले — सीधे आपके दरवाज़े तक।',
      '💬 अपना ऑर्डर देने के लिए कृपया यहाँ लिखें:',
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
