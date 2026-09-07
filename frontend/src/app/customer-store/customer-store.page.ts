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
import { CATEGORIES } from '../models/categories.const';

const FREE_DELIVERY_THRESHOLD = 249;
const DELIVERY_FEE = 20;
const CART_KEY = 'dmh_cart';
const LAST_ORDER_KEY = 'dmh_last_order';
const INSTALL_DISMISS_KEY = 'dmh_install_dismissed';
const DETAILS_KEY = 'dmh_customer';
/** Sheets that earn a free sheet, per the printed pamphlet offer. */
const FREE_SHEET_AT = 25;
const LANG_KEY = 'dmh_lang';

interface CartLine {
  item: CatalogItem;
  sheets: number;
}

interface ItemGroup {
  item_name: string;
  hindi_name: string;
  category: string;
  variants: CatalogItem[];
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

  // Prefilled from this device's last order — there is no login, so delivery
  // details are remembered per-device the same way the cart and last order are.
  custName    = signal(this.loadDetails().name);
  custPhone   = signal(this.loadDetails().phone);
  custAddress = signal(this.loadDetails().address);

  submitting        = signal(false);
  orderPlaced       = signal(false);
  ownerWaUrl        = signal<string | null>(null);
  formError         = signal('');
  detectingLocation = signal(false);
  activeGroup       = signal<ItemGroup | null>(null);
  /** Last order, kept per-device so a repeat customer can refill in one tap. */
  lastOrder         = signal<Array<{ id: string; sheets: number }>>(this.loadLastOrder());
  catalogLoading    = signal(true);
  hasSavedDetails   = signal(!!this.loadDetails().phone);
  catalogError      = signal(false);
  /** Placeholder rows shown while the catalog is in flight. */
  readonly skeletons = Array.from({ length: 6 });

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
  /** Variant label: variant_name (e.g. '50g' packets) on its own, otherwise
   *  pack weight + per-pouch MRP together, e.g. "8g · ₹5/pkt". */
  variantLabel(item: CatalogItem): string {
    if (item.variant_name) return item.variant_name;
    const parts: string[] = [];
    if (item.quantity_per_unit) parts.push(`${item.quantity_per_unit}g`);
    if (item.mrp_per_unit) parts.push(`₹${item.mrp_per_unit}${this.t('perPkt')}`);
    return parts.join(' · ');
  }

  variant(item: CatalogItem): string { return this.variantLabel(item); }

  // ── Price / saving / weight display ───────────────────────────────────────
  /** Cheapest variant price in a product group. */
  groupMinPrice(group: ItemGroup): number {
    return Math.min(...group.variants.map((v) => v.price_per_sheet));
  }

  /** Card price label: a range across the group's sizes, e.g. "₹45–₹180"
   *  (collapses to a single price when the product has only one size). */
  groupPriceLabel(group: ItemGroup): string {
    const prices = group.variants.map((v) => v.price_per_sheet);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    return lo === hi ? `₹${lo}` : `₹${lo}–₹${hi}`;
  }

  /** Hero hook with the live catalog-wide sheet price range filled in. */
  heroHookText = computed(() => {
    const prices = this.catalog().map((i) => i.price_per_sheet).filter((p) => p > 0);
    if (!prices.length) return '';
    return this.t('heroHook')
      .replace('{a}', String(Math.min(...prices)))
      .replace('{b}', String(Math.max(...prices)));
  });

  /** MRP value of a whole sheet: printed per-pouch MRP × pouches in the sheet. */
  mrpSheetValue(item: CatalogItem): number {
    if (item.sale_mode === 'packet') return 0;
    if (!item.mrp_per_unit || !item.units_per_sheet) return 0;
    return Math.round(item.mrp_per_unit * item.units_per_sheet);
  }

  /** Rupees saved against MRP for one sheet (0 when there is no real saving). */
  savingFor(item: CatalogItem): number {
    const mrp = this.mrpSheetValue(item);
    if (!mrp) return 0;
    return Math.max(0, mrp - item.price_per_sheet);
  }

