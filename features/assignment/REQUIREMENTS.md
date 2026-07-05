# Requirements — Assignment

## Business Goal
Allow admins to assign inventory/stock to delivery boys for their daily routes.

## User Stories
- As an **admin**, I want to assign specific products and quantities to a delivery boy.
- As an **admin**, I want to view current assignments per delivery boy.
- As a **delivery boy**, I want to see my assigned stock for today.
- As a **delivery boy**, I want to return unsold items so warehouse stock is corrected.

## Numbered Requirements
1. Select delivery boy and assign products with quantities
2. View/edit existing assignments (additive on same day)
3. Assignment date tracking and history
4. On assignment: record a `Loading` doc only — inventory is **not** touched (no guard, no reservation)
5. On return (partial or full): record a `Return` doc via `POST /assignment/return` — inventory is not touched
6. Assignment is never capped by stock; what a boy holds is derived via `computeHoldings`

## Stock Model (holdings-derived, no reservation)

Inventory only tracks `total_stock`, decremented on sale. A delivery boy's current
holdings are computed on read: `withBoy = Σ assigned (Loading) − Σ sold (Sale) − Σ returned (Return)`.

| Event | `total_stock` | boy's `withBoy` (computed) |
|---|---|---|
| Assign 50 units | unchanged | +50 |
| Sell 30 units | −30 | −30 |
| Return 20 unsold | unchanged | −20 |

## API Endpoints
- `POST /api/assignments` — create/update assignment (Loading doc only)
- `POST /api/assignments/return` — record return (Return doc only)
- `GET  /api/assignments/active/:deliveryBoyId` — today's assignment
- `GET  /api/assignments/date/:deliveryBoyId?date=` — assignment for any date

## Key Files
- Frontend: `assignment/assignment.page.ts`
- Backend: `src/routes/assignment.route.ts`, `src/models/loading.model.ts`, `src/models/inventory.model.ts`
