/**
 * label-capacity.util.ts — single source of truth for how many labels fit on one
 * physical sheet.
 *
 * The label picker and the printed sheet MUST agree on this number: the picker
 * uses it to stop the user over-filling a sheet, and the sheet uses it to decide
 * how many grid cells to render.
 *
 * Why the counts differ: in print the grid is `height: 100vh` with
 * `grid-auto-rows: 1fr` (label-sheet.component.scss), so rows stretch to fill the
 * page. Items with an `ingredients` line need taller rows to fit the wrapped text,
 * which means fewer rows — and therefore fewer labels — per sheet.
 *
 *   normal (5 cols): 11 rows x 5 = 55   |  with ingredients: 7 rows x 5 = 35
 *   big    (4 cols):  5 rows x 4 = 20   |  with ingredients: 4 rows x 4 = 16
 */

export type LabelSize = 'normal' | 'big';

/**
 * Columns per row. NOTE: this mirrors `grid-template-columns` in
 * label-sheet.component.scss (`repeat(5, …)` / `repeat(4, …)`) — the SCSS is what
 * actually drives layout; this constant exists for maths (offset row positions).
 */
export const LABEL_COLS: Record<LabelSize, number> = { normal: 5, big: 4 };

/** Total label cells on one sheet for the given size + ingredient presence. */
export function sheetCapacity(size: LabelSize, hasIngredients: boolean): number {
  return size === 'big'
    ? (hasIngredients ? 16 : 20)
    : (hasIngredients ? 35 : 55);
}
