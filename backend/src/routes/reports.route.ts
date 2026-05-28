import { Router } from 'express';
import { SaleModel } from '../models/sale.model';
import { LoadingModel } from '../models/loading.model';
const router = Router();

router.get('/eod/:delivery_boy_id', async (req, res) => {
  const { delivery_boy_id } = req.params;

  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Fetch Opening Stock
    const loading = await LoadingModel.findOne({
      delivery_boy_id,
      date: { $gte: start, $lte: end },
    });

    if (!loading) {
      return res.status(404).json({
        success: false,
        message: 'No loading data found for today.',
      });
    }

    const openingStock = loading.items.map((item) => ({
      item_id:    item.item_id,
      item_name:  (item as any).item_name  || '',
      hindi_name: (item as any).hindi_name || '',
      qty:        item.qty,
    }));

    // Fetch Sales
    const sales = await SaleModel.find({
      delivery_boy_id,
      timestamp: { $gte: start, $lte: end },
    });

    const soldItems: Record<string, number> = {};
    let totalCash = 0;

    sales.forEach((sale) => {
      totalCash += sale.total_amount;
      sale.items.forEach((item) => {
        const key = item.item_id.toString();
        if (!soldItems[key]) soldItems[key] = 0;
        soldItems[key] += (item as any).sheets_sold ?? 0;
      });
    });

    // Calculate Closing Stock
    const closingStock = openingStock.map((item) => {
      const key = item.item_id.toString();
      return {
        item_id:    item.item_id,
        item_name:  (item as any).item_name  || '',
        hindi_name: (item as any).hindi_name || '',
        opening:    item.qty,
        sold:       soldItems[key] || 0,
        remaining:  item.qty - (soldItems[key] || 0),
      };
    });

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