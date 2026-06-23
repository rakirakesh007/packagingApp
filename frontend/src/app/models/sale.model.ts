export interface Sale {
  _id?: string;
  customer_name?: string;
  shop_name?: string;
  shop_id?: string;
  items: {
    item_id: string;
    item_name?: string;
    hindi_name?: string;
    description?: string;
    sheets_sold: number;
    wholesale_price_per_sheet: number;
    selling_price_per_sheet: number;
    final_price: number;
    profit: number;
  }[];
  total_amount: number;
  total_profit: number;
  payment_mode: 'cash' | 'online' | 'pending';
  delivery_boy_id: string;
  timestamp: string;
}
