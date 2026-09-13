# Requirements — Marketing

## Business Goal
Give the admin a shop-broadcast tool: send a WhatsApp follow-up/offer message to a
specific shop using a reusable template, backed by real order-history stats per shop —
not just a template CRUD screen.

## Route
`/app/marketing` — three tabs: **Broadcast**, **Templates**, **Shops**.

## Tabs

### 1. Broadcast
- Pick a shop (search by name/mobile/address) and a template.
- Message is built client-side from the template body, opened via a `wa.me` deep-link
  (`https://wa.me/91<digits>?text=...`) — same pattern as the customer-store checkout.
  No message is sent server-side; nothing is stored as "sent".

### 2. Templates
- CRUD: `title`, `category`, `body`, `isActive`.
- `category` enum: `follow_up | offer | festival | payment | general` (default `general`).
- Using a template from Broadcast increments `usageCount` and sets `lastUsedAt`
  (`POST /admin/marketing/templates/:id/use`) — templates can be sorted/judged by actual use.

### 3. Shops
- Directory of `Shop` documents enriched with this-month order stats: `monthlySalesCount`,
  `monthlySalesTotal`, `lastOrderAt` (aggregated from `Sale` where `shop_id` is set).
- Search by name/mobile/address.
- `activeShops` = shops with `total_orders_count > 0` (all-time, not month-scoped).
- `totalBroadcastTargets` = shops that have a `mobile` on file (only these are reachable via `wa.me`).

## Backend Endpoints
Mounted at `/admin/marketing` (`requireAuth` + `requireAdmin`).

| Endpoint | Purpose |
|---|---|
| `GET /admin/marketing/overview?month=&year=` | Templates + enriched shop list + summary totals for a given month (defaults to current) |
| `GET /admin/marketing/templates` | List templates |
| `POST /admin/marketing/templates` | Create a template |
| `PATCH /admin/marketing/templates/:id` | Edit a template |
| `POST /admin/marketing/templates/:id/use` | Bump `usageCount` / `lastUsedAt` |
| `DELETE /admin/marketing/templates/:id` | Delete a template |

## Key Files
- Frontend: `marketing-dashboard/marketing-dashboard.page.ts` (+ `.html`), `services/marketing.service.ts`, `models/marketing.model.ts`
- Backend: `src/routes/marketing.route.ts`, `src/models/marketing-template.model.ts`
- Related: `src/models/shop.model.ts` (shops are upserted from `sale.route.ts` bulk-entry and `public.route.ts` customer orders, not created here)

## Not built
No delivery tracking, no read receipts, no scheduled sends — a broadcast is a single
manually-triggered `wa.me` link per shop, per template.
