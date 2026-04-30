export interface Assignment {
  _id: string;
  delivery_boy_id: string;
  items: { item_id: string; qty: number }[];
  status: 'active' | 'completed';
  created_at: Date;
}
