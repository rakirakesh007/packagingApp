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
    // Store visibility is controlled by the in_stock toggle only. total_stock is
    // informational (never blocks a sale), so it is NOT used to hide items here.
    const docs = await InventoryModel.find(
      { in_stock: { $ne: false } },
      {
        item_name: 1, hindi_name: 1, units_per_sheet: 1, wholesale_price_per_sheet: 1,
        total_stock: 1, search_aliases: 1, mrp_per_unit: 1, image_url: 1, category: 1,
        variant_name: 1, quantity_per_unit: 1, sale_mode: 1,
      }
    ).sort({ item_name: 1 }).lean();

    const items = docs.map((d) => {
      const units = Math.max(1, (d as any).units_per_sheet ?? 1);
      const perPacket = (d as any).wholesale_price_per_sheet ?? 0;
      const mrp = (d as any).mrp_per_unit ?? 0;
      const isPacket = (d as any).sale_mode === 'packet';
      // Customer storefront shows the small-quantity retail rate (0.75 × MRP ×
      // pack size — e.g. ₹5×12=₹45, ₹10×12=₹90, ₹10×10=₹75), not the bulk
      // wholesale default used for delivery-boy/shop sales. Packet-mode (50g)
      // items keep the wholesale-based price — unaffected by this.
      const retailPricePerSheet = isPacket ? Math.round(perPacket * units) : Math.round(0.75 * mrp * units);
      return {
        id:               String(d._id),
        item_name:        (d as any).item_name ?? '',
        hindi_name:       (d as any).hindi_name ?? '',
        units_per_sheet:  units,
        price_per_sheet:  retailPricePerSheet,
        sheets_available:  Math.floor((d as any).total_stock ?? 0),
        search_aliases:    (d as any).search_aliases ?? '',
        mrp_per_unit:      (d as any).mrp_per_unit ?? 0,
        image_url:         (d as any).image_url ?? null,
        category:          (d as any).category ?? '',
        variant_name:      (d as any).variant_name ?? '',
        quantity_per_unit: (d as any).quantity_per_unit ?? 0,
        sale_mode:         (d as any).sale_mode ?? 'sheet',
      };
    });

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