  /** Saving as a whole percentage, e.g. 25. */
  savingPct(item: CatalogItem): number {
    const mrp = this.mrpSheetValue(item);
    if (!mrp) return 0;
    return Math.round((this.savingFor(item) / mrp) * 100);
  }

  /** Best discount across a product group — shown on the card. */
  groupMaxSavingPct(group: ItemGroup): number {
    return Math.max(0, ...group.variants.map((v) => this.savingPct(v)));
  }

  /**
   * Total weight of a sheet, e.g. "180g". Returns '' when the pack weight is
   * unset — deliberate for variable-rate items (Garam Masala, Cardamom, Clove,
   * Black Pepper), whose gram weight moves with the market. Weight is an
   * optional field on this page; never render a "0g".
   */
  totalWeightLabel(item: CatalogItem): string {
    if (item.sale_mode === 'packet') return '';
    const total = (item.quantity_per_unit || 0) * (item.units_per_sheet || 0);
    return total > 0 ? `${total}g` : '';
  }

  /**
   * Pack summary shown under the price, e.g. "12 pkt in sheet · 180g".
   * The weight half is dropped entirely when the pack weight is unset.
   */
  packLabel(item: CatalogItem): string {
    const parts = [`${item.units_per_sheet} ${this.t('packsInSheet')}`];
    const weight = this.totalWeightLabel(item);
    if (weight) parts.push(weight);
    return parts.join(' · ');
  }

  // ── Bulk rate card (informational) ────────────────────────────────────────
  /**
   * Printed pamphlet slabs, shown for reference only — the cart always charges
   * tier 1. Bulk rates are settled when the order is confirmed on WhatsApp.
   */
  readonly slabTables = [
    {
      titleKey: 'bulkSheet12',
      headers: ['₹5', '₹10', '₹20'],
      rows: [
        { range: '1–10',  prices: [45, 90, 180] },
        { range: '11–50', prices: [43, 85, 170] },
        { range: '51+',   prices: [40, 80, 160] },
      ],
    },
    {
      titleKey: 'bulkSheet10',
      headers: ['₹5', '₹10'],
      rows: [
        { range: '1–10',  prices: [38, 75] },
        { range: '11–50', prices: [36, 71] },
        { range: '51+',   prices: [33, 67] },
      ],
    },
  ];

  showSlabs = signal(false);
  toggleSlabs(): void { this.showSlabs.update((v) => !v); }

  showTopBtn = signal(false);

