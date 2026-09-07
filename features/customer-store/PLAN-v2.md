# Customer Store v2 — Plan

Status: **sections A, B1, B2, B3, B6, B7 + infra shipped** to the working tree (2026-09-07, not yet committed/deployed).
Owner ask: make the `/customer` storefront show more, and pull the catchy bits from the printed pamphlet (`DesiMasalaHub_Pamphlet_v4.pdf`) onto the page.

Files in scope:
- `frontend/src/app/customer-store/customer-store.page.ts` / `.html` / `.scss`
- `frontend/src/app/customer-store/i18n.ts`
- `backend/src/routes/public.route.ts` (only if slab pricing is served rather than computed client-side)

---

## A. Confirmed — ✅ DONE (built & verified in the dev app)

### A1. Price on the product card
**Now:** card shows only `"3 sizes available"`. Customer must tap every product to learn any price.
**Change:** show a starting price, e.g. `from ₹45`.
**Where:** `.product-info` in `customer-store.page.html`; add a `groupMinPrice(group)` helper in the page TS (`Math.min(...group.variants.map(v => v.price_per_sheet))`).
**Data:** none new — `price_per_sheet` is already in the catalog response.

### A2. "Save 25% vs MRP"
**Now:** variant sheet shows only the selling price.
**Change:** show MRP struck through + the saving, e.g. `₹60  ₹45 · बचत ₹15`.
**Math:** MRP sheet value = `mrp_per_unit × units_per_sheet`; selling price is already `0.75 × MRP × units`, so the saving is a genuine, printed-on-pouch 25%.
**Where:** `.variant-price` block in the variant picker; also on the card next to A1.
**Data:** none new — `mrp_per_unit` and `units_per_sheet` already in the response.
**Note:** do NOT surface wholesale/cost figures anywhere on this page.

### A3. Total sheet weight
**Now:** shows `15g · ₹5/pkt` and `(12 pkt in sheet)` but never the total.
**Change:** add total grams, e.g. `= 180g`.
**Math:** `quantity_per_unit × units_per_sheet`.
**By design, 9 of 46 live items carry no weight** (`quantity_per_unit = 0`):
> Garam Masala ₹5 / ₹10 / ₹20, Cardamom ₹5 / ₹10, Clove ₹5 / ₹10, Black Pepper ₹5 / ₹10

Owner decision (2026-09-07): these are **costly items whose rate moves daily**, so the pack weight is deliberately left unset and varies. **Do not "fix" this data.** The UI must therefore hide the weight cleanly when the value is 0 — the guard already exists for the per-pouch label; mirror it for the total. Weight is an optional field on this page, not a missing one.

### A4. Free delivery threshold ₹499 → ₹249
**Change:** `FREE_DELIVERY_THRESHOLD = 499` → `249` in `customer-store.page.ts`.
**Also:** the terms are currently invisible until the cart is non-empty — the `🚚 Free Home Delivery` badge promises it unconditionally. Surface the condition up front.
**Bonus cleanup:** the string already exists and is unused — `freeDelivery: 'Free delivery on orders above ₹499'` in `i18n.ts` (update the number in both `en` and `hi`). 8 other keys are dead too: `perSheet`, `available`, `sheets`, `addToCart`, `yourCart`, `cartEmpty`, `cartEmptySub`, `pack` — delete or use.

### A5. "Questions? WhatsApp us" button
**Now:** the only path to the owner is completing a whole order.
**Change:** floating/inline WhatsApp button using `environment.ownerWhatsapp` (918050991832) with a prefilled enquiry message.
**Where:** near the header or as a floating action button; must not collide with the sticky `.cart-bar`.

---

## B. From the pamphlet — recommended, ranked

### B1. FSSAI licence number — ✅ DONE
`Lic No: 20426141000161` leads the pamphlet and is **absent from the page**. For food sold online in India this is the strongest single trust signal available. Put it in the footer (and/or small text under the brand).

### B2. Real tagline "खेत से किचन तक" — ✅ DONE
The logo's actual tagline. The page currently says `'Fresh & pure spices, delivered'` / `'ताज़े और शुद्ध मसाले, घर तक'`. Aligning pamphlet ↔ page ↔ pack QR makes it one brand instead of three.

