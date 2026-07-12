import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { InventoryService } from '../services/inventory.service';
import { InventoryItem } from '../models/inventory.model';

@Component({
  selector: 'app-label-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './label-sheet.component.html',
  styleUrls: ['./label-sheet.component.scss'],
})
export class LabelSheetComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);

  items = signal<InventoryItem[]>([]);
  totalLabels = signal(0);
  labelSize = signal<'normal' | 'big'>('normal');
  hasIngredients = computed(() => this.items().some(i => !!i.ingredients));
  logoDataUrl = signal<string | null>(null);
  vegDataUrl = signal<string | null>(null);

  labels = computed(() => {
    const itemList = this.items();
    const total = this.totalLabels();
    
    // If no items but total > 0, return array of nulls (for placeholder rendering)
    if (itemList.length === 0 && total > 0) {
      return Array(total).fill(null);
    }
    
    // If items exist, repeat them to fill total
    if (itemList.length > 0 && total > 0) {
      const result: InventoryItem[] = [];
      for (let i = 0; i < total; i += 1) {
        result.push(itemList[i % itemList.length]);
      }
      return result;
    }
    
    return [];
  });

  pkdMonthYear = computed(() => {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const date = new Date();
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${year}`;
  });

  batchNumber = computed(() => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `DMH-${day}${month}${year}`;
  });

  readonly labelSheetConfig = {
    fssaiNo: '20426141000161',
  };

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const itemIds = params['itemIds'] ? params['itemIds'].split(',') : [];
      const isBig = params['size'] === 'big';
      this.labelSize.set(isBig ? 'big' : 'normal');
      // Big labels render 4 per row; normal 5. Round up to a full row — no partial rows.
      const cols = isBig ? 4 : 5;
      const total = params['total'] ? parseInt(params['total'], 10) : 35;
      const paddedTotal = Math.ceil(Math.max(total, cols) / cols) * cols;

      if (itemIds.length > 0) {
        this.inventoryService.getItemsByIds(itemIds).subscribe({
          next: (fetched) => {
            this.items.set(fetched);
            const hasIngr = fetched.some(i => !!i.ingredients);
            if (isBig) {
              this.totalLabels.set(hasIngr ? 16 : 20);
            } else {
              this.totalLabels.set(hasIngr ? 35 : 55);
            }
          },
          error: (err) => {
            console.error('Failed to fetch items:', err);
            this.totalLabels.set(paddedTotal);
          },
        });
      } else {
        this.totalLabels.set(paddedTotal);
      }

      // Load logo and veg images
      this.loadImages();
    });
  }

  private loadImages(): void {
    const logoImg = new Image();
    logoImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.width;
      canvas.height = logoImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(logoImg, 0, 0);
        this.logoDataUrl.set(canvas.toDataURL('image/png'));
      }
    };
    logoImg.onerror = () => {
      console.warn('Failed to load logo image');
      this.logoDataUrl.set(null);
    };
    logoImg.src = 'assets/color-logo.png';

    const vegImg = new Image();
    vegImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = vegImg.width;
      canvas.height = vegImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vegImg, 0, 0);
        this.vegDataUrl.set(canvas.toDataURL('image/png'));
      }
    };
    vegImg.onerror = () => {
      console.warn('Failed to load veg icon image');
      this.vegDataUrl.set(null);
    };
    vegImg.src = 'assets/veg-icon.png';
  }

  formatPkdMonthYear(date: Date): string {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month}-${year}`;
  }
}
