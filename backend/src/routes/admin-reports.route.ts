import { Router, Request, Response } from 'express';
import { SaleModel } from '../models/sale.model';
import { LoadingModel } from '../models/loading.model';
import { ExpenseModel } from '../models/expense.model';

const router = Router();

/**
 * GET /admin/reports/eod — EOD summary across all delivery boys.
 * Returns: delivery_boy_id, openingStock, sold, remaining, cashCollected.
 */
router.get('/eod', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

    const loadings = await LoadingModel.find({ date: { $gte: start, $lte: end } });

    const summary = await Promise.all(
      loadings.map(async (loading) => {
        const openingStock = loading.items.reduce((sum, i) => sum + i.qty, 0);

        const sales = await SaleModel.find({
          delivery_boy_id: loading.delivery_boy_id,
          timestamp: { $gte: start, $lte: end },
        });

        const sold = sales.reduce(
          (sum, s) => sum + s.items.reduce((si, i) => si + i.qty, 0),
          0
        );
        const cashCollected = sales.reduce((sum, s) => sum + s.total_amount, 0);

        return {
          delivery_boy_id: loading.delivery_boy_id,
          openingStock,
          sold,
          remaining: openingStock - sold,
          cashCollected,
        };
      })
    );

    return res.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/monthly — Monthly financial summary.
 * Net Profit = (Sale Price - Purchase Price) - Expenses
 */
router.get('/monthly', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const sales = await SaleModel.find({ timestamp: { $gte: start, $lte: end } });
    const expenses = await ExpenseModel.find({ date: { $gte: start, $lte: end } });

    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalSales - totalExpenses;

    return res.json({ totalSales, totalExpenses, netProfit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
