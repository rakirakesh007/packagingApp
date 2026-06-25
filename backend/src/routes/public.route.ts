import { Router, Request, Response } from 'express';
import { InventoryModel } from '../models/inventory.model';

const router = Router();

/**
 * GET /public/catalog — in-stock storefront items for the public customer page.
 * Only items with at least 1 whole sheet available. No auth.
 * Orders are placed via a WhatsApp deep-link from the frontend (nothing stored
 * server-side); inventory only changes through the normal delivery-boy sale flow.
 */
router.get('/catalog', async (_req: Request, res: Response) => {
  try {
    const docs = await InventoryModel.find(
      { total_stock: { $gte: 1 } },
      {
        item_name: 1, hindi_name: 1, units_per_sheet: 1, wholesale_price_per_sheet: 1,
        total_stock: 1, search_aliases: 1, mrp_per_unit: 1, image_url: 1,
      }
    ).sort({ item_name: 1 }).lean();

    const items = docs.map((d) => {
      const units = Math.max(1, (d as any).units_per_sheet ?? 1);
      const perPacket = (d as any).wholesale_price_per_sheet ?? 0;
      return {
        id:               String(d._id),
        item_name:        (d as any).item_name ?? '',
        hindi_name:       (d as any).hindi_name ?? '',
        units_per_sheet:  units,
        price_per_sheet:  perPacket * units,
        sheets_available: Math.floor((d as any).total_stock ?? 0),
        search_aliases:   (d as any).search_aliases ?? '',
        mrp_per_unit:     (d as any).mrp_per_unit ?? 0,
        image_url:        (d as any).image_url ?? null,
      };
    });

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
