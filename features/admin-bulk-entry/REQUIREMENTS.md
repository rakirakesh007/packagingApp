# Requirements — Admin Bulk Entry

## Business Goal
Allow admins to quickly record multiple sales (wholesale sheet sales OR retail packet sales) in bulk
rather than one at a time. Supports two distinct sale types in the same entry session.

---

## Sale Types

### Wholesale (Sheet)
- Unit = full sheet (e.g. 10 or 12 packets per sheet)
- Rate used = `wholesale_price_per_sheet` from inventory (auto-filled, readonly)
- Discount = per sheet
- Subtotal = (wholesale_price − discount) × sheets
- Stock deducted = quantity × 1 sheet

### Retail (Packet)
- Unit = individual packet
- Rate used = `mrp_per_unit` from inventory (auto-filled, readonly)
- Discount = per packet
- Subtotal = (mrp_per_unit − discount) × packets
- Stock deducted = packets ÷ units_per_sheet (fractional sheets; e.g. 6 pkts ÷ 10/sheet = 0.6 sheets)
- `packets_sold` stored separately in DB for analytics

---

## Numbered Requirements

1. Dynamic row table — add/remove rows; one row per shop + item
2. Per-row fields:
   - Shop Name (required), Mobile (optional)
   - Item search/autocomplete (hindi + english name; shows ₹/sheet AND ₹/pkt in dropdown)
   - **Type toggle** — [Sheet] / [Pkt] buttons; blue = wholesale active, orange = retail active
   - **Qty** — sheets (wholesale) or packets (retail); placeholder changes with type
   - **Rate** — readonly; ₹/sheet for wholesale, ₹/pkt (MRP) for retail; auto-filled on item select
   - **Disc/Unit** — editable discount per sheet (wholesale) or per packet (retail); resets to 0 on type toggle
   - **Subtotal** and **Profit** — live-calculated in the row, no server round-trip
3. Grand total and total profit shown in footer
4. Colour-coded profit: green (>0), red (<0)
5. Legend below the table explains Sheet vs Pkt modes
6. Error banner displays backend error messages
7. Validation: shop name required, item required, quantity ≥ 1
8. On submit:
   - Frontend sends `sale_type`, `unit_type`, `quantity_sold`, `discount_amount` per row
   - **Backend re-computes all prices and profit from inventory — frontend values are display-only**
   - Backend stores: `sheets_sold` (canonical stock unit; fractional for retail), `packets_sold` (retail only), `sale_type`, `final_price`, `profit`
   - Backend decrements `total_stock` by `sheets_sold` (fractional-safe via MongoDB $inc)
   - No delivery-boy holdings impact (admin bulk entry has no `delivery_boy_id`); only `total_stock` is decremented
9. Success/error toast feedback; form resets to one blank row after success

---

## Profit Calculation Rules (Backend — authoritative)

### Wholesale
```
sheets_sold  = quantity_sold
final_price  = max(0, wholesale_price_per_sheet − discount) × sheets_sold
profit       = final_price × 0.10   ← 10% margin
stock_delta  = −sheets_sold
```

### Retail
```
packets_sold = quantity_sold
sheets_sold  = packets_sold / units_per_sheet          ← fractional
final_price  = max(0, mrp_per_unit − discount) × packets_sold
profit       = final_price × 0.10   ← 10% margin
stock_delta  = −sheets_sold                            ← fractional MongoDB $inc
```

---

## Key Files

| Layer    | File |
|----------|------|
| Frontend | `frontend/src/app/admin-bulk-entry/admin-bulk-entry.component.ts` |
| Frontend | `frontend/src/app/admin-bulk-entry/admin-bulk-entry.component.html` |
| Backend  | `backend/src/routes/sale.route.ts` → `POST /sale/bulk` |
| Schema   | `backend/src/models/sale.model.ts` → `saleItemSchema` |
| Model    | `frontend/src/app/models/inventory.model.ts` |

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
