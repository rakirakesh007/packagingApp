export interface InventoryItem {
  id: string;
  item_name: string;
  hindi_name?: string;
  description?: string;
  // units_per_sheet: number of individual units per sheet (e.g. 10 or 12 packets)
  units_per_sheet: number;
  // quantity_per_unit: weight/volume per individual unit in grams (e.g. 100g)
  quantity_per_unit?: number;
  // mrp_per_unit: printed MRP on individual unit packet
  mrp_per_unit?: number;
  total_stock: number;
  reserved_stock?: number;
  // wholesale_price_per_sheet: default selling price per sheet
  wholesale_price_per_sheet: number;
  low_stock_threshold: number;
  image_url?: string;
}
