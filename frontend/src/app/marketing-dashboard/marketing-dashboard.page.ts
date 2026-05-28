import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlobalLoadingService } from '../services/global-loading.service';
import { MarketingService } from '../services/marketing.service';
import { MarketingOverview, MarketingShop, MarketingTemplate, MarketingTemplateCategory } from '../models/marketing.model';

type MarketingTab = 'broadcast' | 'templates' | 'shops';

@Component({
  selector: 'app-marketing-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketing-dashboard.page.html',
  styleUrls: ['./marketing-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingDashboardPage implements OnInit {
  private loading = inject(GlobalLoadingService);
  private marketing = inject(MarketingService);

  activeTab = signal<MarketingTab>('broadcast');
  selectedMonth = signal(this.currentMonthKey());
  overview = signal<MarketingOverview | null>(null);
  selectedTemplateId = signal('');
  selectedShopIndex = signal(0);
  searchTerm = signal('');

  templateId: string | null = null;
  templateTitle = '';
  templateCategory: MarketingTemplateCategory = 'general';
  templateBody = this.defaultTemplateBody();
  templateIsActive = true;

  selectedMonthLabel = computed(() => {
    const [year, month] = this.selectedMonth().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  });

  totalShopsLabel = computed(() => this.overview()?.totals.totalShops ?? 0);
  totalBroadcastTargetsLabel = computed(() => this.overview()?.totals.totalBroadcastTargets ?? 0);
  activeShopsLabel = computed(() => this.overview()?.totals.activeShops ?? 0);
  totalMonthlySalesLabel = computed(() => this.overview()?.totals.totalMonthlySales ?? 0);
  selectedTemplateTitle = computed(() => this.selectedTemplate()?.title || 'Default Follow-up Message');
  selectedTemplateCategoryLabel = computed(() => this.selectedTemplate()?.category || 'general');

  filteredShops = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const shops = this.overview()?.shops ?? [];
    if (!term) return shops;
    return shops.filter((shop) => {
      return [shop.name, shop.mobile, shop.address].some((value) => value.toLowerCase().includes(term));
    });
  });

  selectedTemplate = computed(() => {
    const templates = this.overview()?.templates ?? [];
    const selectedId = this.selectedTemplateId();
    return templates.find((template) => template._id === selectedId) ?? templates[0] ?? null;
  });

  currentShop = computed(() => {
    const shops = this.filteredShops();
    if (!shops.length) return null;
    const index = Math.min(this.selectedShopIndex(), shops.length - 1);
    return shops[index] ?? null;
  });

  messagePreview = computed(() => this.renderMessage(this.currentShop()));

  ngOnInit(): void {
    this.loadOverview();
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private splitMonthKey(monthKey: string): { year: number; month: number } {
    const [year, month] = monthKey.split('-').map(Number);
    return { year, month };
  }

  private defaultTemplateBody(): string {
    return 'Namaste [[name]],\n\nThis is a quick update from DesiMasalaHub for [[month_name]].\nYour shop is one of our valued partners.\n\nOrders this month: [[monthly_sales]]\nTotal billing: ₹[[monthly_amount]]\nLast order date: [[last_order_date]]\n\nReply here for the next order or any special offer.\n\nThanks,\nDesiMasalaHub';
  }

  private loadOverview(): void {
    this.loading.show();
    const { year, month } = this.splitMonthKey(this.selectedMonth());
    this.marketing.getOverview(month, year).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        const firstTemplate = overview.templates[0];
        if (!this.selectedTemplateId() && firstTemplate) {
          this.selectedTemplateId.set(firstTemplate._id);
        }
        if (this.templateId && overview.templates.every((template) => template._id !== this.templateId)) {
          this.resetTemplateForm();
        }
        this.selectedShopIndex.set(0);
      },
      error: (error) => console.error('Failed to fetch marketing overview:', error),
      complete: () => this.loading.hide(),
    });
  }

  refreshOverview(): void {
    this.loadOverview();
  }

  onMonthChange(monthKey: string): void {
    this.selectedMonth.set(monthKey);
    this.loadOverview();
  }

  setTab(tab: MarketingTab): void {
    this.activeTab.set(tab);
  }

  setSelectedTemplate(template: MarketingTemplate): void {
    this.selectedTemplateId.set(template._id);
    this.templateId = template._id;
    this.templateTitle = template.title;
    this.templateCategory = template.category;
    this.templateBody = template.body;
    this.templateIsActive = template.isActive;
  }

  resetTemplateForm(): void {
    this.templateId = null;
    this.templateTitle = '';
    this.templateCategory = 'general';
    this.templateBody = this.defaultTemplateBody();
    this.templateIsActive = true;
  }

  saveTemplate(): void {
    const payload = {
      title: this.templateTitle.trim(),
      category: this.templateCategory,
      body: this.templateBody.trim(),
      isActive: this.templateIsActive,
    };

    if (!payload.title || !payload.body) {
      return;
    }

    this.loading.show();
    const request$ = this.templateId
      ? this.marketing.updateTemplate(this.templateId, payload)
      : this.marketing.createTemplate(payload);

    request$.subscribe({
      next: (template) => {
        this.selectedTemplateId.set(template._id);
        this.resetTemplateForm();
        this.loadOverview();
      },
      error: (error) => console.error('Failed to save template:', error),
      complete: () => this.loading.hide(),
    });
  }

  deleteTemplate(template: MarketingTemplate): void {
    if (!confirm(`Delete template \"${template.title}\"?`)) return;

    this.loading.show();
    this.marketing.deleteTemplate(template._id).subscribe({
      next: () => {
        if (this.selectedTemplateId() === template._id) {
          this.selectedTemplateId.set('');
        }
        this.resetTemplateForm();
        this.loadOverview();
      },
      error: (error) => console.error('Failed to delete template:', error),
      complete: () => this.loading.hide(),
    });
  }

  selectShop(index: number): void {
    this.selectedShopIndex.set(index);
    const shop = this.currentShop();
    if (shop) {
      this.searchTerm.set(shop.name);
    }
  }

  searchChanged(term: string): void {
    this.searchTerm.set(term);
    this.selectedShopIndex.set(0);
  }

  clearShopFilter(): void {
    this.searchTerm.set('');
    this.selectedShopIndex.set(0);
  }

  nextShop(): void {
    const shops = this.filteredShops();
    if (!shops.length) return;
    this.selectedShopIndex.set((this.selectedShopIndex() + 1) % shops.length);
  }

  previousShop(): void {
    const shops = this.filteredShops();
    if (!shops.length) return;
    this.selectedShopIndex.set((this.selectedShopIndex() - 1 + shops.length) % shops.length);
  }

  sendWhatsApp(shop: MarketingShop | null): void {
    if (!shop?.mobile) return;
    const message = this.renderMessage(shop);
    const digits = this.sanitizeMobile(shop.mobile);
    if (!digits) return;

    const selectedTemplate = this.selectedTemplate();
    if (selectedTemplate) {
      this.marketing.markTemplateUsed(selectedTemplate._id).subscribe({
        error: (error) => console.error('Failed to track template usage:', error),
      });
    }

    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(message)}`, '_blank');
  }

  sendCurrentAndNext(): void {
    const shop = this.currentShop();
    if (!shop) return;
    this.sendWhatsApp(shop);
    this.nextShop();
  }

  useTemplateForPreview(template: MarketingTemplate): void {
    this.selectedTemplateId.set(template._id);
  }

  private renderMessage(shop: MarketingShop | null): string {
    const template = this.selectedTemplate();
    const body = template?.body?.trim() || this.templateBody.trim() || this.defaultTemplateBody();
    if (!shop) return body;

    const monthLabel = this.selectedMonthLabel();
    const lastOrderDate = shop.lastOrderAt
      ? new Date(shop.lastOrderAt).toLocaleDateString('en-IN')
      : 'No recent order';

    const replacements: Record<string, string> = {
      name: shop.name,
      mobile: shop.mobile,
      address: shop.address,
      total_orders: String(shop.totalOrdersCount),
      monthly_sales: String(shop.monthlySalesCount),
      monthly_amount: `₹${Math.round(shop.monthlySalesTotal)}`,
      last_order_date: lastOrderDate,
      month_name: monthLabel,
      total_shops: String(this.overview()?.totals.totalShops ?? 0),
    };

    return body.replace(/\[\[(\w+)\]\]/g, (_match, token: string) => replacements[token] ?? '');
  }

  private sanitizeMobile(value: string): string {
    return value.replace(/\D/g, '').replace(/^91/, '').slice(-10);
  }

  trackByTemplate(_index: number, template: MarketingTemplate): string {
    return template._id;
  }

  trackByShop(_index: number, shop: MarketingShop): string {
    return shop.shopId;
  }

  formatLastOrder(value?: string | null): string {
    return value ? new Date(value).toLocaleDateString('en-IN') : '—';
  }
}
