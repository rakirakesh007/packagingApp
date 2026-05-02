import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Shop {
  _id: string;
  name: string;
  mobile: string;
  address: string;
  total_orders_count: number;
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private http = inject(HttpClient);

  getAll()                   { return this.http.get<Shop[]>('/shops'); }
  searchByMobile(mobile: string) { return this.http.get<Shop | null>(`/shops/search?mobile=${mobile}`); }
  create(data: Partial<Shop>){ return this.http.post<Shop>('/shops', data); }
}
