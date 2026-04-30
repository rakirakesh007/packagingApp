export interface Sale {
  customer_name: string;
  items: { item_id: string; qty: number; price: number }[];
  total_amount: number;
  payment_mode: 'Cash' | 'Online';
  delivery_boy_id: string;
  timestamp: Date;
}