### B3. Volume slab pricing  ★ biggest revenue lever
The pamphlet's core mechanic is **entirely missing** from the page — it shows only tier 1.

| 12-pouch शीट | ₹5 | ₹10 | ₹20 |  | 10-pouch लड़ी | ₹5 | ₹10 |
|---|---|---|---|---|---|---|---|
| 1–10 | ₹45 | ₹90 | ₹180 | | 1–10 | ₹38 | ₹75 |
| 11–50 | ₹43 | ₹85 | ₹170 | | 11–50 | ₹36 | ₹71 |
| 51+ | ₹40 | ₹80 | ₹160 | | 51+ | ₹33 | ₹67 |

**Verified:** tier 1 matches the live formula `0.75 × MRP × units` exactly (₹5×12→₹45, ₹10×12→₹90, ₹10×10→₹37.5→₹38, ₹20×12→₹180). No backend price change needed for tier 1.
**DECIDED (2026-09-07): passive — ✅ DONE.** A collapsible "थोक रेट / Bulk rates" card sits below the product list with both printed tables. The cart still charges tier 1; the card carries the line *"Bulk rates are applied when we confirm your order on WhatsApp"* so the table does not contradict the cart total. Slab data is a `readonly slabTables` constant in `customer-store.page.ts` — no backend change.

*Active pricing was considered and deferred.* If bulk orders start arriving through the site, revisit: apply the slab live as the cart grows, which needs slab data served from `public.route.ts`, a cart-total recompute, and two sub-decisions —
- **counting basis:** whole-order sheet count (recommended) vs per-item; per-item gives a 30-sheet mixed order no discount at all
- **flat-profit items** (Garam Masala ₹5/₹10/₹20, Cardamom ₹5/₹10) have no `cost_per_sheet`; their fixed per-pouch profit is largely wiped out at tier 3 and they likely need excluding.

*Margin check (2026-09-07):* no live item loses money at any tier. Thinnest at tier 3 — Cashew 13.4%, Mustard Powder 16.2%, Raisins 18.0%, Garam Masala Powder 19.1%; all others above 22%.

### B4. The 25-sheet free offer  ★ catchiest single line
`★ खास ऑफर: 25 शीट मंगाएं और पाएं 1 शीट (₹5 वाली) बिल्कुल मुफ़्त!`
Ship as a banner; ideally wire it to cart progress like the free-delivery hint already does — "5 और शीट जोड़ें → 1 शीट मुफ़्त".

### B5. Shopkeeper profit banner + wholesale CTA
`दुकानदारों के लिए 25% से 35% तक का ज़बरदस्त मुनाफ़ा!`
The business is wholesale-first but the page speaks only to households. A banner + "दुकानदार हैं? थोक रेट पाएं" WhatsApp link routes the highest-value traffic correctly instead of letting shops order at retail tier 1.

### B6. Hero — ✅ DONE (logo-based, no photo needed)
The pamphlet has a real photo of the hanging strips in hand. **0 of 46 items have `image_url` set**, and the field is wired end-to-end but rendered nowhere. One hero image is a fraction of the work of 46 product photos and closes most of the visual gap.

### B7. Delivery area — "फ्री शॉप डिलीवरी उपलब्ध (Jamalpur में)"
The page promises free home delivery with no area named. Stating it avoids orders that cannot be served.

### B8. Ground-spice / pouch-size note
`पिसे हुए शुद्ध मसाले (हल्दी, मिर्ची, धनिया, जीरा पाउडर) हैंगर लड़ी एवं 25g, 50g, 100g पाउच में ऑर्डर पर उपलब्ध हैं।`
An "available on request" line — captures demand for SKUs not in the catalog.

### B9. Align trust badges with the pamphlet
Pamphlet: शुद्धता की गारंटी · बेहतरीन क्वालिटी · उचित मूल्य · समय पर डिलीवरी.
Page has 6 different ones (Made in Bihar · Farm Direct · 100% COD · Hygienically Packed · Quality Products · Free Home Delivery). Merge to one consistent set.

---

## C. Data problems found (not code)

### C1. Pamphlet ↔ live catalog mismatches
**Pamphlet promises, not live:**
- दालचीनी (Cinnamon) ₹5 — live has **₹10 only**
- काजू / किशमिश / बादाम / मिक्स्ड ड्राई फ्रूट **₹20** — live has **₹10 (10-pouch) only** (the ₹20 12-pouch variants were deleted)

