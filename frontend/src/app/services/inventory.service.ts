import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InventoryItem } from '../models/inventory-item.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);

  getItems() {
    return this.http.get<InventoryItem[]>('/inventory');
  }

  getItemById(id: string) {
    return this.http.get<InventoryItem>(`/inventory/${id}`);
  }

  updateStock(id: string, newTotal: number) {
    return this.http.patch(`/inventory/${id}`, { total_stock: newTotal });
  }

  addProduct(product: Partial<InventoryItem>) {
    return this.http.post('/inventory', product);
  }
}