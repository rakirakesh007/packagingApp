# CLAUDE.md — DesiMasalaHub (my_sales_app)

Guidance for Claude Code when working in this repository. Read this first; it is the source of truth for stack, conventions, and the business rules that must never be broken.

## What this is

A spice-distribution management app for a small wholesale business ("DesiMasalaHub").

- **Admin** (laptop/desktop): inventory, stock assignment, reports, payroll, marketing, bulk entry. Sidebar layout, dense tables.
- **Delivery boy** (mobile phone): record sales on the daily route, view daily sales report. Mobile-first, bottom-tab nav, large touch targets.

## Tech stack (verified against `package.json`)

- **Frontend:** Angular **21** (standalone components, Signals, `inject()`, `ChangeDetectionStrategy.OnPush`), Ionic 8, Angular Material + CDK, Tailwind CSS, `lucide-angular`, `jspdf` + `html2canvas` + `file-saver` (client-side PDF/labels). Dev server on `:4200`.
- **Backend:** Express **5** + TypeScript, Mongoose **8**, JWT (`jsonwebtoken`) + `bcryptjs`. Server on `:3000`.
- **Database:** MongoDB (Atlas in prod, local in dev).
- **Deploy:** Render + MongoDB Atlas.

## Commands

```bash
# Frontend (from frontend/)
npm install
npm start            # ng serve → http://localhost:4200 (proxies API to :3000)
npm run build        # production build → frontend/dist/

# Backend (from backend/)
npm install
npm run dev          # nodemon src/server.ts → http://localhost:3000
npm run build        # tsc → dist/
npm start            # node dist/server.js

# DB scripts (from backend/)
npx ts-node src/seed.ts
npx ts-node src/seed-users.ts
npx ts-node src/scripts/reset-dummy-data.ts
```

## API wiring — IMPORTANT

- Backend routes are mounted at the **root**, NOT under `/api`. Real mounts (`server.ts`): `/auth`, `/inventory`, `/sale` (singular), `/assignment` (singular), `/admin/reports`, `/admin/marketing`, `/expenses`, `/users`, `/shops`.
- Frontend services call **relative paths** (`this.http.get('/inventory')`). In dev, `frontend/proxy.conf.json` proxies each top-level path to `:3000`. Do not prefix calls with `/api`.
- Auth: `authInterceptor` (`frontend/src/app/core/auth.interceptor.ts`) attaches the JWT; `authGuard` (`core/guards/auth.guard.ts`) protects `/app/*` routes. Bootstrap is `bootstrapApplication` in `main.ts` — there is **no `app.module.ts`**.

## Business golden rules (do not break)

1. **Atomic stock.** Sales decrement inventory via Mongoose `$inc` inside a transaction (`sale.route.ts`). Never overwrite stock from a frontend-computed number. A sale is **never blocked** on stock — `total_stock` may go negative on an oversell.
2. **Server computes money.** The client sends only `sheets_sold` (or packets) + `selling_price` (the editable negotiated price). The backend computes `final_price`, `profit`, `total_amount`, `total_profit`. Never trust client totals. There is no discount field.
3. **Inventory is informational (no reservation):**
   - `total_stock` = sheets still owned. It is decremented **only** on sale; **assignment does not touch inventory at all** (no guard, no reservation). There is no `reserved_stock` / `available_stock`.
   - What a delivery boy still holds is derived on read via `computeHoldings` (`utils/holdings.util.ts`): `withBoy = Σ assigned (Loading) − Σ sold (Sale) − Σ returned (Return)`. This — not an inventory counter — is the source of truth for the boy's cart and reports.
   - Morning **assignment** just records a `Loading` doc; a **return** just records a `Return` doc; both only affect holdings, never `total_stock`.
4. **Pricing:** Selling price is **editable per sale** (negotiated). Note: `wholesale_price_per_sheet` in inventory actually holds the **per-packet** wholesale cost (legacy name).
   - **Default price:** wholesale → `wholesale_price_per_sheet × units_per_sheet` (per sheet); retail → `mrp_per_unit` (per packet).
   - **Wholesale (sheet):** `final_price = selling_price_per_sheet × sheets_sold`.
   - **Retail (packet):** `final_price = selling_price_per_unit × packets`.
   - **Profit** (`utils/profit.util.ts`, precedence order): ① `flat_profit_per_pouch > 0` → `flat × units_per_sheet × sheets`; ② `cost_per_sheet > 0` → `final_price − cost_per_sheet × sheets`; ③ legacy fallback for uncosted items → 10% of per-sheet wholesale (wholesale) or `(selling − wholesale) × packets` (retail). Both cost fields live on Inventory and are editable on the Inventory page.
   - `selling_price_per_sheet` is stored normalized per sheet (retail = per-packet price × `units_per_sheet`).
5. **Sale types:** `wholesale` (sell by whole sheet — delivery boys + admin) and `retail` (sell individual packets — admin only; `sheets_sold` may be fractional = `packets / units_per_sheet`).
6. **Cold start:** Render free tier sleeps. Every primary action (login, sync, report) should drive `GlobalLoadingService` so the UI shows a loading state.
7. **WhatsApp marketing:** On "Place Order", build a `wa.me/{mobile}?text=...` deep link with the itemised bill + digital catalog footer; new mobile numbers upsert a `Shop` record. Owner WhatsApp: `environment.ownerWhatsapp` (`918050991832`).

## Conventions

- **Frontend:** standalone components only; lazy routes via `loadComponent()` in `app.routes.ts`; Signals for state, `computed()` for derived; `inject()` over constructor DI; `OnPush` everywhere. Routed pages are `*.page.ts`; reusable/standalone feature widgets are `*.component.ts`. Four-file structure (TS/HTML/SCSS/Spec) for components > 50 lines. `kebab-case` filenames. Models in `frontend/src/app/models/` mirror backend field names exactly (note: `_id` is mapped to `id` in services).
- **Backend:** one route file per resource in `routes/`; Mongoose schemas in `models/`; non-trivial business logic in `controllers/`. Return JSON; `try/catch` in handlers; use transactions for multi-document mutations. Proper HTTP codes (200/201/400/401/404/409/500).
- **Git:** branch `feature/<name>` | `fix/<name>` | `chore/<name>`; Conventional Commit messages; never push directly to `main` — use PRs. Commit/push only when asked.

## Where things live

- **Per-feature specs:** `features/<feature>/REQUIREMENTS.md` — these are **current and authoritative**; read the relevant one before changing a feature. Templates for new feature docs: `features/templates/`.
- **Architecture & setup docs:** `docs/` (`architecture-overview.md`, `tech-stack.md`, `build-and-deploy.md`, `ai-context/`).
- **Roadmap & status:** `.ai-context/project-roadmap.md`, `PROJECT_OVERVIEW.md`.
- **Agents & skills:** `.claude/agents/`, `.claude/skills/`.

## Workflow expectations

- Before editing a feature, read its `features/<feature>/REQUIREMENTS.md`.
- Keep frontend models and backend schema field names in sync when either changes.
- When you change behaviour, update the matching `REQUIREMENTS.md` and the roadmap status.
- Prefer running the relevant build (`npm run build`) to type-check changes; there is no test runner wired beyond Angular's default spec scaffolding.
