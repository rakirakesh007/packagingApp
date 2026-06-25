import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerOrderService, CatalogItem } from '../services/customer-order.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { environment } from '../../environments/environment';
import { TRANSLATIONS, Lang } from './i18n';

const FREE_DELIVERY_THRESHOLD = 499;
const DELIVERY_FEE = 20;
const CART_KEY = 'dmh_cart';
const LANG_KEY = 'dmh_lang';

interface CartLine {
  item: CatalogItem;
  sheets: number;
}

@Component({
  selector: 'app-customer-store',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-store.page.html',
  styleUrls: ['./customer-store.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStorePage implements OnInit {
  private orderService = inject(CustomerOrderService);
  private loading      = inject(GlobalLoadingService);

  // ── State ────────────────────────────────────────────────────────────────
  catalog     = signal<CatalogItem[]>([]);
  cart        = signal<Map<string, number>>(this.loadCart());   // item_id → sheets
  searchQuery = signal('');
  lang        = signal<Lang>(this.loadLang());
  showCheckout = signal(false);

  custName    = signal('');
  custPhone   = signal('');
  custAddress = signal('');

  submitting        = signal(false);
  orderPlaced       = signal(false);
  ownerWaUrl        = signal<string | null>(null);
  formError         = signal('');
  detectingLocation = signal(false);

  constructor() {
    // Persist cart + language whenever they change.
    effect(() => this.saveCart(this.cart()));
    effect(() => localStorage.setItem(LANG_KEY, this.lang()));
  }

  // ── Translation ──────────────────────────────────────────────────────────
  t(key: string): string {
    return TRANSLATIONS[this.lang()][key] ?? key;
  }
  toggleLang(): void {
    this.lang.set(this.lang() === 'en' ? 'hi' : 'en');
  }
  /** Item display name based on selected language (other name in parentheses). */
  displayName(item: CatalogItem): string {
    if (this.lang() === 'hi') return item.hindi_name || item.item_name;
    return item.item_name || item.hindi_name;
  }
  subName(item: CatalogItem): string {
    if (this.lang() === 'hi') return item.hindi_name ? item.item_name : '';
    return item.item_name && item.hindi_name ? item.hindi_name : '';
  }
  /** Differentiates same-name variants (e.g. ₹5 vs ₹10 packets): shows MRP pack size. */
  variant(item: CatalogItem): string {
    return item.mrp_per_unit ? `₹${item.mrp_per_unit} ${this.t('pack')}` : '';
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.catalog();
    if (!q) return all;
    return all.filter((i) =>
      i.item_name.toLowerCase().includes(q) ||
      (i.hindi_name ?? '').toLowerCase().includes(q) ||
      (i.search_aliases ?? '').toLowerCase().includes(q)
    );
  });

  cartCount = computed(() => {
    let n = 0;
    this.cart().forEach((s) => (n += s));
    return n;
  });

  cartTotal = computed(() => {
    let total = 0;
    const map = this.cart();
    for (const item of this.catalog()) {
      const sheets = map.get(item.id) ?? 0;
      total += sheets * item.price_per_sheet;
    }
    return total;
  });

  cartLines = computed<CartLine[]>(() => {
    const lines: CartLine[] = [];
    const map = this.cart();
    for (const item of this.catalog()) {
      const sheets = map.get(item.id) ?? 0;
      if (sheets > 0) lines.push({ item, sheets });
    }
    return lines;
  });

  freeDeliveryRemaining = computed(() => Math.max(0, FREE_DELIVERY_THRESHOLD - this.cartTotal()));
  qualifiesFreeDelivery = computed(() => this.cartTotal() >= FREE_DELIVERY_THRESHOLD && this.cartTotal() > 0);

  // Flat ₹20 delivery fee, waived once subtotal crosses the free-delivery threshold.
  deliveryFee = computed(() => (this.cartCount() === 0 || this.qualifiesFreeDelivery()) ? 0 : DELIVERY_FEE);
  grandTotal  = computed(() => this.cartTotal() + this.deliveryFee());

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loading.show();
    this.orderService.getCatalog().subscribe({
      next: (items) => this.catalog.set(items),
      error: (err) => console.error('Catalog load failed:', err),
      complete: () => this.loading.hide(),
    });
  }

  // ── Cart ─────────────────────────────────────────────────────────────────
  getQty(id: string): number {
    return this.cart().get(id) ?? 0;
  }

  increment(item: CatalogItem): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur = next.get(item.id) ?? 0;
      if (cur < item.sheets_available) next.set(item.id, cur + 1);
      return next;
    });
  }

  decrement(item: CatalogItem): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur = next.get(item.id) ?? 0;
      if (cur <= 1) next.delete(item.id);
      else next.set(item.id, cur - 1);
      return next;
    });
  }

  openCheckout(): void {
    if (this.cartCount() === 0) return;
    this.formError.set('');
    this.showCheckout.set(true);
  }
  closeCheckout(): void {
    this.showCheckout.set(false);
  }

  /** Fill the address from the device's GPS (reverse-geocoded) + a Maps pin. */
  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.formError.set(this.t('locationError'));
      return;
    }
    this.detectingLocation.set(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
        let resolved = '';
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json' } }
          );
          const data = await r.json();
          resolved = (data?.display_name as string) || '';
        } catch {
          // ignore — fall back to the maps pin only
        }
        const existing = this.custAddress().trim();
        const parts = [existing, resolved, `📍 ${mapsLink}`].filter(Boolean);
        this.custAddress.set(parts.join('\n'));
        this.detectingLocation.set(false);
      },
      () => {
        this.detectingLocation.set(false);
        this.formError.set(this.t('locationError'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Place order ──────────────────────────────────────────────────────────
  placeOrder(): void {
    const name = this.custName().trim();
    const phone = this.custPhone().trim();
    const address = this.custAddress().trim();
    if (!name || phone.length < 10 || !address) {
      this.formError.set(this.t('fillAll'));
      return;
    }
    if (this.cartCount() === 0) return;

    this.submitting.set(true);

    // Build a clear, well-formatted WhatsApp message: numbered items (with the
    // variant so same-name packs are distinguishable), price breakdown, and the
    // full customer details so no follow-up is needed.
    const lines = this.cartLines()
      .map((l, i) => {
        const baseName = l.item.hindi_name ? `${l.item.item_name} (${l.item.hindi_name})` : l.item.item_name;
        const variant = l.item.mrp_per_unit ? ` [₹${l.item.mrp_per_unit} pack]` : '';
        return `${i + 1}. ${baseName}${variant}\n   ${l.sheets} sheet × ₹${l.item.price_per_sheet} = ₹${l.sheets * l.item.price_per_sheet}`;
      })
      .join('\n');

    const deliveryLine = this.deliveryFee() === 0
      ? 'Delivery: FREE'
      : `Delivery: ₹${this.deliveryFee()}`;

    const msg = [
      '🛒 *New Order — DesiMasalaHub*',
      '',
      '*Items:*',
      lines,
      '',
      `Subtotal: ₹${this.cartTotal()}`,
      deliveryLine,
      `*Total: ₹${this.grandTotal()}*`,
      '',
      '*Deliver to:*',
      `👤 ${name}`,
      `📞 ${phone}`,
      `📍 ${address}`,
    ].join('\n');

    this.ownerWaUrl.set(`https://wa.me/${environment.ownerWhatsapp}?text=${encodeURIComponent(msg)}`);

    // Auto-open WhatsApp (single window.open as a direct result of the click — no popup blocker).
    this.sendWhatsapp();

    this.submitting.set(false);
    this.orderPlaced.set(true);
    this.showCheckout.set(false);
    this.cart.set(new Map());
  }

  sendWhatsapp(): void {
    const url = this.ownerWaUrl();
    if (url) window.open(url, '_blank');
  }

  startNewOrder(): void {
    this.orderPlaced.set(false);
    this.ownerWaUrl.set(null);
    this.custName.set('');
    this.custPhone.set('');
    this.custAddress.set('');
    this.formError.set('');
  }

  // ── Persistence ──────────────────────────────────────────────────────────
  private loadCart(): Map<string, number> {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return new Map();
      return new Map(Object.entries(JSON.parse(raw) as Record<string, number>));
    } catch {
      return new Map();
    }
  }
  private saveCart(map: Map<string, number>): void {
    localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(map)));
  }
  private loadLang(): Lang {
    return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
  }
}
