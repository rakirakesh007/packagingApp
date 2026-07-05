# Requirements — Sales Cart

## Business Goal
Enable delivery boys to record sales at shops during their daily route, tracking products sold, quantities, and amounts.

## User Stories
- As a **delivery boy**, I want to select a shop and add products to a sales cart.
- As a **delivery boy**, I want to adjust quantities and see the running total.
- As a **delivery boy**, I want to submit the sale and have stock automatically deducted.

## Numbered Requirements
1. Product list from today's assignment (delivery boy sees only what was loaded)
2. `+/−` sheet quantity controls per item
3. **Per-item discount input** — `Disc ₹ ___ /sheet` appears when item is in cart
4. Cart total = `Σ (wholesale_price_per_sheet − discount_amount) × sheets_sold`
5. Checkout sheet (slides up above tab bar):
   - Order summary with discount notes
   - Shop name (optional) + mobile (for WhatsApp)
   - Payment mode toggle (Cash / Online)
   - Place Order button
6. On successful sale: opens WhatsApp with itemised bill + digital catalog footer
7. Sale submission: server computes `final_price`, `profit`, `total_amount`, `total_discount`, `total_profit`
8. Sale decrements `total_stock` atomically; never blocked on stock (may go negative)

## Pricing at Sale
- `final_price = (wholesale_price_per_sheet − discount_amount) × sheets_sold`
- `profit = final_price × 0.10` (10% margin on final selling price)
- All totals computed **server-side**; client sends only `sheets_sold` + `discount_amount`

## WhatsApp Bill Format
```
नमस्ते <shop>, आपका ऑर्डर:
Date: DD/MM/YYYY
<N> sheets <item> (disc. ₹X/sheet) = ₹Y
Total: ₹Z  |  Payment: Cash/Online
──────────────────
🌶️ DesiMasalaHub — डिजिटल कैटलॉग
<catalog rows>
──────────────────
📦 ताज़ा और शुद्ध मसाले — सीधे आपके दरवाज़े तक।
💬 अपना ऑर्डर देने के लिए कृपया यहाँ लिखें:
1. मसालों की सूची (नाम और मात्रा)
2. अपना पूरा पता (Address)
```

## Stock Behaviour on Sale
- `total_stock -= sheets_sold` — permanently sold (informational; may go negative)
- The boy's holdings drop automatically via `computeHoldings` (the sale counts as `sold`)

## Key Files
- Frontend: `sales-cart/sales-cart.page.ts`
- Backend: `src/routes/sale.route.ts`, `src/controllers/sale.controller.ts`, `src/models/sale.model.ts`
