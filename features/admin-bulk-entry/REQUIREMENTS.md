# Requirements — Admin Bulk Entry

## Business Goal
Allow admins to quickly enter multiple records (sales, inventory, expenses) in bulk rather than one at a time.

## Numbered Requirements
1. Dynamic row table — add/remove rows; one row per shop+item
2. Per-row fields:
   - Shop Name, Mobile (optional)
   - Item search/autocomplete (hindi + english name, ₹/sheet shown)
   - **Wholesale Price/Sheet** (readonly, from inventory)
   - **Sheets Sold** (editable)
   - **Discount/Sheet** (editable, default 0)
   - Subtotal and Profit auto-calculated in the row
3. Grand total and total profit shown in footer
4. Validation per row before batch submission
5. Server computes `final_price`, `profit` per item; `total_amount`, `total_discount`, `total_profit` per sale
6. Success/error toast feedback

## Key Files
- Frontend: `admin-bulk-entry/admin-bulk-entry.component.ts`
