# Architecture Overview

## System Context

```
┌─────────────────────────────────────────────────────────┐
│                    My Sales App                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Frontend (Angular 21 + Ionic + Tailwind)         │   │
│  │  Standalone components, lazy-loaded routes         │   │
│  │  Port: 4200 (dev) / static build (prod)           │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │ HTTP (proxy in dev)                │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │  Backend (Express 5 + TypeScript)                 │   │
│  │  REST API, JWT auth, cron jobs                    │   │
│  │  Port: 3000                                       │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │ Mongoose                          │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │  MongoDB (Atlas / Local)                          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Frontend Architecture

Angular 21 with **standalone components** (no NgModules). All feature pages are lazy-loaded via `loadComponent` in `app.routes.ts`.

```
AppComponent
└── Routes
    ├── /login → LoginComponent
    └── /app → AppShellComponent (authGuard)
        ├── /admin → AdminDashboardPage
        ├── /inventory → InventoryPage
        ├── /assignment → AssignmentPage
        ├── /sales → SalesCartPage
        ├── /daily-report → DailySalesPage
        ├── /expenses → ExpensePage
        ├── /eod-report → EodReportComponent
        ├── /bulk-entry → AdminBulkEntryComponent
        ├── /marketing → MarketingDashboardPage
        └── /users → UsersAdminPage
```

### Key Patterns
- **Standalone components** — no NgModule wrappers
- **Lazy loading** — every route uses `loadComponent()`
- **Auth guard** — `authGuard` protects all `/app/*` routes
- **AppShellComponent** — layout wrapper (sidebar, header, footer)
- **Services in `services/`** — shared API services injected via `providedIn: 'root'`
- **Models in `models/`** — TypeScript interfaces for all entities

## Backend Architecture

Express 5 + TypeScript with Mongoose ODM.

> **Routes mount at the root — there is no `/api` prefix.** Frontend services call these paths directly (proxied in dev via `proxy.conf.json`).

```
server.ts (entry point)
├── Routes
│   ├── /auth            → auth.route.ts
│   ├── /inventory       → inventory.route.ts
│   ├── /sale            → sale.route.ts
│   ├── /assignment      → assignment.route.ts
│   ├── /expenses        → expenses.route.ts
│   ├── /shops           → shops.route.ts
│   ├── /users           → users.route.ts
│   ├── /reports         → reports.route.ts
│   ├── /admin/reports   → admin-reports.route.ts
│   └── /admin/marketing → marketing.route.ts
├── Models (Mongoose schemas)
│   ├── user.model.ts
│   ├── inventory.model.ts
│   ├── sale.model.ts
│   ├── expense.model.ts
│   ├── shop.model.ts
│   ├── loading.model.ts
│   └── marketing-template.model.ts
├── Controllers
│   ├── auth.controller.ts
│   └── sale.controller.ts
├── Cron Jobs
│   └── low-stock-cron.js
└── Scripts
    ├── seed.ts / seed-users.ts
    ├── insert-user.ts
    └── list-users.ts
```

## Auth Flow

```
User → Login Page → POST /auth/login (email + password)
  → Backend validates credentials, returns JWT token
  → Frontend stores token in localStorage
  → AuthService sets user state
  → authGuard (core/guards/auth.guard.ts) checks token on route navigation
  → authInterceptor (core/auth.interceptor.ts) adds Authorization: Bearer <token> header
  → 401 response → redirect to /login
  → Any user with isActive: false is blocked at login (HTTP 403)
```

## Data Flow

```
Admin:
  Inventory → Assignment → Delivery Boy → Sales → Daily Report → EOD Report

Delivery Boy:
  View Assigned Stock → Record Sales at Shops → Submit Daily Report → EOD Summary
```

## Roles

| Role | Access |
|------|--------|
| Admin | All routes — dashboard, inventory, assignment, users, reports, marketing |
| Delivery Boy | Sales cart, daily report, EOD report, expenses |
