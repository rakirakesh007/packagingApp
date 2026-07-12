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
import { Router } from '@angular/router';
import { InventoryService } from '../services/inventory.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';
import { InventoryItem } from '../models/inventory.model';
import { SheetQtyPipe } from '../core/sheet-qty.pipe';
import { CATEGORIES, CategoryDef } from '../models/categories.const';

interface InventoryGroup {
  name: string;
  hindi_name: string;
  items: InventoryItem[];
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, SheetQtyPipe],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private loading = inject(GlobalLoadingService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly labelSheetConfig = {
    fssaiNo: '20426141000161',
    customerCare: '+91 8050991832',
    manufacturer: 'Desimasalahub, Jamalpur',
  };

  items      = signal<InventoryItem[]>([]);
  readonly categories: CategoryDef[] = CATEGORIES;
  searchQuery = signal('');
  isAdmin = computed(() => this.auth.userRole() === 'admin');

  filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return query
      ? this.items().filter(
          (item) =>
            item.item_name.toLowerCase().includes(query) ||
            (item.hindi_name ?? '').toLowerCase().includes(query) ||
            (item.description ?? '').toLowerCase().includes(query) ||
            (item.search_aliases ?? '').toLowerCase().includes(query)
        )
      : this.items();
  });

  // ── Accordion ─────────────────────────────────────────────────────────────
  groupedInventory = computed<InventoryGroup[]>(() => {
    const order = new Map<string, InventoryGroup>();
    for (const item of this.filteredItems()) {
      const key = item.item_name.toLowerCase().trim();
      if (!order.has(key)) {
        order.set(key, { name: item.item_name, hindi_name: item.hindi_name ?? '', items: [] });
      }
      order.get(key)!.items.push(item);
    }
    return [...order.values()];
  });

  expandedGroups = signal<Set<string>>(new Set());

  toggleGroup(name: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  isExpanded(name: string): boolean {
    return this.expandedGroups().has(name);
  }

  showItemModal = signal(false);
  modalMode = signal<'add' | 'edit'>('add');
  editingItemId = signal<string | null>(null);
  formStep = signal<'base' | 'variant'>('base');

  // Label preview
  previewItem    = signal<InventoryItem | null>(null);
  showLabelPreview = signal(false);

  get pkdDate(): string  { return this.formatPkdMonthYear(new Date()); }
  get batchNo(): string  { return this.generateBatchNumber(new Date()); }
  get sheetPreviewCards(): InventoryItem[] {
    const item = this.previewItem();
    return item ? Array<InventoryItem>(35).fill(item) : [];
  }

  formItemName = '';
  formHindiName = '';
  formDescription = '';
  formUnitsPerSheet = 10;
  formQuantityPerUnit = 0;
  formMrpPerUnit = 0;
  formWholesalePricePerSheet = 0;
  formCostPerSheet = 0;
  formFlatProfitPerPouch = 0;
  formStock = 0;
  formThreshold = 1;
  formIngredients   = '';
  formSearchAliases = '';
  formCategory      = '';
  formVariantName   = '';
  formSaleMode: 'sheet' | 'packet' = 'sheet';
  formInStock       = true;

  ngOnInit(): void {
    this.fetchItems();
  }

  fetchItems(): void {
    this.loading.show();
    this.inventoryService.getItems().subscribe({
      next: (data) => this.items.set(data),
      error: (err) => console.error('Failed to fetch inventory:', err),
      complete: () => this.loading.hide(),
    });
  }

  openAddModal(): void {
    this.modalMode.set('add');
    this.editingItemId.set(null);
    this.resetForm();
    this.formStep.set('base');
    this.showItemModal.set(true);
  }

  openEditModal(item: InventoryItem): void {
    this.modalMode.set('edit');
    this.editingItemId.set(item.id);
    this.formItemName    = item.item_name;
    this.formHindiName   = item.hindi_name ?? '';
    this.formDescription = item.description ?? '';
    this.formUnitsPerSheet          = item.units_per_sheet ?? 10;
    this.formQuantityPerUnit        = item.quantity_per_unit ?? 0;
    this.formMrpPerUnit             = item.mrp_per_unit ?? 0;
    this.formWholesalePricePerSheet = item.wholesale_price_per_sheet ?? 0;
    this.formCostPerSheet           = item.cost_per_sheet ?? 0;
    this.formFlatProfitPerPouch     = item.flat_profit_per_pouch ?? 0;
    this.formStock       = item.total_stock;
    this.formThreshold   = item.low_stock_threshold;
    this.formIngredients    = item.ingredients ?? '';
    this.formSearchAliases  = item.search_aliases ?? '';
    this.formCategory       = item.category ?? '';
    this.formVariantName    = item.variant_name ?? '';
    this.formSaleMode       = (item.sale_mode ?? 'sheet') as 'sheet' | 'packet';
    this.formInStock        = item.in_stock ?? true;
    this.formStep.set('variant');
    this.showItemModal.set(true);
  }

  closeItemModal(): void {
    this.showItemModal.set(false);
  }

  openAddVariant(group: InventoryGroup): void {
    this.modalMode.set('add');
    this.editingItemId.set(null);
    const first = group.items[0];
    this.formItemName       = first.item_name;
    this.formHindiName      = first.hindi_name ?? '';
    this.formDescription    = '';
    this.formIngredients    = first.ingredients ?? '';
    this.formSearchAliases  = first.search_aliases ?? '';
    this.formCategory       = first.category ?? '';
    this.formVariantName    = '';
    this.formSaleMode       = 'sheet';
    this.formUnitsPerSheet  = 10;
    this.formQuantityPerUnit = 0;
    this.formMrpPerUnit     = 0;
    this.formWholesalePricePerSheet = 0;
    this.formCostPerSheet           = 0;
    this.formFlatProfitPerPouch     = 0;
    this.formStock          = 0;
    this.formThreshold      = first.low_stock_threshold;
    this.formInStock        = true;
    this.formStep.set('variant');
    this.showItemModal.set(true);
  }

  openLabelPreview(item: InventoryItem): void {
    this.previewItem.set(item);
    this.showLabelPreview.set(true);
  }

  closeLabelPreview(): void {
    this.showLabelPreview.set(false);
  }

  saveItem(): void {
    if (!this.formItemName.trim()) return;
    const payload = {
      item_name:                  this.formItemName.trim(),
      hindi_name:                 this.formHindiName.trim(),
      description:                this.formDescription.trim(),
      units_per_sheet:            Number(this.formUnitsPerSheet) || 10,
      quantity_per_unit:          Number(this.formQuantityPerUnit) || 0,
      mrp_per_unit:               Number(this.formMrpPerUnit) || 0,
      wholesale_price_per_sheet:  Number(this.formWholesalePricePerSheet) || 0,
      cost_per_sheet:             Number(this.formCostPerSheet) || 0,
      flat_profit_per_pouch:      Number(this.formFlatProfitPerPouch) || 0,
      total_stock:                Number(this.formStock) || 0,
      low_stock_threshold:        Number(this.formThreshold) || 0,
      ingredients:                this.formIngredients.trim(),
      search_aliases:             this.formSearchAliases.trim(),
      category:                   this.formCategory,
      variant_name:               this.formVariantName.trim(),
      sale_mode:                  this.formSaleMode,
      in_stock:                   this.formInStock,
    };

    this.loading.show();
    const request = this.modalMode() === 'edit' && this.editingItemId()
      ? this.inventoryService.updateProduct(this.editingItemId()!, payload)
      : this.inventoryService.addProduct(payload);

    request.subscribe({
      next: () => {
        this.toast.success(this.modalMode() === 'edit' ? 'Product updated.' : 'Product added.');
        this.closeItemModal();
        this.fetchItems();
      },
      error: (err) => {
        console.error('Failed to save item:', err);
        this.toast.error('Could not save product. Please try again.');
        this.loading.hide();
      },
    });
  }

  duplicateItem(item: InventoryItem): void {
    this.modalMode.set('add');
    this.editingItemId.set(null);
    this.formItemName    = item.item_name;
    this.formHindiName   = item.hindi_name ?? '';
    this.formDescription = item.description ?? '';
    this.formUnitsPerSheet          = item.units_per_sheet ?? 10;
    this.formQuantityPerUnit        = item.quantity_per_unit ?? 0;
    this.formMrpPerUnit             = item.mrp_per_unit ?? 0;
    this.formWholesalePricePerSheet = item.wholesale_price_per_sheet ?? 0;
    this.formCostPerSheet           = item.cost_per_sheet ?? 0;
    this.formFlatProfitPerPouch     = item.flat_profit_per_pouch ?? 0;
    this.formStock       = 0;
    this.formThreshold   = item.low_stock_threshold;
    this.formIngredients   = item.ingredients ?? '';
    this.formSearchAliases = item.search_aliases ?? '';
    this.formCategory      = item.category ?? '';
    this.formVariantName   = item.variant_name ?? '';
    this.formSaleMode      = (item.sale_mode ?? 'sheet') as 'sheet' | 'packet';
    this.formInStock       = item.in_stock ?? true;
    this.formStep.set('variant');
    this.showItemModal.set(true);
  }

  deleteItem(item: InventoryItem): void {
    const confirmed = window.confirm('Are you sure you want to delete this item? This action cannot be undone.');
    if (!confirmed) return;
    this.loading.show();
    this.inventoryService.deleteProduct(item.id).subscribe({
      next: () => {
        this.toast.success(`"${item.item_name}" deleted.`);
        this.fetchItems();
      },
      error: (err) => {
        console.error('Failed to delete item:', err);
        this.toast.error('Could not delete product. Please try again.');
        this.loading.hide();
      },
    });
  }

  downloadLabelSheet(items: InventoryItem[], totalCards = 35, size: 'normal' | 'big' = 'normal'): void {
    const sourceItems = items.filter(Boolean);
    if (sourceItems.length === 0) {
      window.alert('Please select at least one inventory item to print labels.');
      return;
    }

    // Navigate to label-sheet with item IDs and total count
    const itemIds = sourceItems.map((item) => item.id).join(',');
    this.router.navigate(['/label-sheet'], {
      queryParams: { itemIds, total: totalCards, size },
    });
  }

  downloadSingleLabel(item: InventoryItem): void {
    this.downloadLabelSheet([item], 1);
  }

  protected formatPkdMonthYear(date: Date): string {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month}-${year}`;
  }

  protected generateBatchNumber(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `DMH-${day}${month}${year}`;
  }

  toggleInStock(item: InventoryItem): void {
    const newVal = !(item.in_stock ?? true);
    this.inventoryService.updateProduct(item.id, { in_stock: newVal } as Partial<InventoryItem>).subscribe({
      next: () => {
        this.items.update(list => list.map(i => i.id === item.id ? { ...i, in_stock: newVal } : i));
      },
      error: () => this.toast.error('Could not update stock status.'),
    });
  }

  private resetForm(): void {
    this.formItemName   = '';
    this.formHindiName  = '';
    this.formDescription = '';
    this.formUnitsPerSheet          = 10;
    this.formQuantityPerUnit        = 0;
    this.formMrpPerUnit             = 0;
    this.formWholesalePricePerSheet = 0;
    this.formCostPerSheet           = 0;
    this.formFlatProfitPerPouch     = 0;
    this.formStock       = 0;
    this.formThreshold   = 1;
    this.formIngredients   = '';
    this.formSearchAliases = '';
    this.formCategory      = '';
    this.formVariantName   = '';
    this.formSaleMode      = 'sheet';
    this.formInStock       = true;
  }

  addItem(): void {
    this.saveItem();
  }
}
