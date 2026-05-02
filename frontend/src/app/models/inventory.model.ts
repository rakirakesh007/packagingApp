export interface InventoryItem {
  id: string;
  item_name: string;
  total_stock: number;
  unit_price: number;
  purchase_price: number;
  low_stock_threshold: number;
  image_url?: string;
}
