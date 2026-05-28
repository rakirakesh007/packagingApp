# Requirements — User Management

## Business Goal
Allow admins to manage users (delivery boys, other admins) with role-based access.

## Numbered Requirements
1. User CRUD (name, email, password, role, phone)
2. Role assignment (Admin, Delivery Boy)
3. User list with search/filter
4. Activate/deactivate users

## Key Files
- Frontend: `users-admin/users-admin.page.ts`
- Backend: `src/routes/users.route.ts`, `src/models/user.model.ts`
