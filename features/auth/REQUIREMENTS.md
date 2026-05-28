# Requirements — Authentication

## Business Goal
Secure the application with JWT-based login so only authorized users (Admin, Delivery Boy) can access their respective features.

## User Stories
- As a **user**, I want to log in with email and password so that I can access the app.
- As an **admin**, I want to see admin-specific routes after login.
- As a **delivery boy**, I want to see only my sales and report routes after login.

## Numbered Requirements
1. Login form with email and password fields
2. JWT token generation on successful login
3. Token stored in localStorage
4. Auth guard protecting all `/app/*` routes
5. HTTP interceptor adding `Authorization: Bearer` header
6. Role-based route visibility (Admin vs Delivery Boy)
7. Logout clears token and redirects to login
8. 401 responses trigger automatic logout

## Key Files
- Frontend: `auth/login.component.ts`, `auth/auth.service.ts`, `core/guards/auth.guard.ts`
- Backend: `src/routes/auth.route.ts`, `src/controllers/auth.controller.ts`, `src/models/user.model.ts`
