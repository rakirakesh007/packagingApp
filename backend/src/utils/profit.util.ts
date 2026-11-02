/**
 * profit.util.ts — single source of truth for computing a sale line's profit.
 *
 * Precedence per inventory item:
 *   0. overrideCostPerSheet > 0  → profit = final_price − override × sheets
 *      (this sale was packed to a non-standard weight, so its cost was derived
 *      for THIS line — see pack-cost.util.ts. Distributor deals.)
 *   1. flat_profit_per_pouch > 0 → profit = flat × units_per_sheet × sheets
 *      (owner-quoted fixed ₹/pouch, e.g. Cardamom/Garam Masala ₹5→₹1, ₹10→₹2)
 *   2. cost_per_sheet > 0        → profit = final_price − cost_per_sheet × sheets
 *      (real production cost from the owner's costing sheet)
 *   3. legacy fallback           → 10% of per-sheet wholesale cost × sheets
 *      (items not costed yet — same formula the app used before real costs)
 *
 * Works for retail too: pass the line's revenue as finalPrice and the
 * fractional sheets consumed (packets / units_per_sheet) as sheets.
 *
 * NOTE on the override: it is an explicit argument, deliberately NOT inferred
 * from a null/zero field on the item. A past bug (fix-new-rows-qty-wholesale.ts)
 * used "cost field is null" as a proxy for intent and silently corrupted 9 rows.
 * Callers that don't pass it behave exactly as before.
 */

export interface ProfitInventoryFields {
  flat_profit_per_pouch?: number | null;
  cost_per_sheet?: number | null;
  wholesale_price_per_sheet?: number | null;
  units_per_sheet?: number | null;
}

export function computeProfit(
  finalPrice: number,
  sheets: number,
  inv: ProfitInventoryFields | null | undefined,
  overrideCostPerSheet?: number | null,
): number {
  const override = Number(overrideCostPerSheet) || 0;
  if (override > 0) return finalPrice - override * sheets;

  const units = Math.max(1, inv?.units_per_sheet ?? 1);
  const flat = inv?.flat_profit_per_pouch ?? 0;
  if (flat > 0) return flat * units * sheets;

  const cost = inv?.cost_per_sheet ?? 0;
  if (cost > 0) return finalPrice - cost * sheets;

  const wholesale = inv?.wholesale_price_per_sheet ?? 0;
  return wholesale * units * 0.10 * sheets;
}
