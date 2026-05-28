# Requirements — Admin Reports

## Business Goal
Give admins a dedicated deep-dive archive for EOD reconciliation, monthly
finance, and staff payroll — separate from the live KPI Dashboard.

## Route
`/app/reports` (sidebar link "Reports")

## Tabs

### 1. EOD Report
- **View toggle**: By Delivery Boy | By Product
- **By Delivery Boy table**: Name, Opening Stock (sheets), Sold, Remaining, Cash Collected
- **By Product table**: Item (hindi + english), Opening sheets, Sold, Remaining
- Export CSV (context-sensitive to current toggle view)

### 2. Monthly Summary
- Month/Year picker (defaults to current month)
- Metric cards: Total Revenue, Total Discounts, Total Expenses, Net Profit
- Refresh button

### 3. Staff Payments
- Per delivery boy: Sheets Sold, Total Sales (₹), Net Cash (₹), Payment Status badge
- Download Monthly PDF (print-ready window)

## Backend Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/reports/today` | Dashboard KPIs + top 5 items |
| `GET /admin/reports/eod` | Today's EOD by delivery boy (resolved names) |
| `GET /admin/reports/eod-by-product` | Today's EOD grouped by product |
| `GET /admin/reports/monthly?month=&year=` | Monthly financial summary |
| `GET /admin/reports/staff-monthly?month=&year=` | Per-staff payroll data |

## Key Files
- Frontend: `admin-reports/admin-reports.page.ts`, `admin-reports/admin-reports.page.html`
- Backend: `src/routes/admin-reports.route.ts`

## Notes
- EOD delivery-boy names are resolved via `UserModel` lookup (not raw ObjectIds)
- Date ranges use `new Date(y, m, d, h, min, s)` construction to avoid `setHours` mutation bug
- All `forkJoin` calls use `catchError(() => of(fallback))` so a single API failure doesn't blank the whole page
