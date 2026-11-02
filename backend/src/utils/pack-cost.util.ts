/**
 * pack-cost.util.ts — derive a sheet's production cost from its raw inputs.
 *
 * Needed because distributors negotiate a price per ladi, not per gram: to hit
 * ₹26/ladi on Jeera you reduce the pack weight (8g → 5g) and the cost follows.
 * The stored `cost_per_sheet` is fixed to the item's standard weight, so it
 * cannot answer "what does this cost at 5g?".
 *
 *   cost/sheet = grams × rate/kg × units ÷ 1000 × 1.02  +  labour + packing + delivery
 *                └──────────── material ────────────┘
 *
 * Verified against spice_costing_v2.xlsx — Chilli Powder ₹5:
 *   8 × 235 × 12 ÷ 1000 × 1.02 + 6 = 29.0112, exactly cell M2.
 *
 * IMPORTANT — do not double-count packing. The stored `cost_per_sheet` ALREADY
 * includes labour/packing/delivery (confirmed across all 34 checkable live items:
 * every one equals material + packing, none equals material alone). This function
 * rebuilds the cost from its PARTS; never add packing on top of `cost_per_sheet`.
 */

/** 2% wastage on raw material, matching the costing spreadsheet's formula. */
export const WASTAGE_FACTOR = 1.02;

export interface PackCostInputs {
  /** Grams per individual pouch for THIS pack (may differ from the item's standard). */
  grams: number;
  /** ₹ per kg of raw material. */
  rate_per_kg: number;
  /** Pouches per sheet/ladi. */
  units_per_sheet: number;
  labour_cost_per_sheet?: number | null;
  packing_cost_per_sheet?: number | null;
  delivery_cost_per_sheet?: number | null;
}

/**
 * Cost of one sheet, rounded to paise. Returns 0 when grams or rate is missing —
 * callers treat 0 as "cannot derive a cost" and fall back to their normal path
 * rather than booking a sale at zero cost.
 */
export function computePackCost(i: PackCostInputs): number {
  const grams = Number(i.grams) || 0;
  const rate = Number(i.rate_per_kg) || 0;
  const units = Math.max(1, Number(i.units_per_sheet) || 1);
  if (grams <= 0 || rate <= 0) return 0;

  const material = (grams * rate * units) / 1000 * WASTAGE_FACTOR;
  const extras =
    (Number(i.labour_cost_per_sheet) || 0) +
    (Number(i.packing_cost_per_sheet) || 0) +
    (Number(i.delivery_cost_per_sheet) || 0);

  return Math.round((material + extras) * 10000) / 10000;
}
