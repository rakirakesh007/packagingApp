import { Router } from 'express';
import { InventoryModel } from '../models/inventory.model';

const router = Router();

// GET /inventory/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const lowStockItems = await InventoryModel.find({
      total_stock: { $lte: '$low_stock_threshold' },
    });

    return res.json({
      success: true,
      data: lowStockItems,
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