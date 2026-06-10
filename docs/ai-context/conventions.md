# Coding Conventions

## Angular (Frontend)

### Components
- **Standalone components only** — no NgModules. App boots via `bootstrapApplication` in `main.ts` (there is no `app.module.ts`).
- **`ChangeDetectionStrategy.OnPush`** on all feature components.
- **`inject()`** for dependency injection — avoid constructor injection.
- **Lazy-loaded routes** — use `loadComponent()` in `app.routes.ts`
- **File naming:** `feature-name.page.ts` for routed pages, `feature-name.component.ts` for reusable components
- **One component per file** — no multi-component files

### Services
- Use `providedIn: 'root'` for singleton services
- `private http = inject(HttpClient)`; call **relative paths** (`/inventory`) — the `authInterceptor` adds the JWT and `proxy.conf.json` forwards to `:3000`
- Place shared services in `services/` folder
- Place feature-specific services alongside the feature component

### Models
- TypeScript interfaces in `models/` folder
- Match backend model field names exactly; map Mongo `_id` → `id` in the service layer

### Styling
- **Tailwind CSS** for layout and utility classes
- **SCSS** for component-specific styles
- **Angular Material** + **Ionic** components for UI; `lucide-angular` for icons

### State Management
- **Angular Signals** (`signal()` / `computed()`) are the default for component state — prefer them over RxJS subjects
- No external state library — keep state close to where it's used
- For PDFs/labels use `jspdf` + `html2canvas` client-side

## Express (Backend)

### File Structure
- **Routes** in `src/routes/` — one file per resource
- **Models** in `src/models/` — Mongoose schemas, one per collection
- **Controllers** in `src/controllers/` — business logic separated from routes

### API Conventions
- Routes mount at the **root**, not under `/api`: `GET /resource`, `POST /resource`, `PATCH /resource/:id`, `DELETE /resource/:id` (mounted in `server.ts`)
- Always return JSON responses
- Use proper HTTP status codes (200, 201, 400, 401, 404, 409, 500) — 409 for stock/conflict failures
- Auth middleware on protected routes
- **Multi-document and stock mutations run in a Mongoose transaction with `$inc`; money fields are computed server-side, never trusted from the client**

### Error Handling
- Try/catch in all route handlers
- Return `{ error: "message" }` on failure

## Git Conventions
- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Commit messages: `feat: description`, `fix: description`, `docs: description`
- Never push directly to main — use PRs