**Live, but missing from the pamphlet:**
- सोंफ (Fennel Seeds) ₹5, ₹10
- मेथी (Fenugrik Seeds) ₹5, ₹10
- सरसों (Mustard) ₹5, ₹10
- पीली सरसों (Yellow Mustard) ₹5, ₹10
- सरसों पाउडर (Mustard Powder) ₹5
- जीरा - मरीच (Jeera - Marich) ₹5
- हल्दी / मिर्ची / धनिया / जीरा पाउडर ₹5, ₹10 — the pamphlet lists these only as "on order in 25g/50g/100g pouches", but they are live as sheets

**Naming differences:** pamphlet मंगरैला vs DB मंगरैल · pamphlet पंच फोरन vs DB पांच फोरन · pamphlet "शाही गरम मसाला पाउडर" vs DB "गरम मसाला पाउडर".

**Resolved (2026-09-07): not an issue.** The pamphlet is reprinted/updated on its own cycle and is expected to drift from live inventory. The storefront is the source of truth. No action.

### C2. Pack weights intentionally unset
The 9 items in A3. **Resolved (2026-09-07): intentional, no action** — variable-rate items. Handled as an optional field in the UI.

### C3. `features/customer-store/REQUIREMENTS.md` is stale
Two statements no longer true after the pricing/visibility changes already shipped:
- "Order unit = whole sheet at **wholesale price**" → it is now retail `0.75 × MRP × units`
- "Catalog shows only items with `total_stock >= 1`" → visibility is now the `in_stock` toggle only
Update as part of this work (per CLAUDE.md workflow rules).

---

## D. Open questions for the owner

1. ~~B3 slab pricing: passive or active?~~ — answered: **passive**, shipped.
2. ~~Pack weights for the 9 items~~ — answered: intentional, variable-rate items.
3. ~~C1 pamphlet vs DB~~ — answered: pamphlet drifts by design, storefront wins.
4. Does the **QR code on the packs** point at `/customer`? If so this page is the primary funnel and B1/B6 matter more.
5. Is the **25-sheet free offer** still running, and does it apply to storefront orders or only shop/wholesale orders?
6. Free **shop** delivery is Jamalpur-only — what is the area for **home** delivery on the ₹249 threshold?

---

## E. Suggested build order

1. A4 (one-line threshold change) + dead-i18n cleanup
2. A1 + A2 + A3 — one pass over the product card and variant sheet
3. A5 + B1 + B2 + B7 — header/footer trust pass
4. B4 + B5 — promo banners
6. B6 — hero image (needs the asset)


---

## F. Shipped 2026-09-07 (second pass)

### F1. WhatsApp / social link preview — ✅ DONE
The live site had **zero** `og:`/`twitter:` tags, so the storefront link — the only way customers reach the shop — rendered in WhatsApp as a bare grey URL. Added to `frontend/src/index.html`: `og:title/description/url/image/image:width/height/alt/locale/type/site_name` + `twitter:card` (summary_large_image) and a meta description.

`assets/og-cover.jpg` (1200×630, 116 kB) is generated from the real `color-logo.png` — no AI, no stock photo. Rebuild it by rendering the scratchpad `og.html` at 1200×630 and exporting JPEG q82.

**`og:image` must stay an absolute `https://` URL** — WhatsApp does not resolve relative paths and does not run JavaScript, so these tags have to live in the served HTML, not be set at runtime. If the domain ever changes, update `og:url` and `og:image` by hand.

### F2. PWA start_url — ✅ DONE
`manifest.webmanifest` had `start_url: "/"`, and `/` redirects to the staff **login** (`app.routes.ts`). A customer who installed the storefront to their home screen got an icon opening the staff login. Now `start_url: "/customer"`. Also aligned `theme_color` to the brand orange (`#f97316`) in both the manifest and `index.html`, and localized `name`/`description`.

### F3. Share button — ✅ DONE
`shareStore()` uses `navigator.share` where available (native sheet → WhatsApp/SMS), falling back to a `wa.me` deep-link on desktop.

