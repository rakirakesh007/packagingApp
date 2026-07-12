# Requirements — Expenses

## Business Goal
Track daily expenses incurred by delivery boys and admins (fuel, food, repairs, etc.).

## User Stories
- As a **user**, I want to log an expense with amount, category, and description.
- As a **user**, I want to view my expense history by date.
- As an **admin**, I want to see all expenses across users.

## Numbered Requirements
1. Expense entry (amount, category, description, date)
2. Expense list with date filtering
3. Admin view of all user expenses
4. Expense categories: Fuel, Raw Material, Transport, Packaging, Maintenance, Salary, Utilities, Miscellaneous, Other
5. Category-wise breakdown on the Expense page — selected month (client-side from the list) and all-time (`GET /expenses/summary`, Mongo aggregation)
6. On-page reference note explaining what belongs in `cost_per_sheet` vs the Expense Tracker

## Cost model — expenses vs cost_per_sheet (IMPORTANT, do not break)
Each sale's profit already subtracts `cost_per_sheet`, which **includes material + labour + packing + delivery per sheet**. So those production costs must NOT also reduce Net Profit as expenses — that would double-count.

- **Stock/COGS categories** (already inside `cost_per_sheet`): **Raw Material, Packaging, Salary** (delivery-boy per-sheet charge). Logged for cash/inventory tracking but **excluded from Net Profit** — reported as `stockPurchased`.
- **Overhead categories** (everything else): reduce Net Profit.
- Net Profit = `totalProfit (gross)` − `overheadExpenses` (NOT − totalExpenses).
- The split lives in `COGS_EXPENSE_CATEGORIES` in `admin-reports.route.ts`; `/monthly` and `/overall` both return `overheadExpenses` and `stockPurchased`.
- `cost_per_sheet = material + labour + packing + delivery`, where `material = pack_weight(g) × units_per_sheet × (rate₹/kg ÷ 1000) × 1.02` (2% wastage). Margin is NOT part of cost. Source: `spice_costing_v2.xlsx` "Cost/sheet" column.

## Key Files
- Frontend: `expense/expense.page.ts` (+ `.html`), `services/expense.service.ts`, `models/expense.model.ts`
- Backend: `src/routes/expenses.route.ts` (`/summary` endpoint), `src/models/expense.model.ts`
- Related: `src/routes/admin-reports.route.ts` (`COGS_EXPENSE_CATEGORIES`, `splitExpenses`, Net Profit), `src/utils/profit.util.ts`
