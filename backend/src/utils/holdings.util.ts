import { LoadingModel } from '../models/loading.model';
import { SaleModel } from '../models/sale.model';
import { ReturnModel } from '../models/return.model';
import { InventoryModel } from '../models/inventory.model';

export type Holding = {
  item_id: string;
  item_name: string;
  hindi_name: string;
  variant_name: string;
  units_per_sheet: number;
  mrp_per_unit: number;
  wholesale_price_per_sheet: number;
  assigned: number;
  sold: number;
  returned: number;
  withBoy: number;
};

/**
 * Running balance of everything a delivery boy still physically holds, across all days:
 *   withBoy = Σ assigned (Loading) − Σ sold (Sale) − Σ returned (Return)
 */
export async function computeHoldings(deliveryBoyId: string): Promise<Holding[]> {
  const [loadings, sales, returns] = await Promise.all([
    LoadingModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
    SaleModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
    ReturnModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
  ]);

  const map = new Map<string, Holding>();
  const ensure = (id: string): Holding => {
    let h = map.get(id);
    if (!h) {
      h = { item_id: id, item_name: '', hindi_name: '', variant_name: '', units_per_sheet: 1, mrp_per_unit: 0, wholesale_price_per_sheet: 0, assigned: 0, sold: 0, returned: 0, withBoy: 0 };
      map.set(id, h);
    }
    return h;
  };

  for (const l of loadings) {
    for (const it of (l.items as any[])) {
      const h = ensure(String(it.item_id));
      h.assigned += Number(it.qty) || 0;
      if (it.item_name)   h.item_name   = String(it.item_name);
      if (it.hindi_name)  h.hindi_name  = String(it.hindi_name);
      if (it.variant_name !== undefined) h.variant_name = String(it.variant_name ?? '');
    }
  }
  for (const s of sales) {
    for (const it of (s.items as any[])) {
      ensure(String(it.item_id)).sold += Number(it.sheets_sold) || 0;
    }
  }
  for (const r of returns) {
    ensure(String(r.item_id)).returned += Number(r.qty) || 0;
  }

  const ids = [...map.keys()];
  if (ids.length) {
    const invDocs = await InventoryModel.find(
      { _id: { $in: ids } },
      { units_per_sheet: 1, mrp_per_unit: 1, wholesale_price_per_sheet: 1, item_name: 1, hindi_name: 1, variant_name: 1 }
    ).lean();
    for (const inv of invDocs) {
      const h = map.get(String(inv._id));
      if (!h) continue;
      h.units_per_sheet          = (inv as any).units_per_sheet          ?? 1;
      h.mrp_per_unit             = (inv as any).mrp_per_unit             ?? 0;
      h.wholesale_price_per_sheet = (inv as any).wholesale_price_per_sheet ?? 0;
      if (!h.item_name)    h.item_name    = (inv as any).item_name    ?? '';
      if (!h.hindi_name)   h.hindi_name   = (inv as any).hindi_name   ?? '';
      if (!h.variant_name) h.variant_name = (inv as any).variant_name ?? '';
    }
  }

  return [...map.values()]
    .map((h) => ({ ...h, withBoy: h.assigned - h.sold - h.returned }))
    .filter((h) => h.withBoy > 0.0001)
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}
