/**
 * profit.util.ts — single source of truth for computing a sale line's profit.
 *
 * Precedence per inventory item:
 *   1. flat_profit_per_pouch > 0 → profit = flat × units_per_sheet × sheets
 *      (owner-quoted fixed ₹/pouch, e.g. Cardamom/Garam Masala ₹5→₹1, ₹10→₹2)
 *   2. cost_per_sheet > 0        → profit = final_price − cost_per_sheet × sheets
 *      (real production cost from the owner's costing sheet)
 *   3. legacy fallback           → 10% of per-sheet wholesale cost × sheets
 *      (items not costed yet — same formula the app used before real costs)
 *
 * Works for retail too: pass the line's revenue as finalPrice and the
 * fractional sheets consumed (packets / units_per_sheet) as sheets.
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
): number {
  const units = Math.max(1, inv?.units_per_sheet ?? 1);
  const flat = inv?.flat_profit_per_pouch ?? 0;
  if (flat > 0) return flat * units * sheets;

  const cost = inv?.cost_per_sheet ?? 0;
  if (cost > 0) return finalPrice - cost * sheets;

  const wholesale = inv?.wholesale_price_per_sheet ?? 0;
  return wholesale * units * 0.10 * sheets;
}
