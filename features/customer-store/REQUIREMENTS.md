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
- Order unit = **whole sheet** at the **retail tier-1 price** = `0.75 × mrp_per_unit × units_per_sheet` (e.g. ₹5×12 → ₹45, ₹10×12 → ₹90, ₹10×10 → ₹38, ₹20×12 → ₹180). This matches slab 1 (1–10 sheets) on the printed pamphlet. Price is fixed (not editable by the customer).
  - **Not** the wholesale/bulk rate — `wholesale_price_per_sheet` stays the default for delivery-boy and admin bulk entry only. Never surface wholesale or cost figures on this page.
  - `sale_mode: 'packet'` items (e.g. 50g) keep the wholesale-derived per-packet price.
- Savings are shown against MRP (`mrp_per_unit × units_per_sheet`), a genuine 25% on sheet items.
- Catalog visibility is the **`in_stock` toggle only**. `total_stock` is informational (may be 0 or negative, never blocks a sale) and is deliberately **not** shown or used to cap quantity; the cart caps at 99.
- Pack weight (`quantity_per_unit`) is **optional**. It is intentionally unset on variable-rate items (Garam Masala, Cardamom, Clove, Black Pepper) whose gram weight moves with the market — the UI hides the weight rather than rendering `0g`.

## i18n
- English / Hindi toggle, persisted in `localStorage` (`dmh_lang`). Lightweight map in `customer-store/i18n.ts` (no framework). Item names show the language's name with the other in parentheses.
- Search matches `item_name`, `hindi_name`, and `search_aliases` (romanized keywords, e.g. "methi").

## UX
- Mobile-first, responsive (max-width 720px, centered on desktop).
- Trust badges (horizontal scroll strip, icon + label): 🏡 Made in Bihar · 🌾 Farm Direct · 💵 100% COD · 🧴 Hygienically Packed · ✅ Quality Products · 🚚 Free Home Delivery.
- Free-delivery threshold is **₹249** (flat ₹20 fee below it). The terms are stated up front under the trust badges, and the cart bar shows progress toward it.
- Product cards show a `from ₹X` starting price and a `25% off MRP` pill; the variant sheet shows MRP struck through, rupees saved, pouches per sheet and total sheet weight.
- A "Questions? Chat with us" WhatsApp button gives a pre-sale contact path that does not require completing an order.
- Hero block carries the logo, the promise and the price hook; footer carries the FSSAI licence number, packing location and phone.
- **Share** (`navigator.share`, `wa.me` fallback) and **one-tap reorder** (per-device, `localStorage` key `dmh_last_order` — there is no login, so reorder cannot be per-account).
- Styling uses the `--dmh-*` design tokens in `src/styles.scss`; the storefront contains no raw hex colours.

## Link preview & install
- The storefront is shared almost entirely as a WhatsApp link, so `index.html` carries Open Graph + Twitter tags and `assets/og-cover.jpg` (1200×630). **`og:image`/`og:url` must be absolute `https://` URLs** — WhatsApp does not run JS or resolve relative paths, so these cannot be set at runtime and must be updated by hand if the domain changes.
- `manifest.webmanifest` uses `start_url: "/customer"` — `/` redirects to the staff login, so a customer installing the PWA from the storefront must be sent back to the storefront.
- Cold-start: catalog load drives `GlobalLoadingService`.

## Backend
- **Only** new endpoint: `GET /public/catalog` (public, mounted without `requireAuth` in `server.ts`). Returns in-stock items with computed `price_per_sheet` + `sheets_available`. See `backend/src/routes/public.route.ts`.

## Planned
See `features/customer-store/PLAN-v2.md` for the remaining backlog (volume slab pricing, FSSAI licence, pamphlet-derived promos, product imagery).

## Future (not built)
- Optional: auto-send WhatsApp confirmation to the customer via WhatsApp Business API (Meta/Twilio) + approved templates. Today the confirmation is on-screen and the owner replies manually.
