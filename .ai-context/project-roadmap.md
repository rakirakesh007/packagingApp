# Project Roadmap: DesiMasalaHub (v1.3)

## 0. Device Context
- **Admin** uses this application on a **laptop/desktop** — full sidebar navigation, wide tables, dense data views.
- **Delivery Boy** uses the app on a **mobile phone** — mobile-first UI, bottom-tab navigation, large touch targets, no sidebar.

---

## 1. Business Core Logic (The "Golden Rules")
- **Atomic Inventory:** All sales must use MongoDB `$inc` inside a transaction, decrementing `total_stock`. Never overwrite stock based on frontend calculations during a sale. A sale is never blocked on stock (may go negative).
- **Server-side Money:** Client sends only `sheets_sold` + `discount_amount`. Backend computes `final_price`, `profit`, `total_amount`, `total_discount`, `total_profit`.
- **Pricing:** `final_price = max(0, wholesale_price_per_sheet − discount_amount) × sheets_sold`; `profit = final_price × 0.10` (10% margin on selling price).
- **Stock Model:** Inventory is informational — only `total_stock`, decremented on sale. Assignment does not touch inventory; a boy's holdings are derived via `computeHoldings` (assigned − sold − returned). No `reserved_stock`.
- **Stock Reconciliation:** $$Closing Stock = Opening (Assigned) - Sold (Invoices)$$
- **Cold Start Handling:** Every primary action (Login, Sync, Report) must trigger the `GlobalLoadingService` to accommodate Render's Free Tier delay.

---

## 2. Database Schemas (MongoDB Atlas)
> Current sheet-based model. Stock is counted in **sheets**; a sheet holds `units_per_sheet` individual packets.

### Inventory
- `item_name`, `hindi_name`, `description`, `units_per_sheet` (packets/sheet), `quantity_per_unit` (gm/packet, printed on label), `mrp_per_unit`, `total_stock` (sheets), `wholesale_price_per_sheet`, `low_stock_threshold`, `image_url`.
### Sales & Invoicing
- `delivery_boy_id`, `shop_id` (ref: Shop), `shop_name`, `customer_name`, `payment_mode` (Enum: `cash`, `online`, `pending`), `total_amount`, `total_discount`, `total_profit`, `timestamp`.
- `items: [{ item_id, sale_type (wholesale|retail), sheets_sold, packets_sold, wholesale_price_per_sheet, discount_amount, final_price, profit, item_name, hindi_name, description }]` — all money fields snapshotted/computed server-side.
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

### A1. Printable Product Label Sheet (Admin)
- **Goal:** Generate a press-ready A4 landscape sticker sheet with exactly 15 labels.
- **Layout:** 5-column by 3-row grid, narrow margins, light-grey die-cut borders, and client-side PDF generation.
- **Assets:** Load `assets/color-logo.png` and `assets/veg-icon.png` as Base64 so they render reliably in the PDF.
- **Fields:** Hindi name, net weight, MRP, PKD date, batch number, FSSAI, customer care, manufacturer, and trust phrase.
- **Behavior:** Repeating the selected product fills the 15 slots on one page without spillover.

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

### F. Monthly Reports & Payroll (Admin)
- **Tabs:** EOD Report | Monthly Summary | Staff Payments.
- **Monthly Summary:** Month/year filter with revenue, purchase cost, expenses, and net profit cards.
- **Staff Payments:** Monthly delivery-boy performance, cash collection tracking, and printable monthly records.
- **Export:** Monthly PDF/print-friendly payroll summary for formal record keeping.

---

## 4. Technical Constraints (2026 Standards)
- **Frontend:** Angular 21, Standalone Components, Signals for State, `inject()`, Ionic 8 + Angular Material + Tailwind CSS, `lucide-angular` icons, `jspdf`/`html2canvas` for client-side PDFs.
- **Backend:** Express 5 + TypeScript, Mongoose 8, JWT + bcryptjs. Routes mount at root (no `/api` prefix).
- **Performance:** `ChangeDetectionStrategy.OnPush` on all feature components.
- **Structure:** 4-file component structure (TS, HTML, SCSS, Spec) for features > 50 lines.

---

## 5. Implementation Status
- [x] Project Infrastructure (Frontend/Backend)
- [x] Global Loading Service
- [x] Inventory CRUD (Admin — Hindi name, description, quantity, and MRP fields)
- [x] Sales Schema (with shop_id, payment_mode)
- [x] Shops Model (auto-create on new mobile for marketing)
- [x] Admin Bulk Entry (Spreadsheet UI — Mobile field + inventory autocomplete dropdown, shop auto-upsert, item_id-based stock deduction)
- [x] Morning Assignment (Admin assigns stock to delivery boy)
- [x] Morning Assignment Additions (same boy/date can receive more stock later in the day)
- [x] Delivery Boy — Sales/Cart Page (search, +/-, checkout, WhatsApp bill)
- [x] Delivery Boy — Daily Sales Report (date filter, cash/online split)
- [x] Admin Sidebar (dark, icon+label, DesiMasalaHub branding)
- [x] Delivery Boy Bottom Tabs (Sales | Report | Logout)
- [x] Login Page (DesiMasalaHub branding, error display)
- [x] Expense Management (CRUD)
- [x] EOD Reporting (Admin)
- [x] Monthly Reporting & Staff Payments (Admin tabs with month/year filters and printable monthly record)
- [x] WhatsApp Deep Link Integration (wa.me with full receipt)
- [x] WhatsApp Digital Catalog (secondary WhatsApp message appended after owner contact line — generated from inventory array, Hindi name + MRP, items with stock ≥ 5, polite mobile CTA)
- [x] Printable Product Label Sheet (A4 landscape, 15-up grid, logo/veg assets, PKD/batch, one-page PDF)
- [x] Delivery Boy Management (Admin CRUD: add/edit/deactivate, isActive login gate)
- [x] Delivery-Boy Payout Report (Reports → Payout tab: per date × boy, ₹5/₹10 sheet split, two-tier commission)
- [x] Real Profit Model (inventory `cost_per_sheet` + `flat_profit_per_pouch`, `utils/profit.util.ts` at sale time, seed + historical backfill scripts; Monthly/Overall reports show true profit)
- [x] Reports Overhaul (EOD merged single view with compact product grid; Monthly item-wise sales + expense category breakdown + all-time Overall cards; orphaned eod-report page/endpoint removed; per-request catchError)
- [ ] Shops Marketing Page (Admin view of all shops)
- [ ] Render Deployment Scripts (PENDING)