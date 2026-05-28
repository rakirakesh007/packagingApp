# Context Handoff — My Sales App

> **Purpose**: Paste this file's content into a new Copilot chat to resume context from a previous session.
> **Date**: 28 May 2026

---

## What This Project Is

Full-stack spice distribution management app with:
- **Frontend:** Angular 21 + Ionic + Tailwind CSS + Angular Material (standalone components)
- **Backend:** Express 5 + TypeScript + Mongoose 8 + MongoDB
- **Auth:** JWT-based with role-based access (Admin, Delivery Boy)
- **Deployment:** Render (backend) + MongoDB Atlas

## Current State

### Workspace Structure
```
my_sales_app/
├── README.md
├── CONTEXT-HANDOFF.md
├── DEPLOYMENT_GUIDE.md
├── docs/                    ← Architecture, tech-stack, conventions, AI context
├── features/                ← Per-feature documentation (11 features)
│   ├── templates/           ← Reusable doc templates for new features
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
├── backend/                 ← Express 5 + Mongoose API
└── frontend/                ← Angular 21 standalone components
```

### Key References
| Item | Value |
|------|-------|
| Frontend Port | 4200 (dev) |
| Backend Port | 3000 |
| Proxy | `proxy.conf.json` → localhost:3000 |
| Database | MongoDB (Atlas for prod, local for dev) |

### Features (11 modules)
| Feature | Frontend Path | Backend Route |
|---------|---------------|---------------|
| Auth | `auth/` | `/api/auth` |
| Admin Dashboard | `admin-dashboard/` | `/api/admin-reports` |
| Inventory | `inventory/` | `/api/inventory` |
| Assignment | `assignment/` | `/api/assignments` |
| Sales Cart | `sales-cart/` | `/api/sales` |
| Daily Sales | `daily-sales/` | `/api/reports` |
| EOD Report | `eod-report/` | `/api/reports` |
| Expenses | `expense/` | `/api/expenses` |
| Bulk Entry | `admin-bulk-entry/` | — |
| Marketing | `marketing-dashboard/` | `/api/marketing` |
| Users Admin | `users-admin/` | `/api/users` |

---

## Documentation Reading Order
1. `README.md` — project overview
2. `docs/architecture-overview.md` — system design
3. `docs/tech-stack.md` — technologies
4. `docs/ai-context/conventions.md` — coding rules
5. `docs/ai-context/project-map.md` — file structure map
6. `features/<feature>/REQUIREMENTS.md` — for specific feature work

## Feature Doc Pattern
Each feature folder follows the same structure:
- `REQUIREMENTS.md` — what to build
- `INVESTIGATION.md` — code analysis (create when investigating)
- `DESIGN.md` — implementation plan (create when designing)
- `CHANGES.md` — what was changed (create when implementing)
- `ISSUES.md` — bugs and known issues (create when fixing)
- `CONTEXT-PROMPT.md` — resume prompt (create for complex features)

Templates are in `features/templates/`.
