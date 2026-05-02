import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Assignment } from '../models/assignment.model';

export interface User {
  _id: string;
  name: string;  // mapped from username by backend
  role: 'admin' | 'delivery_boy';
}

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private http = inject(HttpClient);

  createAssignment(data: { delivery_boy_id: string; items: { item_id: string; qty: number }[] }) {
    return this.http.post<Assignment>('/assignment', data);
  }

  getActiveAssignment(deliveryBoyId: string) {
    return this.http.get<Assignment>(`/assignment/active/${deliveryBoyId}`);
  }

  /** Fetch all delivery boys for assignment page dropdown. */
  getDeliveryBoys() {
    return this.http.get<User[]>('/users?role=delivery_boy');
  }
}