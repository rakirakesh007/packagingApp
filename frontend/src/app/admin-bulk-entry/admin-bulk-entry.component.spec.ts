import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminBulkEntryComponent } from './admin-bulk-entry.component';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('AdminBulkEntryComponent', () => {
  let component: AdminBulkEntryComponent;
  let fixture: ComponentFixture<AdminBulkEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, CommonModule],
      declarations: [AdminBulkEntryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBulkEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add a new row on addRow()', () => {
    const initialRowCount = component.rows.length;
    component.addRow();
    expect(component.rows.length).toBe(initialRowCount + 1);
  });

  it('should calculate grand total correctly', () => {
    component.rows.at(0).patchValue({ quantity: 2, price: 50 });
    expect(component.grandTotal()).toBe(100);
  });

  it('should calculate total profit correctly', () => {
    component.rows.at(0).patchValue({ quantity: 2, price: 50, purchasePrice: 30 });
    expect(component.totalProfit()).toBe(40);
  });
});