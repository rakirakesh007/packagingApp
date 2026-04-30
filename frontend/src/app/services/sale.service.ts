import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sale } from '../models/sale.model';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private http = inject(HttpClient);

  createSale(data: {
    customer_name: string;
    items: { item_id: string; qty: number; price: number }[];
    total_amount: number;
    payment_mode: 'Cash' | 'Online';
    delivery_boy_id: string;
  }) {
    return this.http.post<Sale>('/sale', data);
  }

  getSalesHistory(deliveryBoyId: string) {
    return this.http.get<Sale[]>(`/sale/history/${deliveryBoyId}`);
  }
}