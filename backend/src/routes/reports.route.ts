import { Router } from 'express';
import { SaleModel } from '../models/sale.model';
import { requireSelfOrAdmin } from '../middleware/auth.middleware';
import { computeHoldings } from '../utils/holdings.util';
const router = Router();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

router.get('/eod/:delivery_boy_id', requireSelfOrAdmin('delivery_boy_id'), async (req, res) => {
  const delivery_boy_id = String(req.params['delivery_boy_id']);

  try {
    const inIST = new Date(Date.now() + IST_OFFSET_MS);
    const y = inIST.getUTCFullYear(), m = inIST.getUTCMonth(), d = inIST.getUTCDate();
    const start = new Date(Date.UTC(y, m, d,  0,  0,  0,   0) - IST_OFFSET_MS);
    const end   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);

    // Current running balance (what the boy holds right now)
    const holdings = await computeHoldings(delivery_boy_id);
    const holdingsMap = new Map(holdings.map((h) => [h.item_id, h]));

    // Today's sales
    const sales = await SaleModel.find({
      delivery_boy_id,
      timestamp: { $gte: start, $lte: end },
    });

    if (holdings.length === 0 && sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No stock loaded or sold today.',
      });
    }

    const soldItems: Record<string, number> = {};
    let totalCash = 0;

    sales.forEach((sale) => {
      totalCash += sale.total_amount;
      sale.items.forEach((item) => {
        const key = item.item_id.toString();
        soldItems[key] = (soldItems[key] || 0) + ((item as any).sheets_sold ?? 0);
      });
    });

    // Union of all item_ids from holdings + today's sold
    const allItemIds = new Set([...holdingsMap.keys(), ...Object.keys(soldItems)]);

    const closingStock = [...allItemIds].map((id) => {
      const h         = holdingsMap.get(id);
      const todaySold = soldItems[id] || 0;
      const withBoy   = h?.withBoy ?? 0;
      // Opening = what boy had at START of today = current balance + what was sold today
      const opening   = withBoy + todaySold;
      return {
        item_id:         id,
        item_name:       h?.item_name  ?? '',
        hindi_name:      h?.hindi_name ?? '',
        units_per_sheet: h?.units_per_sheet ?? 1,
        opening,
        sold:            todaySold,
        remaining:       withBoy,
      };
    }).filter((r) => r.opening > 0).sort((a, b) => a.item_name.localeCompare(b.item_name));

    return res.json({
      success: true,
      data: {
        closingStock,
        totalCash,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message,
    });
  }
});

export default router;