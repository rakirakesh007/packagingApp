# My Sales App — Spice Distribution Management

Full-stack sales and inventory management application for spice distribution business. Tracks inventory, sales, expenses, delivery assignments, marketing templates, and end-of-day reports.

---

## Quick Start

### Prerequisites

- **Node.js** v20+
- **Angular CLI** v21 (`npm i -g @angular/cli`)
- **MongoDB** (Atlas or local)
- **Git**

### Setup

```bash
# 1. Clone the repo
git clone <repo-url> my_sales_app && cd my_sales_app

# 2. Backend setup
cd backend
cp .env.example .env       # Add your MONGO_URI and JWT_SECRET
npm install
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
ng serve
```

- **Frontend:** http://localhost:4200 (proxied to backend via `proxy.conf.json`)
- **Backend API:** http://localhost:3000

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular (standalone components) | 21.x |
| UI Library | Angular Material + Tailwind CSS | 21.x |
| Mobile Shell | Ionic | 8.x |
| Backend | Express.js (TypeScript) | 5.x |
| Database | MongoDB + Mongoose | 8.x |
| Auth | JWT (jsonwebtoken) | — |
| Deployment | Render (backend) + MongoDB Atlas | — |

---

## Project Structure

```
my_sales_app/
├── README.md
├── CONTEXT-HANDOFF.md                ← Session handoff for AI continuity
├── DEPLOYMENT_GUIDE.md               ← MongoDB Atlas + Render deployment
├── docs/                             ← Architecture & reference documentation
│   ├── README.md
│   ├── architecture-overview.md
│   ├── tech-stack.md
│   ├── build-and-deploy.md
│   └── ai-context/
│       ├── conventions.md
│       ├── project-map.md
│       └── local-dev-setup.md
├── features/                         ← Feature documentation (per-feature)
│   ├── templates/                    ← Reusable templates for new features
│   │   ├── REQUIREMENTS.md
│   │   ├── INVESTIGATION.md
│   │   ├── DESIGN.md
│   │   ├── CHANGES.md
│   │   ├── ISSUES.md
│   │   └── CONTEXT-PROMPT.md
│   ├── auth/
│   ├── inventory/
│   ├── sales-cart/
│   ├── assignment/
│   ├── expenses/
│   ├── daily-sales/
│   ├── eod-report/
│   ├── admin-dashboard/
│   ├── admin-bulk-entry/
│   ├── marketing/
│   └── users-admin/
├── backend/                          ← Express + Mongoose API
│   ├── src/
│   │   ├── server.ts
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── cron/
│   │   └── scripts/
│   └── package.json
└── frontend/                         ← Angular 21 + Ionic + Tailwind
    ├── src/
    │   └── app/
    │       ├── app.routes.ts
    │       ├── core/                 ← Guards, interceptors, services
    │       ├── services/            ← Shared API services
    │       ├── models/              ← TypeScript interfaces
    │       └── [feature folders]/   ← Standalone components per feature
    └── package.json
```

---

## Features

| Feature | Route | Role | Description |
|---------|-------|------|-------------|
| Auth / Login | `/login` | All | JWT-based login |
| Admin Dashboard | `/app/admin` | Admin | Overview, stock alerts, reports |
| Inventory | `/app/inventory` | Admin | Product CRUD, stock management |
| Assignment | `/app/assignment` | Admin | Assign inventory to delivery boys |
| Sales Cart | `/app/sales` | Delivery Boy | Record shop sales |
| Daily Sales Report | `/app/daily-report` | Delivery Boy | View daily sales summary |
| Expenses | `/app/expenses` | All | Track daily expenses |
| EOD Report | `/app/eod-report` | All | End-of-day reconciliation |
| Bulk Entry | `/app/bulk-entry` | Admin | Bulk data entry |
| Marketing | `/app/marketing` | Admin | Marketing templates |
| User Management | `/app/users` | Admin | CRUD users and roles |

---

## Development Workflow

1. **Feature branches** — create a branch per feature/fix.
2. **Feature docs** — create/update docs in `features/<feature-name>/` following the template structure.
3. **Never push directly to main** — use feature branches + PR.
4. **Every commit/push requires review** — no auto-commits.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/architecture-overview.md](docs/architecture-overview.md) | System design |
| [docs/tech-stack.md](docs/tech-stack.md) | Technologies and versions |
| [docs/build-and-deploy.md](docs/build-and-deploy.md) | Build & deployment |
| [docs/ai-context/conventions.md](docs/ai-context/conventions.md) | Coding conventions |
| [docs/ai-context/project-map.md](docs/ai-context/project-map.md) | Project structure map |
| [docs/ai-context/local-dev-setup.md](docs/ai-context/local-dev-setup.md) | Local dev setup |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | MongoDB Atlas + Render |
