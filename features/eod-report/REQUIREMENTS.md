# Requirements — EOD Report

## Business Goal
End-of-day reconciliation showing assigned stock vs sold stock vs returned stock, plus expenses and cash collected.

## User Stories
- As a **delivery boy**, I want to see my full EOD summary (stock assigned, sold, returned, expenses, cash).
- As an **admin**, I want to view any delivery boy's EOD report.
- As a **delivery boy**, I want to record my returns so the warehouse stock is corrected.

## Numbered Requirements
1. Stock reconciliation per item (delivery-boy view at `/app/eod-report`):
   - Item shown as: `hindi_name (english_name)` or english if no hindi
   - Opening = `LoadingModel.items[].qty` (sheets)
   - Sold = `SaleModel.items[].sheets_sold`
   - Remaining = Opening − Sold (highlighted red if negative)
2. Cash collected summary (sum of `SaleModel.total_amount`)
3. Net Cash to Deposit displayed prominently
4. "Share via WhatsApp" sends EOD summary
5. Admin EOD view (at `/app/reports` → EOD tab) shows:
   - **By Delivery Boy** toggle: name, opening sheets, sold, remaining, cash collected
   - **By Product** toggle: item name, opening sheets, sold, remaining
   - Export CSV for each view
6. Date query bug fixed: uses `new Date(y, m, d, h, min, s)` (not `setHours` mutation)

## Key Files
- Frontend: `eod-report/eod-report.component.ts`
- Backend: `src/routes/reports.route.ts`, `src/routes/assignment.route.ts`
