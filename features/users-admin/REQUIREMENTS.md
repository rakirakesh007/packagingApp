# Requirements — User Management

## Business Goal
Allow admins to manage users (delivery boys, other admins) with role-based access.

## Fields (UserModel — verified against `user.model.ts`)
`username` (required, unique — used to log in, not an email), `password` (bcrypt hash),
`role` (`admin` | `delivery_boy`), `name`, `mobile_number`, `isActive`.
**There is no `email` field.** Do not add one without also updating the auth flow.

## Numbered Requirements
1. User CRUD — `username`, `password`, `role`, `name`, `mobile_number`
2. Role is set on **create only** (`POST /users`). `PATCH /users/:id` does **not** accept
   `role` — only `name`, `mobile_number`, `isActive`, `password` can be edited after creation.
   Changing a user's role today means delete + recreate.
3. User list with search/filter
4. Activate/deactivate via `isActive` on `PATCH /users/:id` (no separate endpoint)

## API Endpoints
- `GET /users` · `POST /users` · `PATCH /users/:id` · `DELETE /users/:id`
(mounted at `/users`, `requireAuth` + `requireAdmin`)

## Key Files
- Frontend: `users-admin/users-admin.page.ts`
- Backend: `src/routes/users.route.ts`, `src/models/user.model.ts`
