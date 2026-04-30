# Project Roadmap: Spice Distribution App (v1.1)

## 1. Business Core Logic (The "Golden Rules")
- **Atomic Inventory:** All sales must use MongoDB `$inc: { total_stock: -qty }`. Never overwrite stock based on frontend calculations during a sale.
- **Profit Calculation:** $$Net Profit = (Sale Price - Purchase Price) - Expenses$$
- **Stock Reconciliation:** $$Closing Stock = Opening (Assigned) - Sold (Invoices)$$
- **Cold Start Handling:** Every primary action (Login, Sync, Report) must trigger the `GlobalLoadingSignal` to accommodate Render's Free Tier delay.

---

## 2. Database Schemas (MongoDB Atlas)
### Inventory
- `item_name`, `total_stock`, `unit_price` (Sale), `purchase_price` (Cost), `low_stock_threshold`, `image_url`.
### Sales & Invoicing
- `items: [{item_id, qty, subtotal}]`, `total_amount`, `shop_name`, `delivery_boy_id`, `payment_status` (Cash/Pending).
### Expenses
- `date`, `category` (Fuel, Raw Material, Maintenance, etc.), `amount`, `description`.
### Loading (Morning Assignment)
- `delivery_boy_id`, `date`, `items: [{item_id, assigned_qty}]`.

---

## 3. Feature Modules & UI Requirements

### A. Admin Bulk Entry (Spreadsheet UI)
- **Goal:** Rapid paper-to-digital entry.
- **UX:** `FormArray` based. **Tab-friendly** flow. `Enter` key on the last column creates a new row and auto-focuses the first field of the new row.
- **Backend:** Atomic bulk-insert that updates `total_stock` and creates individual `Sales` records.

### B. Delivery & Sales (Field UI)
- **WhatsApp Integration:** Generate professional text-based invoices via Deep Links (`wa.me`).
- **Offline Note:** Since delivery boys are in the field, UI must handle slow/intermittent sync gracefully.

### C. Expense Tracker
- Simple CRUD for daily business costs. Categories must be selectable to prevent data entry errors.

### D. EOD (End of Day) Work Report
- **Table Summary:** `Item | Opening | Sold | Closing`.
- **Financial Summary:** `Total Revenue`, `Total Expenses`, `Net Cash to Deposit`.
- **Verification:** Flag rows where `Closing Stock` is negative (Indicates data entry error).

---

## 4. Technical Constraints (2026 Standards)
- **Frontend:** Angular 18+, Standalone Components, Signals for State, `inject()`, Tailwind CSS.
- **Performance:** `ChangeDetectionStrategy.OnPush` on all feature components.
- **Structure:** 4-file component structure (TS, HTML, SCSS, Spec) for features > 50 lines.

---

## 5. Implementation Status
- [x] Project Infrastructure (Frontend/Backend)
- [x] Global Loading Service
- [x] Inventory & Sales Schemas
- [~] Admin Bulk Entry (Basic UI done, logic needs refinement)
- [ ] Expense Management (PENDING)
- [ ] EOD Reporting Logic (PENDING)
- [ ] WhatsApp Deep Link Integration (PENDING)
- [ ] Render Deployment Scripts (PENDING)