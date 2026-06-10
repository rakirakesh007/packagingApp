# Project Map

## Frontend (`frontend/src/app/`)

```
app/
├── app.component.ts              ← Root component (bootstrapped in src/main.ts — no NgModule)
├── app.routes.ts                 ← All lazy-loaded routes
│
├── core/                         ← Guards, interceptors, config
│   ├── guards/auth.guard.ts      ← Protects /app/* routes
│   ├── auth.interceptor.ts       ← Attaches JWT to outgoing requests
│   └── pricing.config.ts         ← MRP → wholesale price / commission table
│
├── auth/                         ← Login page + AuthService
│   ├── login.component.ts/html/scss
│   └── auth.service.ts
│
├── app-shell/                    ← Layout wrapper (sidebar + header + router-outlet)
│   └── app-shell.component.ts/html/scss
│
├── services/                     ← Shared API services (providedIn: root)
├── models/                       ← TypeScript interfaces (mirror backend fields, _id → id)
│
├── admin-dashboard/              ← Admin overview + KPIs + stock alerts
├── inventory/                    ← Product CRUD, stock, print 15-up labels
├── label-sheet/                  ← Printable A4 15-up product label sheet (jspdf)
├── assignment/                   ← Assign (reserve) stock to delivery boys
├── sales-cart/                   ← Record sales at shops + WhatsApp bill/catalog
├── daily-sales/                  ← Daily sales report (cash/online split)
├── eod-report/                   ← End-of-day reconciliation
├── expense/                      ← Expense tracking
├── admin-bulk-entry/             ← Spreadsheet-style bulk data entry
├── admin-reports/                ← Monthly summary + staff payments/payroll
├── marketing-dashboard/          ← Marketing templates / shops
├── users-admin/                  ← User & delivery-boy CRUD (isActive gate)
└── billing/                      ← (Legacy, redirects to /app/sales)
```

## Backend (`backend/src/`)

```
src/
├── server.ts                     ← Express app entry point
├── controllers/
│   ├── auth.controller.ts        ← Login/register logic
│   └── sale.controller.ts        ← Sale processing logic
├── models/
│   ├── user.model.ts             ← User schema (roles, auth)
│   ├── inventory.model.ts        ← Product/stock schema
│   ├── sale.model.ts             ← Sale transaction schema
│   ├── expense.model.ts          ← Expense schema
│   ├── shop.model.ts             ← Shop/retailer schema
│   ├── loading.model.ts          ← Stock loading schema
│   └── marketing-template.model.ts
├── routes/                       ← Mounted at root in server.ts (no /api prefix)
│   ├── auth.route.ts             → /auth
│   ├── inventory.route.ts        → /inventory
│   ├── sale.route.ts             → /sale
│   ├── assignment.route.ts       → /assignment
│   ├── expenses.route.ts         → /expenses
│   ├── shops.route.ts            → /shops
│   ├── users.route.ts            → /users
│   ├── reports.route.ts          → /reports
│   ├── admin-reports.route.ts    → /admin/reports
│   └── marketing.route.ts        → /admin/marketing
├── cron/
│   └── low-stock-cron.js         ← Daily low-stock alert (node-cron; NOT wired into server.ts yet)
├── seed.ts / seed-users.ts       ← DB seed scripts (run with ts-node)
└── scripts/
    ├── insert-user.ts
    ├── list-users.ts
    └── reset-dummy-data.ts       ← Reset DB to a known demo state
```
