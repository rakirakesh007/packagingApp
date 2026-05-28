# Feature Planner Agent

## Purpose
This agent is designed to break down high-level tasks into actionable development steps for the Spice Distribution App. It ensures that tasks are well-defined, prioritized, and aligned with the project's goals.

## Workflow
1. **Input Analysis**:
   - Analyze the provided high-level task.
   - Identify dependencies and prerequisites.

2. **Task Breakdown**:
   - Divide the task into smaller, manageable subtasks.
   - Ensure each subtask has clear acceptance criteria.

3. **Prioritization**:
   - Rank subtasks based on importance and urgency.
   - Highlight critical path items.
   - For reporting features, split work into backend aggregation, admin filters/tabs, and export/print actions.

4. **Output**:
   - Generate a detailed task list with descriptions.
   - Include estimated time for completion.

## Example
### Input:
"Create a user authentication feature."

### Output:
1. **Set up authentication service**
   - Create `auth.service.ts`.
   - Implement login, logout, and session management methods.

2. **Build login component**
   - Create `login.component.ts`.
   - Design login form with email and password fields.
   - Add form validation.

3. **Integrate API**
   - Connect login form to backend API.
   - Handle success and error responses.

4. **Testing**
   - Write unit tests for `auth.service.ts`.
   - Write unit tests for `login.component.ts`.

---

## Pattern: WhatsApp Digital Catalog (appended to order receipt)
- **Trigger:** Fired inside `openWhatsApp()` in `sales-cart.page.ts` after the order receipt lines and after `To order again, contact Rakesh: wa.me/${environment.ownerWhatsapp}`.
- **Data Source:** `generateCatalog(items: InventoryItem[])` fed by the `catalogItems` signal loaded once on `ngOnInit` via `InventoryService.getItems()`; separate from the `allItems` signal (assignment-only).
- **Filter Rule:** Include only items where `total_stock >= 5` to avoid promoting out-of-stock products.
- **Display Fields:** `hindi_name (item_name)` + `mrp` (falls back to `unit_price` if MRP is null).
- **Format:** Numbered list, Unicode divider lines, emoji header, polite Hindi call-to-action.
- **Guard:** If no eligible items exist, the catalog section is omitted entirely (no empty footer).

## Pattern: Additive Morning Assignment Updates
- **Trigger:** Re-submitting `POST /assignment` for the same delivery boy and date should append stock to the existing loading record instead of returning `409`.
- **Data Rule:** If an item already exists in the loading document, increase its `qty`; otherwise, append the new item.
- **Stock Rule:** Decrement inventory only by the newly submitted quantity, never by the total historical quantity for that day.
- **UI Rule:** The assignment page should continue to clear entered quantities and refresh the remaining warehouse stock after each successful submit.
- **Guard:** Validation failures still return 400; only the duplicate-day restriction is removed.

## Pattern: Printable 15-Up Label Sheet
- **Trigger:** Admin clicks `Print 15 Labels` from `inventory.page.ts` for a selected product.
- **Library:** Use client-side `jspdf` to create a single A4 landscape PDF with narrow margins.
- **Grid Rule:** Render exactly 15 labels in a 5×3 grid on one page; no page break or spillover.
- **Visual Rule:** Load local assets (`assets/color-logo.png`, `assets/veg-icon.png`) as Base64, add a light-grey outline, and keep content centered and compact for sticker printing.
- **Content Rule:** Include Hindi name, net weight, MRP, PKD date, batch number, FSSAI, customer care, manufacturer, and the trust phrase `🌿 100% Pure | No Added Color`.
- **Fill Rule:** If the caller passes a single product, repeat it to fill all 15 slots; if multiple products are passed, cycle them to fill the sheet.

---

This agent ensures that no task is overlooked and that development proceeds smoothly.