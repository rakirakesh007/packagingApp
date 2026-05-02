export interface Sale {
  _id?: string;
  customer_name?: string;
  shop_name?: string;
  shop_id?: string;
  items: { item_id: string; qty: number; price: number }[];
  total_amount: number;
  payment_mode: 'cash' | 'online';
  delivery_boy_id: string;
  timestamp: string;
}
