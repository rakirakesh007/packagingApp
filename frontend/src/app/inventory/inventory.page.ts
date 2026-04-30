import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../services/inventory.service';
import { LoadingService } from '../services/loading.service';
import { InventoryItem } from '../models/inventory.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private inventoryService = inject(InventoryService);
  private loadingService = inject(LoadingService);

  items = signal<InventoryItem[]>([]);
  isAdminUser = false;

  isAdmin() {
    return this.isAdminUser;
  }

  manageStock(item: InventoryItem) {
    const newQty = prompt(`Enter new stock quantity for ${item.item_name}:`, String(item.total_stock));
    if (newQty !== null) {
      this.inventoryService.updateStock(item.id, Number(newQty)).subscribe({
        next: () => this.fetchItems(),
        error: (err) => console.error('Failed to update stock:', err),
      });
    }
  }

  constructor() {
    this.fetchItems();
  }

  fetchItems() {
    this.loadingService.set(true);
    this.inventoryService
      .getItems()
      .subscribe({
        next: (data) => this.items.set(data),
        error: (err) => console.error('Failed to fetch inventory:', err),
        complete: () => this.loadingService.set(false),
      });
  }
}