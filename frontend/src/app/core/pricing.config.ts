/**
 * PRICING CONFIG
 * ─────────────────────────────────────────────────────────────────────────────
 * Keyed by MRP per unit (₹).
 * Edit these values here whenever pricing changes — no other file needs touching.
 *
 * commissionPerSheet : delivery-boy commission per sheet (wholesale)
 *                      → for RETAIL sales this same amount becomes MY profit
 *                        (no delivery boy involved in direct retail)
 *
 * NOTE: wholesalePrice is taken directly from the inventory record, NOT from here.
 */
export interface PricingRule {
  wholesalePricePerSheet: number;
  commissionPerSheet:     number;
}

export const PRICING_CONFIG: Record<number, PricingRule> = {
  5:  { wholesalePricePerSheet: 48,  commissionPerSheet: 5  },
  10: { wholesalePricePerSheet: 96,  commissionPerSheet: 10 },
};

/**
 * Look up pricing rule by MRP.
 * Returns null if no rule is defined for that MRP.
 */
export function getPricingRule(mrpPerUnit: number): PricingRule | null {
  return PRICING_CONFIG[mrpPerUnit] ?? null;
}