### F4. One-tap reorder — ✅ DONE
No login exists, so this is per-device: the placed order is saved to `localStorage` under `dmh_last_order`, and a reorder card appears on next visit when the cart is empty. Items no longer in the catalog are filtered out, so a discontinued SKU can't be re-added. Falls back silently if storage is unavailable (private mode).

### F5. CSS restructure — ✅ DONE
- **Design tokens.** ~40 custom properties in `src/styles.scss` under `:root` (`--dmh-*`). The storefront now has **zero raw hex** — previously `#94a3b8` appeared 16×, `#fff` 15×, `#f97316` 12×. Rebranding is now a one-line change.
- **Honest note on size:** tokens *cost* bytes (`var(--dmh-brand)` > `#f97316`) — about +1.4 kB compiled, and gzip does not erase it (3,035 → 3,570 B). The `anyComponentStyle` budget was raised 10→16 kB warn / 20→24 kB error in `angular.json`, because 10 kB is an Angular default sized for small components and this is a whole page. Dead `.review-variant` rule removed. Build is warning-free.
- Trust-badge strip now fades at the right edge instead of slicing a word mid-character.

### F6. Order reference number — ❌ NOT BUILT (owner decision)
Owner traces orders directly in WhatsApp (+91 8050991832), packs and delivers from there. At current volume a reference code adds ceremony without saving work. Revisit only if order volume makes WhatsApp search unreliable.

### F7. Abandoned-order visibility — deliberately NOT built
If a customer fills a cart, taps Place Order, but never hits Send in WhatsApp, there is no trace anywhere. The current design (no server-side order record) is a conscious simplicity trade — see REQUIREMENTS.md. Accept it until there is a concrete reason to think drop-off is material; the cheapest future probe is a fire-and-forget `POST /public/order-intent` logging cart + timestamp only.

### F8. Brand assets — ✅ DONE (2026-09-07)
Owner supplied a new square logo (`logo-new.png`) and a real spice-flat-lay photo (`bg.png`).

**Anything in `frontend/src/assets/` is copied verbatim into the deployed bundle.** The supplied `bg.png` was **9.1 MB** — it would have been served to every mobile visitor. Originals now live in `frontend/design-assets/` (not copied by `angular.json`); only web-sized derivatives ship:

| Shipped asset | From | Size | Used by |
|---|---|---|---|
| `hero-bg.jpg` | bg.png 9.1 MB | **212 kB** (1440px, q68) | hero backdrop |
| `logo-mark.jpg` | logo-new.png 704 kB | **32 kB** (320px) | header, hero |
| `fssai-mark.png` | fssai-logo.png | 16 kB | footer badge |
| `og-cover.jpg` | rendered | 144 kB | link preview |

**When replacing any of these, re-derive — never drop a camera/AI original straight into `src/assets/`.**

