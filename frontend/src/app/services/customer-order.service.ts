import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** A storefront catalog item (public, in-stock). */
export interface CatalogItem {
  id: string;
  item_name: string;
  hindi_name: string;
  units_per_sheet: number;
  price_per_sheet: number;
  sheets_available: number;
  search_aliases: string;
  mrp_per_unit: number;
  image_url: string | null;
  category: string;
  variant_name: string;
  quantity_per_unit: number;
  sale_mode: 'sheet' | 'packet';
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderService {
  private http = inject(HttpClient);

  /** Public in-stock catalog (no auth required). */
  getCatalog() {
    return this.http.get<CatalogItem[]>('/public/catalog');
  }
}
