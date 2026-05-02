import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssignmentService, User } from '../services/assignment.service';
import { InventoryService } from '../services/inventory.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { AuthService } from '../auth/auth.service';
import { InventoryItem } from '../models/inventory.model';

interface AssignmentItem extends InventoryItem {
  assignedQty: number;
}

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment.page.html',
  styleUrls: ['./assignment.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentPage implements OnInit {
  private assignmentService = inject(AssignmentService);
  private inventoryService = inject(InventoryService);
  private loading = inject(GlobalLoadingService);
  private auth = inject(AuthService);

  inventoryItems = signal<AssignmentItem[]>([]);
  deliveryBoys = signal<User[]>([]);
  selectedDeliveryBoyId = signal<string>('');

  ngOnInit(): void {
    this.fetchDeliveryBoys();
    this.fetchInventory();
  }

  private fetchDeliveryBoys(): void {
    this.assignmentService.getDeliveryBoys().subscribe({
      next: (data) => this.deliveryBoys.set(data),
      error: (err) => console.error('Failed to fetch delivery boys:', err),
    });
  }

  private fetchInventory(): void {
    this.loading.show();
    this.inventoryService.getItems().subscribe({
      next: (data) =>
        this.inventoryItems.set(
          data.map((item) => ({ ...item, assignedQty: 0 }))
        ),
      error: (err) => console.error('Failed to fetch inventory:', err),
      complete: () => this.loading.hide(),
    });
  }

  confirmAssignment(): void {
    if (!this.selectedDeliveryBoyId()) {
      alert('Please select a delivery boy.');
      return;
    }
    const items = this.inventoryItems()
      .filter((i) => i.assignedQty > 0)
      .map((i) => ({ item_id: i.id, qty: i.assignedQty }));

    if (items.length === 0) {
      alert('Please assign at least one item.');
      return;
    }

    this.loading.show();
    this.assignmentService
      .createAssignment({
        delivery_boy_id: this.selectedDeliveryBoyId(),
        items,
      })
      .subscribe({
        next: () => {
          alert('Assignment created successfully!');
          this.loading.hide();
          // Reset form
          this.selectedDeliveryBoyId.set('');
          this.inventoryItems.update((items) =>
            items.map((i) => ({ ...i, assignedQty: 0 }))
          );
        },
        error: (err) => {
          console.error('Failed to create assignment:', err);
          this.loading.hide();
        },
      });
  }
}
