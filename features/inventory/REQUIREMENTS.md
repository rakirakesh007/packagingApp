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
4. Display **available stock** = `total_stock − reserved_stock` in UI
5. Low-stock cron job for automated alerts
6. Label sheet download (PDF) per item
7. Search/filter products

## Stock Fields on InventoryModel

| Field | Meaning | Changed by |
|---|---|---|
| `total_stock` | Total sheets (warehouse + in field) | Decremented only on sale |
| `reserved_stock` | Sheets currently loaded on delivery boys | +on assignment, −on sale or return |
| `available_stock` (computed) | `total_stock − reserved_stock` | Derived — not stored |

> `low_stock_threshold` is compared against `available_stock`, not `total_stock`.

## Key Files
- Frontend: `inventory/inventory.page.ts`
- Backend: `src/routes/inventory.route.ts`, `src/models/inventory.model.ts`
- Cron: `src/cron/low-stock-cron.js`
