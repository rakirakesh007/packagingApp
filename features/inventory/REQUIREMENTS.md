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
   - `wholesale_price_per_sheet` — default selling price per sheet (pre-filled in delivery-boy cart)
   - `cost_per_sheet` — REAL production cost per sheet (owner's costing sheet); 0 = not costed yet
   - `flat_profit_per_pouch` — owner-quoted fixed profit per pouch (e.g. Cardamom/Garam Masala ₹5→₹1, ₹10→₹2);
     **takes precedence** over `cost_per_sheet` when computing sale profit (`utils/profit.util.ts`).
     Both editable on the Inventory form; seeded by `scripts/seed-real-costs.ts`
   - `category` — product category (see `models/categories.const.ts` for the current 4: Whole Spices,
     Masala Powder, Mix Masala Whole, Dry Fruits); drives both the admin filter and the customer-store tabs
   - `search_aliases` — romanized/alternate keywords (e.g. "methi") matched by the customer-store search
   - `image_url`, `ingredients` — product photo + ingredient text; used by the customer-store catalog
     (as of writing, no live item has `image_url` set — the field is wired but unused)
   - `sale_mode` — `'sheet'` (default) or `'packet'`; packet-mode items (e.g. 50g pouches) price and
     display differently on the customer storefront (see `features/customer-store/REQUIREMENTS.md`)
   - `in_stock` — visibility toggle for the customer storefront; independent of `total_stock`
     (an item can be `in_stock: true` with `total_stock` at 0 or negative — informational only)
3. Stock level tracking with low-stock threshold alerts
4. Display `total_stock` ("Stock") in UI — inventory is informational; there is no separate available/reserved figure
5. Low-stock cron job for automated alerts
6. **Label printing** — two routes, both rendering the *same* label design:
   - **Per item** (existing per-row ⬇️ buttons): fills a whole sheet with one item.
     `/label-sheet?itemIds=<id>&size=normal|big`
   - **Mixed sheet** (🏷️ Mixed Labels button → `/app/label-picker`): several items with a
     per-item count, packed back-to-back onto one sheet, so a short run doesn't burn a full
     sheet of stickers. `/label-sheet?items=<id>:<count>,<id>:<count>&size=&start=`

   **Not a PDF.** `jspdf`/`html2canvas` are in `package.json` but unused anywhere in
   `frontend/src` — the sheet is an on-screen grid the user prints with the browser
   (Ctrl/Cmd+P). There is also no `@page` rule, so paper size/orientation comes from the
   print dialog.

   **Capacity** (`label-sheet/label-capacity.util.ts` — single source of truth, shared by the
   picker and the sheet):

   | | no ingredients | any item has `ingredients` |
   |---|---|---|
   | normal (5/row) | 55 | 35 |
   | big (4/row) | 20 | 16 |

   Ingredient text needs taller rows, so **one** selected item with `ingredients` drops the
   whole sheet's capacity. The picker shows this live and blocks printing on overflow.

   **A sheet always renders exactly `capacity` cells.** Unused positions render as
   `.label-card--blank` (empty, no border). This is required, not cosmetic: in print the grid
   is `height: 100vh` with `grid-auto-rows: 1fr`, so rendering fewer cards would stretch the
   rows and the labels would no longer line up with the pre-cut stickers. Blanks also leave
   those stickers unprinted, so `start=N` can re-feed a part-used sheet later.
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
