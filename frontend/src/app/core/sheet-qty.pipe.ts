import { Pipe, PipeTransform } from '@angular/core';
import { formatSheetQty } from './quantity.util';

/**
 * Renders a fractional sheet quantity as "X sheets Y pcs".
 * Usage: {{ item.sheets_sold | sheetQty:item.units_per_sheet }}
 */
@Pipe({ name: 'sheetQty', standalone: true })
export class SheetQtyPipe implements PipeTransform {
  transform(sheets: number | null | undefined, unitsPerSheet: number | null | undefined): string {
    return formatSheetQty(sheets ?? 0, unitsPerSheet ?? 1);
  }
}
