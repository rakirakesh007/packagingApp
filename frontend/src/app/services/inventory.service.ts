import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { InventoryItem } from '../models/inventory.model';

/** Raw shape returned by MongoDB (uses _id). */
interface RawInventoryItem extends Omit<InventoryItem, 'id'> {
  _id: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);

  /** Map MongoDB _id to the frontend id field. */
  private mapItem(raw: RawInventoryItem): InventoryItem {
    return { ...raw, id: raw._id };
  }

  getItems() {
    return this.http.get<RawInventoryItem[]>('/inventory').pipe(
      map((items) => items.map(this.mapItem))
    );
  }

  getItemById(id: string) {
    return this.http.get<RawInventoryItem>(`/inventory/${id}`).pipe(
      map(this.mapItem)
    );
  }

  /** PATCH /inventory/:id — used by admin to update total_stock. */
  updateStock(id: string, newTotal: number) {
    return this.http.patch<RawInventoryItem>(`/inventory/${id}`, { total_stock: newTotal }).pipe(
      map(this.mapItem)
    );
  }

  /** POST /inventory — add a new product (admin only). */
  addProduct(product: Partial<InventoryItem>) {
    return this.http.post<RawInventoryItem>('/inventory', product).pipe(
      map(this.mapItem)
    );
  }
}
