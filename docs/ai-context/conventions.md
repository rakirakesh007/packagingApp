# Coding Conventions

## Angular (Frontend)

### Components
- **Standalone components only** — no NgModules for feature components
- **Lazy-loaded routes** — use `loadComponent()` in `app.routes.ts`
- **File naming:** `feature-name.page.ts` for routed pages, `feature-name.component.ts` for reusable components
- **One component per file** — no multi-component files

### Services
- Use `providedIn: 'root'` for singleton services
- Place shared services in `services/` folder
- Place feature-specific services alongside the feature component

### Models
- TypeScript interfaces in `models/` folder
- Match backend model field names exactly

### Styling
- **Tailwind CSS** for layout and utility classes
- **SCSS** for component-specific styles
- **Angular Material** for UI components (buttons, inputs, dialogs, tables)

### Reactive Forms
- Prefer `ReactiveFormsModule` over template-driven forms
- Use `FormBuilder` for form creation

### State Management
- No external state library — use services with BehaviorSubject/signals
- Keep state close to where it's used

## Express (Backend)

### File Structure
- **Routes** in `src/routes/` — one file per resource
- **Models** in `src/models/` — Mongoose schemas, one per collection
- **Controllers** in `src/controllers/` — business logic separated from routes

### API Conventions
- RESTful endpoints: `GET /api/resource`, `POST /api/resource`, `PUT /api/resource/:id`, `DELETE /api/resource/:id`
- Always return JSON responses
- Use proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Auth middleware on protected routes

### Error Handling
- Try/catch in all route handlers
- Return `{ error: "message" }` on failure

## Git Conventions
- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Commit messages: `feat: description`, `fix: description`, `docs: description`
- Never push directly to main — use PRs
