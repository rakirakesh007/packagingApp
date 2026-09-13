# Requirements — Admin Dashboard

## Business Goal
Provide admins with an overview of business metrics, stock alerts, and quick access to key actions.

## User Stories
- As an **admin**, I want to see today's revenue, orders, cash collected, and profit at a glance.
- As an **admin**, I want to see the best-selling products today (bar chart).
- As an **admin**, I want to see which delivery boys are active and how much they've collected.
- As an **admin**, I want low-stock alerts with a direct link to inventory.
- As an **admin**, I want quick action buttons for the most common tasks.

## Numbered Requirements
1. **KPI cards** (4): Today's Revenue, Orders Today, Cash Collected, Today's Profit
2. **Quick Action buttons**: Assign Task, Bulk Entry, Update Inventory, View Reports
3. **Best-Selling Today** — top 5 items with proportional bar chart (sheets sold)
4. **Delivery Boys Today** — compact list: name, sheets sold / opening stock, cash collected
5. **Low Stock Alerts** — auto-shown panel when any item ≤ threshold; links to Inventory.
   **Disabled 2026-09-07** — `total_stock` isn't being kept current (no real purchase/restock
   tracking happening yet, confirmed with the owner), so the alert fired on nearly the entire
   catalog and carried no signal. Computation is left in place (`AdminDashboardPage.lowStock`);
   only the render is gated off (`@if (false && ...)` in the template). Re-enable once stock
   is actually maintained, or replace with a sale-velocity-based definition of "low" instead
   of the raw counter.
6. **Best-Selling — Last 7 Days** — top 5 items with a proportional bar chart (sheets sold).
   Was fetched by the frontend since day one but never rendered — wired up 2026-09-07, then
   changed from "today" to a rolling 7-day window the same day (see point 7).
7. **Rolling-week KPIs, not daily** — the whole page was originally "today" scoped
   (`GET /admin/reports/today`, "vs yesterday"). **Changed 2026-09-07**: the business doesn't
   operate every day, so daily figures read ₹0 most days and a same-day-vs-yesterday comparison
   was noise vs noise. Replaced with `GET /admin/reports/this-week` — a rolling 7-day window
   (today + the 6 days before it, not a Mon–Sun calendar week, so a comparison is never
   penalised for "the week just started") — compared against the 7 days before that
   (`lastWeek` field). KPI cards read "This Week's Revenue" etc.; delta shows "▲/▼ N% vs last
   week"; omitted when both windows are 0.
8. **Delivery Boys — current state, not "today"** — the old list only showed boys with a
   `Loading` or `Sale` record *today*, so on any day nothing happened it went empty even
   though boys were still out holding real stock. **Changed 2026-09-07**: new
   `GET /admin/reports/boys-snapshot` lists every active delivery boy's real current holdings
   (`computeHoldings()` summed) and this-week's sold/cash, regardless of today's activity.
   Distinct from `/eod`, which stays scoped to today for the Reports page's daily
   reconciliation — that scoping is correct there, wrong here.
9. **All-Time snapshot card** — Total Revenue, Net Profit (after overhead expenses, not gross),
   Total Orders, Sheets Sold, since the first recorded sale. Uses the already-existing
   `GET /admin/reports/overall` (built for the Reports page) — added to the Dashboard 2026-09-07
   so the owner isn't misled by the weekly Profit KPI, which is gross (before overheads); the
   card is explicitly subtitled "before overheads — see Net Profit below".
10. **Items Sold this month** shows revenue per item, not just sheets sold — the backing
    endpoint (`/admin/reports/item-sales`) already returned `revenue`/`profit`; only the sheets
    count was ever displayed.
11. Refresh button to reload all dashboard data

## Backend Endpoints Used
| Endpoint | Purpose |
|---|---|
| `GET /admin/reports/this-week` | Rolling 7-day KPI totals + top 5 items + `lastWeek` comparison (renamed from `/today` 2026-09-07 — see point 7) |
| `GET /admin/reports/boys-snapshot` | Every active boy's current holdings + this-week sold/cash (added 2026-09-07 — see point 8; NOT the same as `/eod`, which stays "today"-scoped for the Reports page) |
| `GET /admin/reports/overall` | All-time totals for the new All-Time card (added 2026-09-07 — see point 9) |
| `GET /admin/reports/item-sales` | This month's items, with revenue/profit |
| `GET /inventory` | For low-stock filtering (computed but not rendered — see point 5) |

## Key Files
- Frontend: `admin-dashboard/admin-dashboard.page.ts`, `admin-dashboard/admin-dashboard.page.html`
- Backend: `src/routes/admin-reports.route.ts`

> The old combined report view (EOD/Monthly/Staff tabs) has been moved to the dedicated **Reports** page at `/app/reports`.