- Header now shows the logo as a 32px circle. The *old* wide logo could not be used this way: it bakes its own wordmark and tagline into the image, so at small sizes it turned to mush. The new square mark solves that.
- Hero uses the photo with a left-to-right scrim; copy is left-aligned into the photo's empty left third and capped at 76% width so it never fights the spices.
- Logo images are JPEG, not PNG — they have an opaque background, and JPEG was 5× smaller (32 kB vs 164 kB). Circular shape comes from CSS `border-radius`, not the file.
- PWA icons (all 8 sizes) regenerated from the new logo. This changes the installed icon for staff too, which is intended — one brand.
- Copy: header tagline removed (it repeated the logo's own tagline directly beneath it); hero line is now a purity claim rather than a third restatement; "MRP से 25%–35% कम" in hero, meta description and preview image. **Per-item card pills still show the true computed 25%** — the 25–35% range is the shopkeeper margin from the pamphlet and is a different number; inflating the per-item figure would be wrong.

### F9. Mobile pass — ✅ DONE (2026-09-07)
Price display changed from `from ₹45` to a **range** — `₹45–₹90` per card, collapsing to a single price for one-size products; the hero shows the live catalog-wide range (`₹45–₹180`) computed from the catalog, not hardcoded.

- **iOS auto-zoom bug fixed.** The search input was `0.95rem` (15.2px). Mobile Safari zooms the whole page on focus for any input under 16px. Now `1rem` — visually near-identical, no zoom. Checkout inputs were already 16px and were fine.
- **Offline catalog** — `ngsw-config.json` gained a `dataGroups` entry for `/public/catalog` (freshness, 3s timeout, 3-day max age). On patchy rural data the shop now opens with the last-seen catalog instead of blank. Only takes effect in a production build with the service worker active.
- Clear (✕) button in the search field; numeric keypad on the phone field (`inputmode="numeric"`); back-to-top button after ~900px of scroll.
- **Sticky category tabs were tried and reverted** — they pinned *behind* the sticky header (lower z-index), and a 2×2 grid fixed to the top would eat ~40% of a phone viewport. Back-to-top serves the same need. Don't re-attempt without redesigning the tabs as a single-row scroll strip.
- CSS budget raised 16→20 kB warn / 24→28 kB error. Duplicate button shapes were factored first (`.share-btn`/`.ask-btn`, `.btn-done`/`.btn-checkout`, `.btn-place`/`.btn-whatsapp`) and no dead rules remain, so the residual size is real page CSS.

### F10. Pamphlet promos + polish — ✅ DONE (2026-09-07)
- **PWA install prompt.** `beforeinstallprompt` is captured and offered as a dismissible card (dismissal remembered in `localStorage`). **iOS never fires this event**, so the card simply never appears on iPhone rather than showing an Install button that does nothing.
- ~~**B5 shopkeeper pitch**~~ — built, then **removed**. Owner clarified (2026-09-07) that **the storefront's audience is shops, not households**. Asking "Run a shop?" on a page whose every visitor runs a shop is noise. Earlier plan entries assumed a household audience — that assumption was wrong; do not re-add a shopkeeper-conversion banner here.
- **B4 25-sheet free offer** — live against the cart like the free-delivery nudge: counts down ("25 और शीट जोड़ें…") then flips to an earned state at 25 sheets.
- **B8 custom packing** — two offers in one card: any pouch size up to 100g made to order, and whole spices in pouches for shopkeepers. Own WhatsApp CTA.
- **Skeleton loading** — 6 shimmer rows while the catalog is in flight, replacing a blank list.
- **B9 badges cut 6 → 4**: शुद्धता की गारंटी (was "Quality Products", renamed to the pamphlet's stronger claim), बिहार का गर्व, सीधे खेत से, कैश ऑन डिलीवरी. Free delivery was dropped from the badges because the hero already headlines it, and "Hygienically Packed" duplicated the purity claim.
- **Bulk-rate wording (7)** — one short line, in the slab card and again in the checkout review at 11+ sheets: "थोक रेट डिलीवरी के समय बिल में लग जाएगा।" / "Bulk rate is applied to your bill at delivery." A first, longer version was cut on owner feedback — the promise only lands if it is short enough to read.

### F14. Audit fixes — ✅ DONE (2026-09-07)
Two real defects found by testing edge cases, not by reading code.

**1. Stale cart let a customer place an EMPTY order.** Carts persist in `localStorage` forever, but `in_stock` is toggled regularly. A cart holding a since-delisted item counted toward `cartCount()` (raw map) while contributing nothing to `cartTotal()` and never appearing in `cartLines()` (both catalog-derived). Reproduced: a cart of 4 delisted sheets showed "4 सामान · ₹0" and **successfully placed an order with an empty item list charging ₹20 delivery**.
- `pruneCart()` now drops cart entries absent from the catalog, run only on a *successful* load — a failed request is no evidence anything went out of stock, so a network error must never wipe a good cart.
- `openCheckout()` and `placeOrder()` now guard on `cartLines().length`, not `cartCount()`.
- Verified: mixed cart keeps the live item and drops the dead one; pure-stale cart shows no cart bar at all.

**2. A failed catalog load looked like an empty shop.** The error path fell through to "कोई मसाला नहीं मिला" — on patchy rural data a customer reads that as *sold out* and leaves. Now a distinct retryable error card ("दुकान लोड नहीं हो पाई" + **दोबारा कोशिश करें**). Verified: aborted request shows the error, retry after restoring the network loads all products.

**CSS budget raised 20→24 kB warn / 28→32 kB error.** Dead `.b-blue`/`.b-teal` (left from the 6→4 badge cut) were removed and the pill-button rules factored first, but past that point the shaving was worth ~66 bytes and was making the CSS worse. The page component is genuinely this size.

### F13. Owner's WhatsApp order message — ✅ REWORKED (2026-09-07)
**This fixed a real defect introduced by F10.** The storefront now promises the customer two things — "थोक रेट डिलीवरी के समय बिल में लग जाएगा" and the 25-sheet free offer — but the owner's order message said nothing about either. The owner would have charged the tier-1 total and silently broken both promises. The WhatsApp message is the only record of an order (there is no server-side order document), so anything the customer was promised has to appear in it.

Added:
- `⚠️ BULK: 11–50 sheets — apply the 11–50 slab rate at delivery` (and a 51+ variant), shown only when the sheet count qualifies.
- `★ OFFER: 25+ sheets — include 1 FREE ₹5 sheet`, shown only at 25+.
- **Pouches per line** — `1 sheet × 12 pkt @ ₹90`. A "sheet" is 12 or 10 pouches depending on the item; the old message never said which, so picking relied on memory. Packet-mode items render as `N pkt`.
- **`Total sheets: N`** for loading.
- **Date/time stamp** (IST, `en-IN`).
- **`+91` on the phone** so WhatsApp renders it as a tap-to-call link; a bare 10-digit number often is not linkified.
- **`🗺️` Google Maps link** built from the typed address (URL-encoded — house numbers like `#0196` would otherwise truncate the URL at the `#` fragment). Suppressed when the address already contains a link, since "use current location" appends its own pin.

**Any future promise made on the storefront must also be echoed here**, or it will not reach the person filling the order.

**No emoji in this message — confirmed on a real device.** Emoji above U+FFFF (shopping cart, person, phone, pin, map — all surrogate pairs) arrived in WhatsApp as `U+FFFD` replacement characters. BMP characters are unaffected: `₹` (U+20B9), `×` (U+00D7) and Devanagari all render correctly, which is what isolated the cause. The message now uses plain `*bold*` labels (`Name:`, `Phone:`, `Address:`, `Map:`, `*BULK RATE:*`, `*OFFER:*`). **Do not reintroduce emoji here without testing on a real phone** — a build-time check will not catch it, the corruption happens downstream. UI emoji elsewhere in the app are unaffected; this applies only to text sent through `wa.me`.

### F12. Remembered delivery details — ✅ DONE (2026-09-07)
Name, phone and address are saved to `localStorage` (`dmh_customer`) after a successful order and prefilled on every later visit. No login exists, so this is per-device, exactly like the cart and last order.

- A green "आपकी जानकारी इस फ़ोन में सेव है" note appears at the top of checkout with a **बदलें / Change** link that wipes the saved details — needed for a shared phone or a wrong address, and it removes the storage key, not just the fields.
- `startNewOrder()` **no longer clears** the fields. It used to reset them, which was right when nothing was remembered and wrong now — it is the same customer ordering again, and retyping the address is the most tedious part of the flow.
- Wrapped in try/catch: in private mode the prefill simply doesn't happen.

Verified end to end: first visit empty → order placed → full page reload → all three fields prefilled and the note shown → Change clears both fields and storage.

### F11. Navigation — chips, not a side nav (2026-09-07)
Owner asked whether a side nav was needed. **It isn't, and one was not built.** There is no login, no order history, no account, no address book — the only destinations are four categories, and a drawer would hide them behind a tap.

What was built instead: the 2×2 category grid moved **into the sticky header as a single-row chip strip**.
- Categories stay reachable at any scroll depth — the actual navigation problem, solved without a drawer.
- Costs ~45px instead of the grid's ~150px, so **4 product cards now sit above the fold** (was 1 before this whole pass).
- Header is 153px total (brand + search + chips); chips hide while searching.
- This supersedes the earlier failed attempt to make the standalone `.cat-grid` sticky (it pinned behind the header) — see F9.

## G. Still open
- **46 product photos** — owner will shoot these later; `image_url` is wired end-to-end but rendered nowhere, so a render pass is still needed once images exist
- **Active slab pricing** — deferred, see B3
- **PWA install prompt** — `start_url` is fixed and the manifest is valid, so the storefront is installable, but nothing invites the customer to install it. A `beforeinstallprompt` nudge would make repeat ordering one tap from the home screen.
- **Skeleton loading** — catalog load currently shows a blank list behind the global spinner.
