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
4. On assignment: increment `reserved_stock` in Inventory (does NOT touch `total_stock`)
5. On return (partial or full): decrement `reserved_stock` via `POST /assignment/return`
6. Admin sees **available stock** = `total_stock − reserved_stock` to prevent over-assignment

## Stock Model (Option A + reserved_stock)

| Event | `total_stock` | `reserved_stock` | available = total − reserved |
|---|---|---|---|
| Assign 50 units | unchanged | +50 | −50 |
| Sell 30 units | −30 | −30 | unchanged |
| Return 20 unsold | unchanged | −20 | +20 |

## API Endpoints
- `POST /api/assignments` — create/update assignment, increments `reserved_stock`
- `POST /api/assignments/return` — record return, decrements `reserved_stock`
- `GET  /api/assignments/active/:deliveryBoyId` — today's assignment
- `GET  /api/assignments/date/:deliveryBoyId?date=` — assignment for any date

## Key Files
- Frontend: `assignment/assignment.page.ts`
- Backend: `src/routes/assignment.route.ts`, `src/models/loading.model.ts`, `src/models/inventory.model.ts`
