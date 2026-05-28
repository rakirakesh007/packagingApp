# Requirements — Expenses

## Business Goal
Track daily expenses incurred by delivery boys and admins (fuel, food, repairs, etc.).

## User Stories
- As a **user**, I want to log an expense with amount, category, and description.
- As a **user**, I want to view my expense history by date.
- As an **admin**, I want to see all expenses across users.

## Numbered Requirements
1. Expense entry (amount, category, description, date)
2. Expense list with date filtering
3. Admin view of all user expenses
4. Expense categories (fuel, food, transport, other)

## Key Files
- Frontend: `expense/expense.page.ts`
- Backend: `src/routes/expenses.route.ts`, `src/models/expense.model.ts`
