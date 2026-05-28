# My Sales App — Complete Project Reference

> **What is this?**
> A full-stack sales and inventory management application built for a **spice distribution business**. It digitises the entire daily operations cycle — from loading stock onto delivery boys in the morning, recording sales at shops during the day, logging expenses, to generating end-of-day reconciliation reports at night.

---

## Table of Contents

1. [Business Problem & Purpose](#1-business-problem--purpose)
2. [Who Uses It (Roles)](#2-who-uses-it-roles)
3. [How a Day Works (Operational Flow)](#3-how-a-day-works-operational-flow)
4. [Tech Stack](#4-tech-stack)
5. [System Architecture](#5-system-architecture)
6. [Project Structure](#6-project-structure)
7. [Features — Detailed Breakdown](#7-features--detailed-breakdown)
   - 7.1 [Authentication](#71-authentication)
   - 7.2 [User Management (Admin)](#72-user-management-admin)
   - 7.3 [Inventory Management](#73-inventory-management)
   - 7.4 [Assignment (Stock Loading)](#74-assignment-stock-loading)
   - 7.5 [Sales Cart](#75-sales-cart)
   - 7.6 [Daily Sales Report](#76-daily-sales-report)
   - 7.7 [EOD Report](#77-eod-report-end-of-day)
   - 7.8 [Expenses](#78-expenses)
   - 7.9 [Admin Dashboard](#79-admin-dashboard)
   - 7.10 [Admin Bulk Entry](#710-admin-bulk-entry)
   - 7.11 [Marketing](#711-marketing)
8. [Data Models](#8-data-models)
9. [API Routes Reference](#9-api-routes-reference)
10. [Stock Management Rules](#10-stock-management-rules)
11. [Auth & Security](#11-auth--security)
12. [Running the Project Locally](#12-running-the-project-locally)
13. [Deployment](#13-deployment)

---

## 1. Business Problem & Purpose

A spice distribution company operates like this every day:

- A **warehouse** holds all product stock.
- Each morning, the **admin** loads specific products and quantities onto **delivery boys** (field sales agents).
- Delivery boys drive to shops/retailers, sell products, collect cash, and record expenses.
- At the end of the day, the admin needs to know: what was sold, how much cash was collected, what was returned, and what expenses were incurred.

Before this app, all this was tracked on paper — error-prone, slow, and hard to audit. This app replaces the paper trail with a real-time digital system accessible from mobile devices.

---

## 2. Who Uses It (Roles)

| Role | Who | What They Do |
|---|---|---|
| **Admin** | Business owner / manager | Manages inventory, assigns stock, views all reports, manages users, does bulk data entry, views marketing |
| **Delivery Boy** | Field sales agent | Views their assigned stock, records sales at shops, logs expenses, views their own EOD report |

Role-based access is enforced both on the frontend (route visibility) and backend (JWT token claims).

---

## 3. How a Day Works (Operational Flow)

```
MORNING
  Admin
    │
    ├─► Checks inventory stock levels (Inventory page)
    └─► Creates Assignment → selects delivery boy + products + quantities
              │
              └─► LoadingModel record created (delivery boy's "loaded stock" for the day)
                  InventoryModel is NOT touched here (stock deducted only when sold)

DURING THE DAY
  Delivery Boy
    │
    ├─► Opens Sales Cart → sees assigned products
    ├─► Visits a shop → adds products to cart → submits sale
    │       └─► SaleModel record created
    │           InventoryModel.total_stock decremented (single, accurate deduction)
    └─► Logs any expenses (fuel, food, etc.)

EVENING
  Delivery Boy / Admin
    │
    ├─► Views Daily Sales Report (all sales for the day)
    └─► Views EOD Report:
            Assigned (LoadingModel.qty)
          − Sold    (SaleModel.qty)
          = Returned (unsold stock — physical return to warehouse)
          + Expenses
          = Net Cash to Submit
```

---

## 4. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | Angular (standalone components) | 21.x | SPA framework |
| UI Shell | Ionic | 8.x | Mobile-first layout, navigation |
| UI Components | Angular Material | 21.x | Forms, tables, dialogs |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Language | TypeScript | 5.x | Type-safe JS across all layers |
| Reactive | RxJS | 7.x | Observables and async data streams |
| Backend | Express.js | 5.x | REST API server |
| ORM/ODM | Mongoose | 8.x | MongoDB schema + query layer |
| Database | MongoDB (Atlas) | 7.x+ | NoSQL document store |
| Auth | jsonwebtoken (JWT) | — | Stateless token auth |
| Passwords | bcryptjs | — | Password hashing |
| Cron | node-cron | — | Low-stock alert background job |
| Dev Tools | nodemon, ts-node, Angular CLI | — | Hot reload, build, generate |
| Hosting | Render (backend) + MongoDB Atlas | — | Production deployment |

---

## 5. System Architecture

```
┌──────────────────────────────────────────────┐
│             Browser / Mobile                 │
│   Angular 21 + Ionic + Tailwind              │
│   Standalone components, lazy-loaded routes  │
│   Port 4200 (dev) / static build (prod)      │
└─────────────────┬────────────────────────────┘
                  │ HTTP REST (JSON)
                  │ Authorization: Bearer <JWT>
┌─────────────────▼────────────────────────────┐
│         Backend — Express 5 + TypeScript      │
│         REST API + JWT auth + cron jobs       │
│         Port 3000                             │
└─────────────────┬────────────────────────────┘
                  │ Mongoose ODM
┌─────────────────▼────────────────────────────┐
│            MongoDB Atlas                      │
│   Collections: users, inventory, sales,       │
│   loadings, expenses, shops, marketing-       │
│   templates                                   │
└──────────────────────────────────────────────┘
```

### Frontend Route Tree

```
/login            → LoginComponent (public)
/app              → AppShellComponent (authGuard — all routes below are protected)
  /admin          → AdminDashboardPage          (Admin only)
  /inventory      → InventoryPage               (Admin only)
  /assignment     → AssignmentPage              (Admin only)
  /users          → UsersAdminPage              (Admin only)
  /bulk-entry     → AdminBulkEntryComponent     (Admin only)
  /marketing      → MarketingDashboardPage      (Admin only)
  /sales          → SalesCartPage               (Delivery Boy)
  /daily-report   → DailySalesPage              (Delivery Boy)
  /expenses       → ExpensePage                 (Delivery Boy + Admin)
  /eod-report     → EodReportComponent          (Delivery Boy + Admin)
```

### Backend API Map

```
/api/auth          → auth.route.ts           Login, JWT issue
/api/inventory     → inventory.route.ts      Product CRUD, stock levels
/api/assignments   → assignment.route.ts     Daily stock loading
/api/sales         → sale.route.ts           Record sales, bulk entry
/api/expenses      → expenses.route.ts       Log & view expenses
/api/reports       → reports.route.ts        Delivery boy daily + EOD reports
/api/admin-reports → admin-reports.route.ts  Admin-wide aggregated reports
/api/users         → users.route.ts          User CRUD
/api/shops         → shops.route.ts          Shop/retailer records
/api/marketing     → marketing.route.ts      Marketing template CRUD
```

---

## 6. Project Structure

```
my_sales_app/
├── README.md
├── PROJECT_OVERVIEW.md          ← This file — complete reference
├── DEPLOYMENT_GUIDE.md
├── CONTEXT-HANDOFF.md
│
├── docs/                        ← Architecture & dev reference docs
│   ├── architecture-overview.md
│   ├── tech-stack.md
│   ├── build-and-deploy.md
│   └── ai-context/
│       ├── conventions.md
│       ├── project-map.md
│       └── local-dev-setup.md
│
├── features/                    ← Per-feature requirements docs
│   ├── auth/
│   ├── inventory/
│   ├── assignment/
│   ├── sales-cart/
│   ├── daily-sales/
│   ├── eod-report/
│   ├── expenses/
│   ├── admin-dashboard/
│   ├── admin-bulk-entry/
│   ├── marketing/
│   └── users-admin/
│
├── backend/
│   └── src/
│       ├── server.ts            ← Entry point, Express app setup
│       ├── routes/              ← All API route files
│       ├── controllers/         ← Business logic (auth, sale)
│       ├── models/              ← Mongoose schemas
│       ├── cron/                ← Background jobs
│       └── scripts/             ← Seed & utility scripts
│
└── frontend/
    └── src/
        └── app/
            ├── app.routes.ts    ← All lazy-loaded routes
            ├── app-shell/       ← Layout (sidebar, header)
            ├── core/            ← Guards, interceptors
            ├── services/        ← Shared API services
            ├── models/          ← TypeScript interfaces
            └── [feature]/       ← One folder per feature page
```

---

## 7. Features — Detailed Breakdown

---

### 7.1 Authentication

**What it does:** Secures the entire app with JWT-based login. Only authorized users with the correct role can access their routes.

**How it works:**
1. User opens the app → lands on `/login`.
2. Enters email + password → `POST /api/auth/login`.
3. Backend validates credentials (bcrypt hash compare), issues a signed JWT containing `userId` and `role`.
4. Frontend stores the token in `localStorage`.
5. An **HTTP interceptor** automatically attaches `Authorization: Bearer <token>` to every outgoing request.
6. An **auth guard** (`authGuard`) checks for a valid token on every `/app/*` route navigation.
7. If a `401 Unauthorized` response is received at any point, the user is auto-logged out and redirected to `/login`.
8. On logout, token is cleared and the user is redirected to `/login`.

**Role-based visibility:**
- Admins see: dashboard, inventory, assignment, users, bulk-entry, marketing.
- Delivery boys see: sales cart, daily report, EOD report, expenses.

**Key files:**
- `frontend/src/app/auth/login.component.ts`
- `frontend/src/app/core/guards/auth.guard.ts`
- `backend/src/routes/auth.route.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/models/user.model.ts`

---

### 7.2 User Management (Admin)

**What it does:** Lets admins create, view, edit, and deactivate user accounts for delivery boys and other admins.

**Requirements:**
1. User CRUD — name, email, password, role, phone number.
2. Role assignment: `admin` or `delivery_boy`.
3. User list with search and filter.
4. Activate / deactivate users (without deleting them).

**Key files:**
- `frontend/src/app/users-admin/users-admin.page.ts`
- `backend/src/routes/users.route.ts`
- `backend/src/models/user.model.ts`

---

### 7.3 Inventory Management

**What it does:** The product master. Admins manage all spice products, their prices, units, and warehouse stock levels.

**Requirements:**
1. Full product CRUD — item name, Hindi name, price, unit/pack quantity, MRP, description, category.
2. `total_stock` field tracks current warehouse stock level.
3. Low-stock threshold alerts — admin sees a warning when stock falls below the configured threshold.
4. Search and filter products by name or category.
5. Bulk stock update support.
6. A **cron job** (`low-stock-cron.js`) runs on a schedule to check and flag low-stock items automatically.

**Important stock rule:** `InventoryModel.total_stock` is decremented **only when a sale is recorded** (not when stock is assigned to a delivery boy). This keeps warehouse stock numbers always accurate in real time.

**Key files:**
- `frontend/src/app/inventory/inventory.page.ts`
- `backend/src/routes/inventory.route.ts`
- `backend/src/models/inventory.model.ts`
- `backend/src/cron/low-stock-cron.js`

---

### 7.4 Assignment (Stock Loading)

**What it does:** Each morning, the admin assigns specific products and quantities to delivery boys — this becomes the delivery boy's "loaded stock" for the day.

**Requirements:**
1. Admin selects a delivery boy and a list of products with quantities.
2. A `LoadingModel` document is created (or updated if the same boy is assigned again on the same day — additive, not blocked).
3. Item metadata (name, Hindi name, unit price) is denormalized into the `LoadingModel` at creation time.
4. Assignment is date-tracked; history is kept.
5. Delivery boys can view their own active assignment for today.

**Critical design point — Option A stock model:**
> Assignment does **NOT** decrement `InventoryModel.total_stock`.
> Stock is only decremented when a sale is actually recorded.
> This prevents double-deduction and eliminates the need for EOD stock reconciliation.

**Key files:**
- `frontend/src/app/assignment/assignment.page.ts`
- `backend/src/routes/assignment.route.ts`
- `backend/src/models/loading.model.ts`

---

### 7.5 Sales Cart

**What it does:** The primary tool for delivery boys in the field. They select a shop, pick products from their assigned stock, set quantities, and submit the sale.

**Requirements:**
1. Shop selection — search existing shops or create a new one on the fly (by entering mobile number + name).
2. Product picker — shows products from today's `LoadingModel` assignment.
3. Quantity adjustment with live price calculation.
4. Cart summary showing line items and running total.
5. On submission:
   - A `SaleModel` document is created.
   - `InventoryModel.total_stock` is decremented atomically for each item sold.
   - If a shop mobile number is provided, the `ShopModel` is upserted with `total_orders_count` incremented.
6. Full sale history per delivery boy.

**Key files:**
- `frontend/src/app/sales-cart/sales-cart.page.ts`
- `backend/src/routes/sale.route.ts`
- `backend/src/controllers/sale.controller.ts`
- `backend/src/models/sale.model.ts`

---

### 7.6 Daily Sales Report

**What it does:** Shows a delivery boy all of their sales for a given day, grouped and totalled.

**Requirements:**
1. Sales list for today, grouped by shop.
2. Date picker to look at historical dates.
3. Total amount and total quantity summary at the bottom.
4. Export / share capability.

**Key files:**
- `frontend/src/app/daily-sales/daily-sales.page.ts`
- `backend/src/routes/reports.route.ts`

---

### 7.7 EOD Report (End of Day)

**What it does:** The evening reconciliation. Shows each delivery boy (and admin) a complete picture of what happened during the day.

**How the calculation works:**

```
Assigned Stock   = LoadingModel.items[].qty    (what was loaded in the morning)
Sold Stock       = SaleModel.items[].qty       (what was actually sold)
Returned Stock   = Assigned − Sold             (what comes back to the warehouse)
Cash Collected   = Sum of SaleModel.total_amount
Expenses         = Sum of ExpenseModel.amount  (fuel, food, etc.)
Net Cash         = Cash Collected − Expenses   (amount delivery boy hands over)
```

**Requirements:**
1. Per-item stock reconciliation (assigned vs sold vs returned).
2. Cash collected summary.
3. Expenses deducted from cash collected.
4. Net amount to submit to admin.
5. Date-based EOD history — can view any past date.
6. Admin can view any delivery boy's EOD report.

**Key files:**
- `frontend/src/app/eod-report/eod-report.component.ts`
- `backend/src/routes/reports.route.ts`

---

### 7.8 Expenses

**What it does:** Delivery boys (and admins) log daily operational expenses. These feed into the EOD report's net cash calculation.

**Requirements:**
1. Expense entry with: amount, category, description, date.
2. Categories: fuel, food, transport, other.
3. Expense list with date filtering.
4. Admin view — see all expenses across all users.

**Key files:**
- `frontend/src/app/expense/expense.page.ts`
- `backend/src/routes/expenses.route.ts`
- `backend/src/models/expense.model.ts`

---

### 7.9 Admin Dashboard

**What it does:** The admin's home screen — a high-level business overview with alerts and quick actions.

**Requirements:**
1. Sales summary — today, this week, this month.
2. Low-stock alert badge showing count of items below threshold, with a drill-down list.
3. Delivery boy performance overview — who sold what today.
4. Quick action buttons — add inventory, create assignment.
5. Revenue and expense trend charts.

**Key files:**
- `frontend/src/app/admin-dashboard/admin-dashboard.page.ts`
- `frontend/src/app/admin-dashboard/stock-alert-badge.component.ts`
- `backend/src/routes/admin-reports.route.ts`

---

### 7.10 Admin Bulk Entry

**What it does:** Saves time when the admin needs to enter many records at once (e.g., entering a day's worth of sales from a paper sheet, or doing a stock correction across many products).

**Requirements:**
1. Spreadsheet-like form UI with dynamic row addition.
2. Per-row validation before submission.
3. Batch API submission — all rows sent in one request.
4. Success/error feedback shown per row.

**Key files:**
- `frontend/src/app/admin-bulk-entry/admin-bulk-entry.component.ts`
- `backend/src/routes/sale.route.ts` → `POST /sale/bulk`

---

### 7.11 Marketing

**What it does:** A template library for promotional content, offers, and retailer communication messages.

**Requirements:**
1. Marketing template CRUD — title, content body, type/category.
2. Template preview before sending/sharing.
3. Template list with search and filter.

**Key files:**
- `frontend/src/app/marketing-dashboard/marketing-dashboard.page.ts`
- `backend/src/routes/marketing.route.ts`
- `backend/src/models/marketing-template.model.ts`

---

## 8. Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `name` | String | Display name |
| `email` | String | Unique, used for login |
| `password` | String | bcrypt hashed |
| `role` | Enum | `admin` \| `delivery_boy` |
| `phone` | String | Contact number |
| `is_active` | Boolean | Soft enable/disable |

### Inventory (Product)
| Field | Type | Notes |
|---|---|---|
| `item_name` | String | English product name |
| `hindi_name` | String | Hindi product name |
| `unit_price` | Number | Selling price |
| `mrp` | Number | Maximum retail price |
| `quantity` | Number | Pack size (e.g. 500g) |
| `total_stock` | Number | Current warehouse units — decremented only on sale |
| `description` | String | Product notes |
| `low_stock_threshold` | Number | Alert trigger level |

### Loading (Assignment)
| Field | Type | Notes |
|---|---|---|
| `delivery_boy_id` | ObjectId → User | Who was assigned |
| `date` | Date | Assignment date |
| `items` | Array | `{ item_id, qty, item_name, hindi_name, unit_price }` — denormalized |

### Sale
| Field | Type | Notes |
|---|---|---|
| `delivery_boy_id` | ObjectId → User | Who made the sale (null for bulk entry) |
| `customer_name` | String | Buyer name |
| `shop_name` | String | Shop name |
| `shop_id` | ObjectId → Shop | Linked shop record |
| `items` | Array | `{ item_id, qty, price, item_name, ... }` — denormalized |
| `total_amount` | Number | Sale total |
| `payment_mode` | Enum | `cash` \| `upi` \| etc. |
| `timestamp` | Date | When the sale occurred |

### Expense
| Field | Type | Notes |
|---|---|---|
| `user_id` | ObjectId → User | Who logged it |
| `amount` | Number | Expense amount |
| `category` | Enum | `fuel` \| `food` \| `transport` \| `other` |
| `description` | String | Free text notes |
| `date` | Date | Expense date |

### Shop
| Field | Type | Notes |
|---|---|---|
| `name` | String | Shop/retailer name |
| `mobile` | String | Unique mobile number |
| `total_orders_count` | Number | Lifetime order count (auto-incremented on sale) |

### MarketingTemplate
| Field | Type | Notes |
|---|---|---|
| `title` | String | Template name |
| `content` | String | Message body |
| `type` | String | Category / type |

---

## 9. API Routes Reference

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/inventory` | List all products |
| POST | `/api/inventory` | Add new product |
| PUT | `/api/inventory/:id` | Update product |
| DELETE | `/api/inventory/:id` | Delete product |
| POST | `/api/assignments` | Create/update daily assignment |
| GET | `/api/assignments/active/:deliveryBoyId` | Today's assignment |
| GET | `/api/assignments/date/:deliveryBoyId?date=` | Assignment for any date |
| POST | `/api/sales` | Record a sale (decrements stock) |
| POST | `/api/sales/bulk` | Admin bulk sale entry |
| GET | `/api/sales/today/:deliveryBoyId` | Today's sales |
| GET | `/api/sales/history/:deliveryBoyId` | Full sale history |
| GET | `/api/expenses` | All expenses (admin) |
| POST | `/api/expenses` | Log expense |
| GET | `/api/reports/eod/:deliveryBoyId?date=` | EOD report for a date |
| GET | `/api/admin-reports/summary` | Admin-wide business summary |
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| GET | `/api/shops` | List shops |
| GET | `/api/marketing` | List templates |
| POST | `/api/marketing` | Create template |
| PUT | `/api/marketing/:id` | Update template |
| DELETE | `/api/marketing/:id` | Delete template |

---

## 10. Stock Management Rules

These are the core invariants the codebase is built around:

| Rule | Detail |
|---|---|
| **Single deduction point** | `InventoryModel.total_stock` is decremented **only** when `POST /api/sales` or `POST /api/sales/bulk` is called — never at assignment time. |
| **Atomic updates** | All stock decrements use MongoDB `$inc` operator — never read-then-write to prevent race conditions. |
| **No negative stock guard** | `sale.controller.ts` uses `{ total_stock: { $gte: item.qty } }` as a filter condition, so the update only succeeds if there is enough stock; otherwise it throws `Insufficient stock`. |
| **Denormalized item info** | Item names, prices, and units are copied into both `LoadingModel` and `SaleModel` at creation time so historical records are unaffected by future product edits. |
| **EOD is read-only** | The EOD report is computed (assigned − sold = returned) but never writes back to inventory. The returned stock is physically handed back by the delivery boy; the admin adjusts inventory manually if needed. |

---

## 11. Auth & Security

- Passwords are hashed with **bcrypt** (never stored in plain text).
- JWT tokens are signed with `JWT_SECRET` from environment variables.
- Token is stored in `localStorage` on the frontend.
- Every API request carries the token in the `Authorization: Bearer` header, added automatically by the Angular HTTP interceptor.
- Backend validates the JWT on protected routes.
- A `401` response from any endpoint triggers automatic logout and redirect to `/login`.
- Role (`admin` / `delivery_boy`) is embedded in the JWT payload and checked on both frontend routes and sensitive backend endpoints.

---

## 12. Running the Project Locally

### Prerequisites
- Node.js v20+
- Angular CLI v21 (`npm i -g @angular/cli`)
- MongoDB (local or Atlas connection string)

### Backend
```bash
cd backend
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev               # starts on http://localhost:3000
```

### Frontend
```bash
cd frontend
npm install
ng serve                  # starts on http://localhost:4200
                          # proxied to backend via proxy.conf.json
```

### Seed Data (optional)
```bash
cd backend
npx ts-node src/scripts/insert-user.ts    # creates an admin user
npx ts-node src/seed.ts                   # seeds sample inventory
```

---

## 13. Deployment

| Component | Service |
|---|---|
| Backend API | **Render** (web service) |
| Database | **MongoDB Atlas** (free tier M0 or above) |
| Frontend | Build with `ng build --configuration production`, serve as static files or host on Netlify/Vercel/Render static |

**Environment variables required on Render:**

| Variable | Value |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | A long random secret string |
| `PORT` | `3000` (or Render auto-assigns) |
| `NODE_ENV` | `production` |

Refer to [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for the full step-by-step Render + Atlas setup.

---

*Last updated: May 2026*
