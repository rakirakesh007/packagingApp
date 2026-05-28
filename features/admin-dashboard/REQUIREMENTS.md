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
5. **Low Stock Alerts** — auto-shown panel when any item ≤ threshold; links to Inventory
6. Refresh button to reload all dashboard data

## Backend Endpoints Used
| Endpoint | Purpose |
|---|---|
| `GET /admin/reports/today` | KPI totals + top 5 items |
| `GET /admin/reports/eod` | Per-delivery-boy summary (with names) |
| `GET /inventory` | For low-stock filtering |

## Key Files
- Frontend: `admin-dashboard/admin-dashboard.page.ts`, `admin-dashboard/admin-dashboard.page.html`
- Backend: `src/routes/admin-reports.route.ts`

> The old combined report view (EOD/Monthly/Staff tabs) has been moved to the dedicated **Reports** page at `/app/reports`.