  onScroll(): void {
    this.showTopBtn.set(window.scrollY > 900);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  // ── Add to home screen ────────────────────────────────────────────────────
  /** Chrome/Android fire this instead of showing their own banner; iOS never
   *  fires it, so the card simply never appears there rather than lying. */
  private deferredInstall: any = null;
  canInstall = signal(false);

  private initInstallPrompt(): void {
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredInstall = e;
      this.canInstall.set(true);
    });
  }

  installApp(): void {
    const evt = this.deferredInstall;
    if (!evt) return;
    evt.prompt();
    evt.userChoice?.finally(() => {
      this.deferredInstall = null;
      this.canInstall.set(false);
    });
  }

  dismissInstall(): void {
    this.canInstall.set(false);
    try { localStorage.setItem(INSTALL_DISMISS_KEY, '1'); } catch { /* private mode */ }
  }

  /** Open WhatsApp with a prefilled message for a given i18n message key. */
  private waWith(msgKey: string): void {
    window.open(
      `https://wa.me/${environment.ownerWhatsapp}?text=${encodeURIComponent(this.t(msgKey))}`,
      '_blank',
    );
  }

  askCustomPack(): void { this.waWith('customMsg'); }

  askQuestion(): void { this.waWith('enquiryMsg'); }

  /** Public storefront link — the thing customers actually forward. */
  private storeUrl(): string {
    return `${location.origin}/customer`;
  }

  /**
   * Share the shop. Uses the native share sheet where the browser has one
   * (Android/iOS give WhatsApp, SMS, etc.), else falls back to a WhatsApp
   * deep-link so it still works on desktop.
   */
  shareStore(): void {
    const text = `${this.t('shareMsg')}\n${this.storeUrl()}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      nav.share({ title: 'DesiMasalaHub', text: this.t('shareMsg'), url: this.storeUrl() }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  /** Items from the last order that are still in the catalog. */
  reorderItems = computed(() => {
    const ids = new Set(this.catalog().map((i) => i.id));
    return this.lastOrder().filter((l) => ids.has(l.id));
  });

  canReorder = computed(() => this.reorderItems().length > 0 && this.cartCount() === 0);

  reorder(): void {
    const next = new Map<string, number>();
    for (const l of this.reorderItems()) next.set(l.id, l.sheets);
    this.cart.set(next);
  }

  private loadDetails(): { name: string; phone: string; address: string } {
    try {
      const raw = localStorage.getItem(DETAILS_KEY);
      const d = raw ? JSON.parse(raw) : null;
      return { name: d?.name ?? '', phone: d?.phone ?? '', address: d?.address ?? '' };
    } catch {
      return { name: '', phone: '', address: '' };
    }
  }

  private loadLastOrder(): Array<{ id: string; sheets: number }> {
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ── Category tabs ─────────────────────────────────────────────────────────
  readonly catDefs = [
    { name: 'Whole Spices',      hindi: 'साबुत मसाले',         emoji: '🌿' },
    { name: 'Masala Powder',     hindi: 'मसाला पाउडर',        emoji: '🌶️' },
    { name: 'Mix Masala Whole',  hindi: 'मिक्स मसाला (साबुत)', emoji: '🫙' },
    { name: 'Dry Fruits',        hindi: 'ड्राई फ्रूट्स',       emoji: '🥜' },
  ];

  selectedCategory = signal('Whole Spices');

  selectCategory(name: string): void {
    this.selectedCategory.set(name);
    this.searchQuery.set('');
  }

  isSearching = computed(() => this.searchQuery().trim().length > 0);

  categoryCount = computed(() => {
    // Count unique product names per category (variants of same name = 1 product)
    const groups = new Map<string, Set<string>>();
    for (const item of this.catalog()) {
      const cat = item.category || '';
      if (!groups.has(cat)) groups.set(cat, new Set());
      groups.get(cat)!.add(item.item_name.toLowerCase().trim());
    }
    const result = new Map<string, number>();
    groups.forEach((names, cat) => result.set(cat, names.size));
    return result;
  });

  countFor(catName: string): number {
    return this.categoryCount().get(catName) ?? 0;
  }

  activeItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.catalog();
    if (q) {
      return all.filter((i) =>
        i.item_name.toLowerCase().includes(q) ||
        (i.hindi_name ?? '').toLowerCase().includes(q) ||
        (i.search_aliases ?? '').toLowerCase().includes(q)
      );
    }
    return all.filter((i) => i.category === this.selectedCategory());
  });

  selectedCategoryDef = computed(() =>
    this.catDefs.find((c) => c.name === this.selectedCategory())
  );

  groupedItems = computed<ItemGroup[]>(() => {
    const order = new Map<string, ItemGroup>();
    for (const item of this.activeItems()) {
      const key = item.item_name.toLowerCase().trim();
      if (!order.has(key)) {
        order.set(key, { item_name: item.item_name, hindi_name: item.hindi_name, category: item.category, variants: [] });
      }
      order.get(key)!.variants.push(item);
    }
    return [...order.values()];
  });

  groupInCart(group: ItemGroup): boolean {
    return group.variants.some(v => (this.cart().get(v.id) ?? 0) > 0);
  }

  groupCartQty(group: ItemGroup): number {
    return group.variants.reduce((sum, v) => sum + (this.cart().get(v.id) ?? 0), 0);
  }

  openSheet(group: ItemGroup): void {
    this.activeGroup.set(group);
  }

  closeSheet(): void {
    this.activeGroup.set(null);
  }

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

  /** Sheets still needed to earn the free sheet (0 once earned). */
  freeSheetRemaining = computed(() => Math.max(0, FREE_SHEET_AT - this.cartCount()));
  earnedFreeSheet    = computed(() => this.cartCount() >= FREE_SHEET_AT);
  offerText = computed(() =>
    this.earnedFreeSheet()
      ? this.t('offerEarned')
      : this.t('offerProgress').replace('{x}', String(this.freeSheetRemaining()))
  );

  freeDeliveryRemaining = computed(() => Math.max(0, FREE_DELIVERY_THRESHOLD - this.cartTotal()));
  qualifiesFreeDelivery = computed(() => this.cartTotal() >= FREE_DELIVERY_THRESHOLD && this.cartTotal() > 0);

  // Flat ₹20 delivery fee, waived once subtotal crosses the free-delivery threshold.
  deliveryFee = computed(() => (this.cartCount() === 0 || this.qualifiesFreeDelivery()) ? 0 : DELIVERY_FEE);
  grandTotal  = computed(() => this.cartTotal() + this.deliveryFee());

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.initInstallPrompt();
    this.loadCatalog();
  }

  /**
   * Load the catalog. A failure is shown as a retryable connection error, not
   * as an empty shop — on patchy rural data "no spices found" reads as
   * "they are sold out" and the customer leaves.
   */
  loadCatalog(): void {
    this.catalogError.set(false);
    this.catalogLoading.set(true);
    this.loading.show();
    this.orderService.getCatalog().subscribe({
      next: (items) => {
        this.catalog.set(items);
        this.pruneCart(items);
      },
      error: (err) => {
        console.error('Catalog load failed:', err);
        // Deliberately does NOT prune the cart — a failed request is no
        // evidence that anything went out of stock.
        this.catalogError.set(true);
        this.catalogLoading.set(false);
        this.loading.hide();
      },
      complete: () => {
        this.catalogLoading.set(false);
        this.loading.hide();
      },
    });
  }

  /**
   * Drop cart entries whose item is no longer in the catalog. Carts persist in
   * localStorage indefinitely, so a product taken off sale (in_stock=false)
   * would otherwise stay in an old cart: it counts toward cartCount but
   * contributes nothing to cartTotal and never appears in cartLines, which let
   * a customer place an itemless order that still charged delivery.
   * Only runs after a successful catalog load — never on a failed one.
   */
  private pruneCart(items: CatalogItem[]): void {
    const live = new Set(items.map((i) => i.id));
    const current = this.cart();
    let changed = false;
    const next = new Map<string, number>();
    current.forEach((qty, id) => {
      if (live.has(id)) next.set(id, qty);
      else changed = true;
    });
    if (changed) this.cart.set(next);
  }

  // ── Cart ─────────────────────────────────────────────────────────────────
  getQty(id: string): number {
    return this.cart().get(id) ?? 0;
  }

  increment(item: CatalogItem): void {
    this.cart.update((m) => {
      const next = new Map(m);
      const cur = next.get(item.id) ?? 0;
      // Orders are WhatsApp deep-links; sales are never blocked on stock. Cap at a
      // sane max instead of total_stock (which is informational, often 0).
      if (cur < 99) next.set(item.id, cur + 1);
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
    if (this.cartLines().length === 0) return;
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
    // cartCount() counts raw cart entries; cartLines() only contains items that
    // still exist in the catalog. Guard on the latter so an order can never be
    // sent with an empty item list.
    if (this.cartLines().length === 0) {
      this.formError.set(this.t('cartStale'));
      return;
    }

    this.submitting.set(true);

    // Build the owner's order message. This is the ONLY record of an order —
    // there is no server-side order document — so it must carry everything
    // needed to pack and deliver without a follow-up chat.
    const lines = this.cartLines()
      .map((l, i) => {
        const baseName = l.item.hindi_name ? `${l.item.item_name} (${l.item.hindi_name})` : l.item.item_name;
        const variant = l.item.mrp_per_unit ? ` ₹${l.item.mrp_per_unit} pack` : '';
        // Pouch count matters for picking: a "sheet" is 12 or 10 pouches.
        const pouches = l.item.sale_mode === 'packet'
          ? `${l.sheets} pkt`
          : `${l.sheets} sheet × ${l.item.units_per_sheet} pkt`;
        return `${i + 1}. ${baseName}${variant}\n   ${pouches} @ ₹${l.item.price_per_sheet} = ₹${l.sheets * l.item.price_per_sheet}`;
      })
      .join('\n');

    const deliveryLine = this.deliveryFee() === 0
      ? 'Delivery: FREE'
      : `Delivery: ₹${this.deliveryFee()}`;

    const sheets = this.cartCount();

    // The storefront charges the 1–10 slab and tells the customer the bulk rate
    // is applied at delivery. Without this flag the owner would never know the
    // order qualified, and that promise would silently break.
    const slabNote =
      sheets >= 51 ? '*BULK RATE:* 51+ sheets - apply the 51+ slab rate at delivery'
      : sheets >= 11 ? '*BULK RATE:* 11-50 sheets - apply the 11-50 slab rate at delivery'
      : '';

    // Same for the printed 25-sheet offer.
    const offerNote = sheets >= FREE_SHEET_AT
      ? '*OFFER:* 25+ sheets - include 1 FREE ₹5 sheet'
      : '';

    // A tappable map link for the delivery boy. "Use current location" already
    // appends a pin, so only build one from the typed address when it has not.
    const mapLine = /https?:\/\//.test(address)
      ? ''
      : `Map: https://maps.google.com/?q=${encodeURIComponent(address)}`;

    const stamp = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    // NOTE: deliberately no emoji. Emoji above U+FFFF (shopping cart, phone,
    // pin, etc.) are surrogate pairs and arrived in WhatsApp as U+FFFD
    // replacement characters. BMP characters (₹, ×, Devanagari) come through
    // fine, so the message uses plain bold labels instead. Do not reintroduce
    // emoji here without testing on a real device.
    const msg = [
      '*NEW ORDER - DesiMasalaHub*',
      stamp,
      '',
      '*Items:*',
      lines,
      '',
      `Total sheets: ${sheets}`,
      `Subtotal: ₹${this.cartTotal()}`,
      deliveryLine,
      `*Total: ₹${this.grandTotal()}*`,
      ...(slabNote ? ['', slabNote] : []),
      ...(offerNote ? [offerNote] : []),
      '',
      '*Deliver to:*',
      `Name: ${name}`,
      `Phone: +91 ${phone}`,
      `Address: ${address}`,
      ...(mapLine ? [mapLine] : []),
    ].join('\n');

    this.ownerWaUrl.set(`https://wa.me/${environment.ownerWhatsapp}?text=${encodeURIComponent(msg)}`);

    // Auto-open WhatsApp (single window.open as a direct result of the click — no popup blocker).
    this.sendWhatsapp();

    // Remember the order and the delivery details so the next visit is one tap.
    const remembered = this.cartLines().map((l) => ({ id: l.item.id, sheets: l.sheets }));
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(remembered));
      this.lastOrder.set(remembered);
      localStorage.setItem(DETAILS_KEY, JSON.stringify({ name, phone, address }));
      this.hasSavedDetails.set(true);
    } catch {
      // storage unavailable (private mode) — reorder/prefill simply won't happen
    }

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
    this.formError.set('');
    // Deliberately keeps name/phone/address — it is the same customer ordering
    // again, and retyping an address is the most tedious part of the flow.
  }

  /** Forget the saved delivery details (shared phone, wrong address, etc.). */
  clearDetails(): void {
    this.custName.set('');
    this.custPhone.set('');
    this.custAddress.set('');
    this.hasSavedDetails.set(false);
    try { localStorage.removeItem(DETAILS_KEY); } catch { /* private mode */ }
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
