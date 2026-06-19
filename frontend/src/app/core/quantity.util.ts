/**
 * QUANTITY UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Inventory is sheet-based. Retail sales store fractional sheets
 * (sheets_sold = packets / units_per_sheet, e.g. 1/12 = 0.0833…).
 * These helpers turn that fractional sheet quantity into a clean,
 * unambiguous "X sheets Y pcs" display — never a bare fraction.
 */

/**
 * Format a (possibly fractional) sheet quantity as a hybrid string:
 *   12     → "12 sheets"
 *   0.5    → "6 pcs"        (units_per_sheet = 12)
 *   12.5   → "12 sheets 6 pcs"
 *   0      → "0 sheets"
 */
export function formatSheetQty(sheets: number, unitsPerSheet: number): string {
  const qty   = sheets ?? 0;
  const units = Math.max(1, Math.floor(unitsPerSheet || 1));

  let whole = Math.floor(qty + 1e-6);
  let rem   = Math.round((qty - whole) * units);

  // Rounding can carry the remainder up to a full sheet.
  if (rem >= units) {
    whole += Math.floor(rem / units);
    rem = rem % units;
  }

  if (whole > 0 && rem > 0) return `${whole} sheets ${rem} pcs`;
  if (whole > 0)            return `${whole} sheets`;
  if (rem > 0)              return `${rem} pcs`;
  return '0 sheets';
}

/**
 * Defensive whole-sheet round for cross-item totals (kills float dust like
 * 41.99999). Cross-item sums can't be expressed as one sheets+pcs string
 * because each item has its own units_per_sheet; these flows are wholesale
 * (whole) in practice, so rounding to the nearest whole sheet is safe.
 */
export function roundSheets(n: number): number {
  return Math.round((n ?? 0) * 1000) / 1000;
}
