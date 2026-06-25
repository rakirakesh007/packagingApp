# Customer Store — REQUIREMENTS

## Purpose
A **public, login-free storefront** at `/customer` (shareable link) where a retail/wholesale customer can browse in-stock spices, build a cart, and place an order. The order reaches the owner via a WhatsApp deep-link. **Deliberately simple** — no order is stored in the database; the WhatsApp chat is the order record.

## Flow
1. Customer opens `https://<host>/customer` (no login).
2. Browses catalog, adds whole sheets to cart (cart persists in browser `localStorage`).
3. Taps Checkout → fills **Name, Phone, Delivery Address (+ landmark)**.
4. Taps **Place Order** → their phone's WhatsApp opens with the full order + details pre-filled, addressed to the owner (`environment.ownerWhatsapp`). They tap Send.
5. Page shows an instant on-screen **thank-you** (localized): order placed, delivery in 24–48 hrs, reply CANCEL if by mistake.
6. Owner reads the order in WhatsApp, confirms/replies manually, packs it, hands to a delivery boy.
7. Delivery boy delivers and records the sale through the **existing** delivery-boy flow → inventory decrements as it already does.

**No new admin page, no customer-order DB collection, no stock mutation from this feature.** All other pages untouched.

## Pricing & stock
- Order unit = **whole sheet** at **wholesale price** = `wholesale_price_per_sheet × units_per_sheet` (matches the delivery-boy model). Price is fixed (not editable by the customer).
- Catalog shows only items with `total_stock >= 1` sheet; quantity capped at `floor(total_stock)`.

## i18n
- English / Hindi toggle, persisted in `localStorage` (`dmh_lang`). Lightweight map in `customer-store/i18n.ts` (no framework). Item names show the language's name with the other in parentheses.
- Search matches `item_name`, `hindi_name`, and `search_aliases` (romanized keywords, e.g. "methi").

## UX
- Mobile-first, responsive (max-width 720px, centered on desktop).
- Trust badges (horizontal scroll strip, icon + label): 🏡 Made in Bihar · 🌾 Farm Direct · 💵 100% COD · 🧴 Hygienically Packed · ✅ Quality Products · 🚚 Free Home Delivery.
- Cart bar shows free-delivery progress toward ₹499.
- Cold-start: catalog load drives `GlobalLoadingService`.

## Backend
- **Only** new endpoint: `GET /public/catalog` (public, mounted without `requireAuth` in `server.ts`). Returns in-stock items with computed `price_per_sheet` + `sheets_available`. See `backend/src/routes/public.route.ts`.

## Future (not built)
- Optional: auto-send WhatsApp confirmation to the customer via WhatsApp Business API (Meta/Twilio) + approved templates. Today the confirmation is on-screen and the owner replies manually.
