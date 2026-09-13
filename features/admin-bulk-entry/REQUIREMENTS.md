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

## Profit Calculation Rules (Backend — authoritative, `POST /sale/bulk`)

`hasRealCost = flat_profit_per_pouch > 0 || cost_per_sheet > 0` (checked per item).

### Wholesale
```
sheets_sold  = quantity_sold
selling_per_sheet = selling_price || round(wholesale_price_per_sheet × units_per_sheet)
final_price  = selling_per_sheet × sheets_sold
profit       = computeProfit(final_price, sheets_sold, item)
               → flat_profit_per_pouch × units_per_sheet × sheets_sold, if set
               → else final_price − cost_per_sheet × sheets_sold, if costed
               → else legacy 10% of final_price (uncosted items only)
stock_delta  = −sheets_sold
```

### Retail
```
packets_sold = quantity_sold
sheets_sold  = packets_sold / units_per_sheet          ← fractional
selling_per_unit = selling_price || mrp_per_unit
final_price  = selling_per_unit × packets_sold
profit       = hasRealCost
               ? computeProfit(final_price, sheets_sold, item)   ← same precedence as wholesale
               : (selling_per_unit − wholesale_price_per_sheet) × packets_sold   ← legacy fallback
stock_delta  = −sheets_sold                            ← fractional MongoDB $inc
```

See `utils/profit.util.ts` and CLAUDE.md's profit precedence rule — this is the same
`computeProfit` used by the single-sale (`sales-cart`) flow, not a separate 10% model.

---

## Key Files

| Layer    | File |
|----------|------|
| Frontend | `frontend/src/app/admin-bulk-entry/admin-bulk-entry.component.ts` |
| Frontend | `frontend/src/app/admin-bulk-entry/admin-bulk-entry.component.html` |
| Backend  | `backend/src/routes/sale.route.ts` → `POST /sale/bulk` |
| Schema   | `backend/src/models/sale.model.ts` → `saleItemSchema` |
| Model    | `frontend/src/app/models/inventory.model.ts` |

