# Project Map

## Frontend (`frontend/src/app/`)

```
app/
├── app.component.ts              ← Root component
├── app.module.ts                 ← Root module (bootstrapping)
├── app.routes.ts                 ← All lazy-loaded routes
│
├── core/                         ← Guards, interceptors, core services
│   └── guards/auth.guard.ts
│
├── auth/                         ← Login page + AuthService
│   ├── login.component.ts/html/scss
│   └── auth.service.ts
│
├── app-shell/                    ← Layout wrapper (sidebar + header + router-outlet)
│   └── app-shell.component.ts/html/scss
│
├── services/                     ← Shared API services (providedIn: root)
├── models/                       ← TypeScript interfaces
│
├── admin-dashboard/              ← Admin overview + stock alerts
├── inventory/                    ← Product CRUD, stock management
├── assignment/                   ← Assign stock to delivery boys
├── sales-cart/                   ← Record sales at shops
├── daily-sales/                  ← Daily sales report
├── eod-report/                   ← End-of-day reconciliation
├── expense/                      ← Expense tracking
├── admin-bulk-entry/             ← Bulk data entry
├── marketing-dashboard/          ← Marketing templates
├── users-admin/                  ← User CRUD
└── billing/                      ← (Legacy, redirects to sales)
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
├── routes/
│   ├── auth.route.ts
│   ├── inventory.route.ts
│   ├── sale.route.ts
│   ├── expenses.route.ts
│   ├── assignment.route.ts
│   ├── shops.route.ts
│   ├── users.route.ts
│   ├── reports.route.ts
│   ├── admin-reports.route.ts
│   └── marketing.route.ts
├── cron/
│   └── low-stock-cron.js         ← Periodic low-stock alerts
└── scripts/
    ├── seed.ts / seed-users.ts   ← DB seed scripts
    ├── insert-user.ts
    └── list-users.ts
```
