---
name: scaffold-feature
description: Scaffold or extend a feature in DesiMasalaHub end-to-end following project conventions — Mongoose model, Express route/controller, frontend service, standalone Angular page, and the features/<name>/REQUIREMENTS.md doc. Use when adding a new screen/resource or wiring a new full-stack capability in this repo.
---

# Scaffold a DesiMasalaHub feature

A repeatable, convention-correct workflow for adding or extending a feature across the Express/Mongoose backend and the Angular 21 frontend. Always read the root `CLAUDE.md` first for the golden business rules.

## 0. Spec first

- Copy `features/templates/REQUIREMENTS.md` to `features/<feature>/REQUIREMENTS.md` and fill it in (business goal, user stories, numbered requirements, in/out of scope, constraints).
- For an existing feature, read its current `REQUIREMENTS.md` before changing anything; update it when behaviour changes.
- The other templates in `features/templates/` (`DESIGN.md`, `INVESTIGATION.md`, `ISSUES.md`, `CHANGES.md`, `CONTEXT-PROMPT.md`) exist for deeper work — use them when relevant.

## 1. Backend (if the feature has data)

In `backend/src/`:

1. **Model** — add/extend a Mongoose schema in `models/<resource>.model.ts`. Use `InferSchemaType`, `timestamps: true`, `versionKey: false`, sensible `default`/`min` constraints. Mirror field names you expect the frontend to use.
2. **Route** — create `routes/<resource>.route.ts`, one file per resource. RESTful verbs, JSON responses, `try/catch`, proper status codes.
3. **Controller** — put non-trivial logic in `controllers/<resource>.controller.ts`. **Any multi-document or stock mutation must use a transaction (`session.withTransaction`) and `$inc`** — never overwrite stock from a client number, and compute all money fields server-side.
4. **Register** — mount the route in `server.ts` at the **root** (e.g. `app.use('/<resource>', <resource>Route)`), NOT under `/api`.
5. **Proxy** — add the new top-level path to `frontend/proxy.conf.json` so dev requests reach `:3000`.

## 2. Frontend service

In `frontend/src/app/services/<resource>.service.ts`:

- `@Injectable({ providedIn: 'root' })`, `private http = inject(HttpClient)`.
- Call **relative paths** (`/<resource>`), never `/api/...`. The `authInterceptor` adds the JWT automatically.
- If the API returns Mongo `_id`, map it to `id` (see `inventory.service.ts` `mapItem` pattern). Keep an interface in `frontend/src/app/models/`.

## 3. Frontend page/component

Create the feature folder `frontend/src/app/<feature>/`:

- Routed screen → `<feature>.page.ts`; reusable widget → `<feature>.component.ts`. Four files (TS/HTML/SCSS/Spec) once it exceeds ~50 lines.
- **Standalone**, `changeDetection: ChangeDetectionStrategy.OnPush`, state in `signal()` + `computed()`, dependencies via `inject()`.
- Drive `GlobalLoadingService` around primary network actions (Render cold-start).
- Add a lazy route in `app.routes.ts` via `loadComponent()`, under the `/app` shell (with `authGuard`) for admin/delivery screens.
- Admin screens are desktop/sidebar; delivery-boy screens are mobile-first with large touch targets.

## 4. Verify

- `cd backend && npm run build` and `cd frontend && npm run build` to type-check.
- Re-check the golden rules: atomic stock, server-side money, correct `total_stock`/`reserved_stock` handling.
- Update `features/<feature>/REQUIREMENTS.md` and the status list in `.ai-context/project-roadmap.md`.

## Quick reference

- Existing resources/mounts: `/auth`, `/inventory`, `/sale`, `/assignment`, `/admin/reports`, `/admin/marketing`, `/expenses`, `/reports`, `/users`, `/shops`.
- Models: `user`, `inventory`, `sale`, `expense`, `shop`, `loading`, `marketing-template`.
- Pricing reference table: `frontend/src/app/core/pricing.config.ts`.
