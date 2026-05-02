# Project Roadmap: DesiMasalaHub (v1.3)

## 0. Device Context
- **Admin** uses this application on a **laptop/desktop** — full sidebar navigation, wide tables, dense data views.
- **Delivery Boy** uses the app on a **mobile phone** — mobile-first UI, bottom-tab navigation, large touch targets, no sidebar.

---

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
- `items: [{item_id, qty, price}]`, `total_amount`, `shop_name`, `shop_id` (ref: Shop), `delivery_boy_id`, `payment_mode` (Enum: `cash`, `online`).
### Shops (Marketing)
- `name`, `mobile` (unique), `address`, `total_orders_count`.
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

### B. Delivery & Sales (Field UI — Mobile)
- **Cart Page:** Searchable spice list with `+`/`-` buttons. Angular Signals cart state.
- **Checkout:** Optional `Shop Name` + `Mobile` fields. Payment mode toggle (`Cash`/`Online`).
- **Marketing Logic:** If a new mobile number is entered, automatically create/upsert a `Shop` record for future marketing.
- **WhatsApp Integration:** On "Place Order", generate `wa.me/{mobile}?text={message}` deep link.
- **Message Template:**
  ```
  *DesiMasalaHub - Order Receipt*
  Date: [Date]
  ------------------
  [Items List with Qty & Price]
  Total: ₹[Total]
  Payment: [Mode]
  ------------------
  To order again, contact Rakesh: wa.me/918050991832
  ```
- **Owner WhatsApp:** `918050991832` (stored in `.env` as `OWNER_WHATSAPP`).

### C. Expense Tracker
- Simple CRUD for daily business costs. Categories must be selectable to prevent data entry errors.

### D. Daily Sales Report (Delivery Boy)
- **Table Columns:** Shop Name | Time | Amount | Mode (Cash/Online).
- **Summary Footer:** Total Sales: ₹XXX | Total Cash to Deposit: ₹XXX (sum of cash only) | Online: ₹XXX.
- Date picker to view any past day.

### E. EOD (End of Day) Work Report (Admin)
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
- [x] Inventory CRUD (Admin)
- [x] Sales Schema (with shop_id, payment_mode)
- [x] Shops Model (auto-create on new mobile for marketing)
- [x] Admin Bulk Entry (Spreadsheet UI with profit calc)
- [x] Morning Assignment (Admin assigns stock to delivery boy)
- [x] Delivery Boy — Sales/Cart Page (search, +/-, checkout, WhatsApp bill)
- [x] Delivery Boy — Daily Sales Report (date filter, cash/online split)
- [x] Admin Sidebar (dark, icon+label, DesiMasalaHub branding)
- [x] Delivery Boy Bottom Tabs (Sales | Report | Logout)
- [x] Login Page (DesiMasalaHub branding, error display)
- [x] Expense Management (CRUD)
- [x] EOD Reporting (Admin)
- [x] WhatsApp Deep Link Integration (wa.me with full receipt)
- [x] Delivery Boy Management (Admin CRUD: add/edit/deactivate, isActive login gate)
- [ ] Shops Marketing Page (Admin view of all shops)
- [ ] Render Deployment Scripts (PENDING)