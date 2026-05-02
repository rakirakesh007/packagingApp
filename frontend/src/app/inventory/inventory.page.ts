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

  items = signal<InventoryItem[]>([]);
  isAdmin = computed(() => this.auth.userRole() === 'admin');

  // Add item form state
  showAddForm = signal(false);
  newItemName      = '';
  newUnitPrice     = 0;
  newPurchasePrice = 0;
  newStock         = 0;
  newThreshold     = 5;

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

  manageStock(item: InventoryItem): void {
    const newQty = prompt(
      `Enter new stock quantity for ${item.item_name}:`,
      String(item.total_stock)
    );
    if (newQty !== null && !isNaN(Number(newQty))) {
      this.loading.show();
      this.inventoryService.updateStock(item.id, Number(newQty)).subscribe({
        next: () => this.fetchItems(),
        error: (err) => { console.error('Failed to update stock:', err); this.loading.hide(); },
      });
    }
  }

  addItem(): void {
    if (!this.newItemName || !this.newUnitPrice) return;
    this.loading.show();
    this.inventoryService.addProduct({
      item_name: this.newItemName,
      unit_price: this.newUnitPrice,
      purchase_price: this.newPurchasePrice,
      total_stock: this.newStock,
      low_stock_threshold: this.newThreshold,
    }).subscribe({
      next: () => {
        this.showAddForm.set(false);
        this.newItemName = '';
        this.newUnitPrice = 0;
        this.fetchItems();
      },
      error: (err) => { console.error('Failed to add item:', err); this.loading.hide(); },
    });
  }
}
