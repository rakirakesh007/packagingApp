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
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';
import { InventoryItem } from '../models/inventory.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage implements OnInit {
  private inventoryService = inject(InventoryService);
  private loading = inject(GlobalLoadingService);
  private auth = inject(AuthService);

  private readonly labelSheetConfig = {
    fssaiNo: '12345678901234',
    customerCare: '+91 8050991832',
    manufacturer: 'Desimasalahub, Jamalpur',
  };

  items = signal<InventoryItem[]>([]);
  isAdmin = computed(() => this.auth.userRole() === 'admin');

  showItemModal = signal(false);
  modalMode = signal<'add' | 'edit'>('add');
  editingItemId = signal<string | null>(null);

  formItemName = '';
  formHindiName = '';
  formDescription = '';
  formUnitsPerSheet = 10;
  formQuantityPerUnit = 0;
  formMrpPerUnit = 0;
  formProductionCostPerSheet = 0;
  formWholesalePricePerSheet = 0;
  formStock = 0;
  formThreshold = 5;

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
    this.formProductionCostPerSheet = item.production_cost_per_sheet ?? 0;
    this.formWholesalePricePerSheet = item.wholesale_price_per_sheet ?? 0;
    this.formStock     = item.total_stock;
    this.formThreshold = item.low_stock_threshold;
    this.showItemModal.set(true);
  }

  closeItemModal(): void {
    this.showItemModal.set(false);
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
      production_cost_per_sheet:  Number(this.formProductionCostPerSheet) || 0,
      wholesale_price_per_sheet:  Number(this.formWholesalePricePerSheet) || 0,
      total_stock:                Number(this.formStock) || 0,
      low_stock_threshold:        Number(this.formThreshold) || 0,
    };

    this.loading.show();
    const request = this.modalMode() === 'edit' && this.editingItemId()
      ? this.inventoryService.updateProduct(this.editingItemId()!, payload)
      : this.inventoryService.addProduct(payload);

    request.subscribe({
      next: () => {
        this.closeItemModal();
        this.fetchItems();
      },
      error: (err) => { console.error('Failed to save item:', err); this.loading.hide(); },
    });
  }

  deleteItem(item: InventoryItem): void {
    const confirmed = window.confirm('Are you sure you want to delete this item? This action cannot be undone.');
    if (!confirmed) return;
    this.loading.show();
    this.inventoryService.deleteProduct(item.id).subscribe({
      next: () => this.fetchItems(),
      error: (err) => { console.error('Failed to delete item:', err); this.loading.hide(); },
    });
  }

  async downloadLabelSheet(items: InventoryItem[], totalCards = 25): Promise<void> {
    const sourceItems = items.filter(Boolean);
    if (sourceItems.length === 0) {
      window.alert('Please select at least one inventory item to print labels.');
      return;
    }

    const [{ jsPDF }, { default: html2canvas }, logoDataUrl, vegDataUrl] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
      this.loadImageAsDataUrl('assets/new-logo.png'),
      this.loadImageAsDataUrl('assets/veg-icon.png'),
    ]);

    const cards = this.buildLabelCards(sourceItems, totalCards);
    const pkdMonthYear = this.formatPkdMonthYear(new Date());
    const batchNumber = this.generateBatchNumber(new Date());
    const fileNameProduct = this.slugifyFileName(sourceItems[0]?.item_name || 'label-sheet');
    const preview = document.createElement('div');
    const isSingleLabel = totalCards === 1;
    preview.style.position = 'fixed';
    preview.style.left = '-10000px';
    preview.style.top = '0';
    preview.style.boxSizing = 'border-box';
    preview.style.background = '#ffffff';
    preview.style.fontFamily = 'Arial, Helvetica, sans-serif';
    preview.style.color = '#111827';
    preview.style.overflow = 'hidden';
    if (isSingleLabel) {
      preview.style.width = 'fit-content';
      preview.style.padding = '0';
      preview.style.display = 'inline-block';
    } else {
      preview.style.width = '1123px';
      preview.style.height = '794px';
      preview.style.padding = '8px';
      preview.style.display = 'grid';
      preview.style.gridTemplateColumns = 'repeat(5, 1fr)';
      preview.style.gridTemplateRows = 'repeat(5, 1fr)';
      preview.style.gap = '3px';
    }

    const createText = (text: string, styles: Partial<CSSStyleDeclaration>) => {
      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, styles);
      return el;
    };

    const createCard = (item: InventoryItem) => {
      const card = document.createElement('div');
      Object.assign(card.style, {
        border: '1px solid #d1d5db',
        borderRadius: '0',
        background: '#ffffff',
        padding: isSingleLabel ? '20px' : '6px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        width: isSingleLabel ? 'fit-content' : 'auto',
        minWidth: isSingleLabel ? '300px' : '0',
        maxWidth: isSingleLabel ? '420px' : 'none',
        minHeight: isSingleLabel ? '0' : '0',
      } satisfies Partial<CSSStyleDeclaration>);

      const topRow = document.createElement('div');
      topRow.style.width = '100%';
      topRow.style.display = 'flex';
      topRow.style.justifyContent = 'space-between';
      topRow.style.alignItems = 'flex-start';
      topRow.style.marginBottom = isSingleLabel ? '14px' : '0';

      if (logoDataUrl) {
        const logo = document.createElement('img');
        logo.src = logoDataUrl;
        logo.alt = 'DesiMasalaHub logo';
        Object.assign(logo.style, {
          width: isSingleLabel ? '125px' : '44px',
          height: isSingleLabel ? '125px' : '44px',
          objectFit: 'contain',
          display: 'block',
          marginBottom: '-20px',
          marginTop: '-20px',
        } satisfies Partial<CSSStyleDeclaration>);
        topRow.appendChild(logo);
      }

      if (vegDataUrl) {
        const vegContainer = document.createElement('div');
        Object.assign(vegContainer.style, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
        } satisfies Partial<CSSStyleDeclaration>);

        const veg = document.createElement('img');
        veg.src = vegDataUrl;
        veg.alt = 'Veg icon';
        Object.assign(veg.style, {
          width: isSingleLabel ? '28px' : '16px',
          height: isSingleLabel ? '28px' : '16px',
          objectFit: 'contain',
          display: 'block',
        } satisfies Partial<CSSStyleDeclaration>);
        vegContainer.appendChild(veg);

        const vegText = document.createElement('div');
        vegText.textContent = '100% VEG';
        Object.assign(vegText.style, {
          fontSize: isSingleLabel ? '11px' : '6px',
          lineHeight: '1',
          fontWeight: '700',
          marginTop: '0px',
          textAlign: 'center',
        } satisfies Partial<CSSStyleDeclaration>);
        vegContainer.appendChild(vegText);

        topRow.appendChild(vegContainer);
      }

      const productName = item.hindi_name?.trim() || item.item_name || 'Product Name';
      const netWeight = item.units_per_sheet != null ? `${item.units_per_sheet} units/sheet` : '--';
      const mrp = item.wholesale_price_per_sheet != null ? `₹ ${item.wholesale_price_per_sheet}` : '₹ --';

      card.appendChild(topRow);
      card.appendChild(createText(productName, {
        fontSize: isSingleLabel ? '26px' : '14px',
        lineHeight: '1.25',
        fontWeight: '700',
        textAlign: 'left',
        width: '100%',
        marginBottom: isSingleLabel ? '8px' : '0',
        display: 'block',
      }));

      card.appendChild(createText(`[${item.item_name || 'Product'}]`, {
        fontSize: isSingleLabel ? '14px' : '10px',
        lineHeight: '1.5',
        fontWeight: '600',
        textAlign: 'left',
        width: '100%',
      }));
      card.appendChild(createText(`Sheet: ${netWeight} | Wholesale: ${mrp}`, {
        marginTop: '0px',
        fontSize: isSingleLabel ? '14px' : '10px',
        lineHeight: '1.6',
        fontWeight: '700',
        textAlign: 'left',
        width: '100%',
      }));
      card.appendChild(createText(`PKD: ${pkdMonthYear} | Batch: ${batchNumber}`, {
        fontSize: isSingleLabel ? '11px' : '8px',
        lineHeight: '1.6',
        textAlign: 'left',
        width: '100%',
      }));

      card.appendChild(createText('Best before 6 month of packing', {
        fontSize: isSingleLabel ? '11px' : '8px',
        lineHeight: '1.6',
        textAlign: 'left',
        width: '100%',
      }));
      // card.appendChild(createText(`FSSAI No: ${this.labelSheetConfig.fssaiNo}`, {
      //   fontSize: '8px',
      //   lineHeight: '1.5',
      //   textAlign: 'left',
      //   width: '100%',
      // }));
      // card.appendChild(createText(`Customer care: ${this.labelSheetConfig.customerCare}`, {
      //   fontSize: '8px',
      //   lineHeight: '1.5',
      //   textAlign: 'left',
      //   width: '100%',
      // }));
      // card.appendChild(createText(`Mfd. By: ${this.labelSheetConfig.manufacturer}`, {
      //   fontSize: '8px',
      //   lineHeight: '1.5',
      //   textAlign: 'left',
      //   width: '100%',
      // }));
      card.appendChild(createText(`कोई मिलावटी रंग नहीं | १००% प्राकृतिक और शुद्ध | साफ़ पैकिंग`, {
        fontSize: isSingleLabel ? '11px' : '8px',
        lineHeight: '1.6',
        fontWeight: '600',
        textAlign: 'left',
        width: '100%',
        marginTop: isSingleLabel ? '8px' : '0',
      }));
      return card;
    };

    cards.forEach((item) => preview.appendChild(createCard(item)));
    document.body.appendChild(preview);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const canvas = await html2canvas(preview, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const imageData = canvas.toDataURL('image/png');

      const pdf = isSingleLabel
        ? new jsPDF({
            orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height],
            compress: true,
          })
        : new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4',
            compress: true,
          });

      if (isSingleLabel) {
        pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
      } else {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        pdf.addImage(imageData, 'PNG', margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);
      }
      pdf.save(`${fileNameProduct}-${batchNumber}.pdf`);
    } finally {
      preview.remove();
    }
  }

  async downloadSingleLabel(item: InventoryItem): Promise<void> {
    await this.downloadLabelSheet([item], 1);
  }

  private buildLabelCards(items: InventoryItem[], totalCards: number): InventoryItem[] {
    if (items.length === 0) return [];
    const cards: InventoryItem[] = [];
    for (let index = 0; index < totalCards; index += 1) {
      cards.push(items[index % items.length]);
    }
    return cards;
  }

  private formatPkdMonthYear(date: Date): string {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month}-${year}`;
  }

  private generateBatchNumber(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `DMH-${day}${month}${year}`;
  }

  private slugifyFileName(value: string): string {
    return value
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private async loadImageAsDataUrl(src: string): Promise<string | null> {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error(`Failed to read image: ${src}`));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Failed to load label image ${src}:`, error);
      return null;
    }
  }

  private resetForm(): void {
    this.formItemName   = '';
    this.formHindiName  = '';
    this.formDescription = '';
    this.formUnitsPerSheet          = 10;    this.formQuantityPerUnit        = 0;
    this.formMrpPerUnit             = 0;    this.formProductionCostPerSheet = 0;
    this.formWholesalePricePerSheet = 0;
    this.formStock     = 0;
    this.formThreshold = 5;
  }

  addItem(): void {
    this.saveItem();
  }
}
