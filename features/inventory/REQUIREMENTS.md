# Requirements — Inventory Management

## Business Goal
Allow admins to manage the product catalog and stock levels for all spice products.

## User Stories
- As an **admin**, I want to add new products with name, price, unit, and initial stock.
- As an **admin**, I want to edit product details and update stock quantities.
- As an **admin**, I want to delete discontinued products.
- As an **admin**, I want to see low-stock alerts so I can reorder.
- As an **admin**, I want to search/filter products by name or category.
- As an **admin**, I want to see how much stock is actually available (not reserved by delivery boys).

## Numbered Requirements
1. Product CRUD (name, hindi_name, description, stock quantity)
2. **Production-model pricing** — no flat `unit_price`; all pricing is sheet-based:
   - `units_per_sheet` — how many individual packets per sheet (e.g. 10 or 12)
   - `quantity_per_unit` — weight/volume per packet in grams (shown as label: **Quantity/unit**)
   - `mrp_per_unit` — printed MRP on individual packet (**MRP/unit**)
   - `wholesale_price_per_sheet` — selling price per sheet
   - `wholesale_price_per_sheet` — default selling price per sheet (pre-filled in delivery-boy cart)
3. Stock level tracking with low-stock threshold alerts
4. Display `total_stock` ("Stock") in UI — inventory is informational; there is no separate available/reserved figure
5. Low-stock cron job for automated alerts
6. Label sheet download (PDF) per item
7. Search/filter products

## Stock Fields on InventoryModel

| Field | Meaning | Changed by |
|---|---|---|
| `total_stock` | Sheets still owned (warehouse + in field, not yet sold) | Decremented only on sale (may go negative on oversell) |

> Assignment does not touch inventory. What a delivery boy holds is derived via `computeHoldings` (assigned − sold − returned), not from an inventory counter.
> `low_stock_threshold` is compared against `total_stock`.

## Key Files
- Frontend: `inventory/inventory.page.ts`
- Backend: `src/routes/inventory.route.ts`, `src/models/inventory.model.ts`
- Cron: `src/cron/low-stock-cron.js`
