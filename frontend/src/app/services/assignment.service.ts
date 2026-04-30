import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Assignment } from '../models/assignment.model';

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private http = inject(HttpClient);

  createAssignment(data: { delivery_boy_id: string; items: { item_id: string; qty: number }[] }) {
    return this.http.post<Assignment>('/assignment', data);
  }

  getActiveAssignment(deliveryBoyId: string) {
    return this.http.get<Assignment>(`/assignment/active/${deliveryBoyId}`);
  }
}