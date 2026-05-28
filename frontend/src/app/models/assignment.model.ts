export interface AssignmentItem {
  item_id:    string;
  qty:        number;
  item_name:  string;
  hindi_name?: string;
  wholesale_price_per_sheet: number;
}

export interface Assignment {
  _id:             string;
  delivery_boy_id: string;
  date:            string | Date;
  items:           AssignmentItem[];
  status?:         'active' | 'completed';
  created_at?:     Date;
}
