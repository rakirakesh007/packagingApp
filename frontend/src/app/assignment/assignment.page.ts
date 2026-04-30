import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssignmentService } from '../services/assignment.service';
import { InventoryService } from '../services/inventory.service';
import { LoadingService } from '../services/loading.service';
import { InventoryItem } from '../models/inventory.model';

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment.page.html',
  styleUrls: ['./assignment.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentPage {
  private assignmentService = inject(AssignmentService);
  private inventoryService = inject(InventoryService);
  private loadingService = inject(LoadingService);

  inventoryItems = signal<InventoryItem[]>([]);
  selectedItems = signal<InventoryItem[]>([]);
  deliveryBoyId = signal('');
  deliveryBoys = signal<{ id: string; name: string }[]>([]);

  constructor() {
    this.fetchInventory();
  }

  fetchInventory() {
    this.loadingService.set(true);
    this.inventoryService
      .getItems()
      .subscribe({
        next: (data: InventoryItem[]) => this.inventoryItems.set(data),
        error: (err) => console.error('Failed to fetch inventory:', err),
        complete: () => this.loadingService.set(false),
      });
  }

  confirmAssignment() {
    const itemsToAssign = this.selectedItems().map((item: InventoryItem) => ({
      item_id: item.id,
      qty: item.qty ?? 0,
    }));

    this.assignmentService
      .createAssignment({
        delivery_boy_id: this.deliveryBoyId(),
        items: itemsToAssign,
      })
      .subscribe({
        next: () => alert('Assignment created successfully!'),
        error: (err) => console.error('Failed to create assignment:', err),
      });
  }
}