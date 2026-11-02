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
  // wholesale_price_per_sheet: default selling price per sheet
  wholesale_price_per_sheet: number;
  low_stock_threshold: number;
  // cost_per_sheet: REAL production cost per sheet (owner's costing sheet); 0 = not costed
  cost_per_sheet?: number;
  // flat_profit_per_pouch: owner-quoted fixed profit per pouch; takes precedence over cost_per_sheet
  flat_profit_per_pouch?: number;
  // Cost breakdown — these DECOMPOSE cost_per_sheet, they are not extra costs on top:
  //   cost_per_sheet = grams × rate_per_kg × units ÷ 1000 × 1.02 + labour + packing + delivery
  // Used to re-derive cost when a pack is made to a non-standard weight (distributor deals).
  // 0 = not filled in yet.
  rate_per_kg?: number;
  labour_cost_per_sheet?: number;
  packing_cost_per_sheet?: number;
  delivery_cost_per_sheet?: number;
  image_url?: string;
  ingredients?: string;
  search_aliases?: string;
  category?: string;
  variant_name?: string;
  sale_mode?: 'sheet' | 'packet';
  in_stock?: boolean;
}
