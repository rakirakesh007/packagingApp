# Requirements — Admin Reports

## Business Goal
Give admins a dedicated deep-dive archive for EOD reconciliation, monthly
finance, and staff payroll — separate from the live KPI Dashboard.

## Route
`/app/reports` (sidebar link "Reports")

## Tabs

### 1. EOD Report (single merged view)
- **By Delivery Boy table** (top): Name, Opening Stock (sheets), Sold, Remaining, Cash Collected
- **By Product compact grid** (below): dense responsive grid (1–4 cols), one line per item —
  hindi name + per-sheet price chip · sold · left (red when negative)
- One Export CSV containing both sections (two headed blocks)

### 2. Monthly Summary
- Month/Year picker (defaults to current month)
- Metric cards: Total Revenue, Gross Profit, Total Expenses, Net Profit
- Daily revenue bar chart + Refresh button
- **Item-wise Sales table**: hindi name + ₹MRP chip, sheets sold, revenue, profit (sorted by sheets desc)
- **Expense Breakdown**: month's expenses grouped by category, with total
- **Overall (all time)** card row: Revenue, Gross Profit, Expenses, Net Profit — plus since-date,
  sales count, total sheets (from `GET /admin/reports/overall`; not affected by the month picker)
- Profit figures are REAL profit (see inventory cost fields + `utils/profit.util.ts`), not the old 10% approximation

### 3. Staff Payments
- Per delivery boy: Sheets Sold, Total Sales (₹), Net Cash (₹), Payment Status badge
- Download Monthly PDF (print-ready window)

### 4. Payout (delivery-boy commission)
- Month-scoped (reuses the global Month/Year picker); one row per **(date × delivery boy)**.
- Columns: Date, Delivery Boy, ₹5 Sheets, ₹10 Sheets, Payout (₹), plus a month total footer row.
- **Payout = commission the owner pays the boy**, a per-sheet rate that rewards full-price sales:
  `rate = selling_price_per_sheet >= mrp×9 ? mrp : mrp×0.8`
  → ₹5 item: ₹5/sheet at full price (45), else ₹4. ₹10 item: ₹10/sheet at full price (90), else ₹8.
  `payout = Σ rate × sheets_sold` per (date, boy). Variant is resolved from inventory `mrp_per_unit`.
- Export CSV.

## Backend Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/reports/today` | Dashboard KPIs + top 5 items |
| `GET /admin/reports/eod` | Today's EOD by delivery boy (resolved names) |
| `GET /admin/reports/eod-by-product` | Today's EOD grouped by product |
| `GET /admin/reports/monthly?month=&year=` | Monthly financial summary + `expenseByCategory` |
| `GET /admin/reports/item-sales?month=&year=` | Item-wise sheets/revenue/profit for a month |
| `GET /admin/reports/overall` | All-time totals (revenue, profit, expenses, net, sheets, first sale) |
| `GET /admin/reports/staff-monthly?month=&year=` | Per-staff payroll data |
| `GET /admin/reports/boy-payout?month=&year=` | Per (date × boy) commission owed, split by ₹5/₹10 sheets |

Removed: the orphaned `GET /reports/eod/:deliveryBoyId` endpoint and the unlinked
`eod-report` page were deleted (July 2026) — the EOD tab here and the delivery boy's
Daily Report tab cover both audiences.

## Key Files
- Frontend: `admin-reports/admin-reports.page.ts`, `admin-reports/admin-reports.page.html`
- Backend: `src/routes/admin-reports.route.ts`

## Notes
- EOD delivery-boy names are resolved via `UserModel` lookup (not raw ObjectIds)
- Date ranges use `new Date(y, m, d, h, min, s)` construction to avoid `setHours` mutation bug
- Every request in both `forkJoin`s is wrapped with `catchError(() => of(fallback))` so a single API failure doesn't blank the whole page
