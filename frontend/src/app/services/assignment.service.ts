import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Assignment } from '../models/assignment.model';

export interface User {
  _id: string;
  username: string;
  name: string;
  mobile_number?: string;
  role: 'admin' | 'delivery_boy';
  isActive: boolean;
}

export interface Holding {
  item_id: string;
  item_name: string;
  hindi_name: string;
  units_per_sheet: number;
  assigned: number;
  sold: number;
  returned: number;
  withBoy: number;
}

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private http = inject(HttpClient);

  createAssignment(data: {
    delivery_boy_id: string;
    items: { item_id: string; qty: number; item_name?: string; hindi_name?: string; wholesale_price_per_sheet?: number }[];
    date?: string;
  }) {
    return this.http.post<Assignment>('/assignment', data);
  }

  getActiveAssignment(deliveryBoyId: string) {
    return this.http.get<Assignment>(`/assignment/active/${deliveryBoyId}`);
  }

  /** GET /assignment/date/:id?date=YYYY-MM-DD — for any date. */
  getAssignmentByDate(deliveryBoyId: string, date: string) {
    return this.http.get<Assignment>(`/assignment/date/${deliveryBoyId}?date=${date}`);
  }

  /** Fetch only ACTIVE delivery boys for assignment page dropdown. */
  getDeliveryBoys() {
    return this.http.get<User[]>('/users?role=delivery_boy&isActive=true');
  }

  /** Running balance of what a boy currently holds (across all days). */
  getHoldings(deliveryBoyId: string) {
    return this.http.get<Holding[]>(`/assignment/holdings/${deliveryBoyId}`);
  }

  /** Record returns; backend responds with the updated holdings. */
  returnItems(deliveryBoyId: string, items: { item_id: string; qty: number }[]) {
    return this.http.post<Holding[]>('/assignment/return', { delivery_boy_id: deliveryBoyId, items });
  }
}