import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sale } from '../models/sale.model';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private http = inject(HttpClient);

  createSale(data: {
    delivery_boy_id: string;
    items: { item_id: string; qty: number; price: number }[];
    total_amount: number;
    payment_mode: 'cash' | 'online';
    shop_name?: string;
    shop_mobile?: string;
  }) {
    return this.http.post<Sale>('/sale', data);
  }

  getSalesHistory(deliveryBoyId: string) {
    return this.http.get<Sale[]>(`/sale/history/${deliveryBoyId}`);
  }

  /** GET /sale/today/:id?date=YYYY-MM-DD */
  getTodaySales(deliveryBoyId: string, date?: string) {
    const q = date ? `?date=${date}` : '';
    return this.http.get<Sale[]>(`/sale/today/${deliveryBoyId}${q}`);
  }
}
