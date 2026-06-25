import { Router, Request, Response } from 'express';
import { SaleModel } from '../models/sale.model';
import { LoadingModel } from '../models/loading.model';
import { ExpenseModel } from '../models/expense.model';
import { InventoryModel } from '../models/inventory.model';
import { UserModel } from '../models/user.model';
import { computeHoldings } from '../utils/holdings.util';

const router = Router();

function resolveMonthRange(month?: string, year?: string): { start: Date; end: Date; monthNumber: number; yearNumber: number } {
  const now = new Date();
  const monthNumber = month ? Math.max(1, Math.min(12, Number(month))) - 1 : now.getMonth();
  const yearNumber = year ? Number(year) : now.getFullYear();
  const start = new Date(yearNumber, monthNumber, 1, 0, 0, 0, 0);
  const end = new Date(yearNumber, monthNumber + 1, 0, 23, 59, 59, 999);
  return { start, end, monthNumber, yearNumber };
}

/** Map item_id → units_per_sheet (frontend needs it to render "X sheets Y pcs"). */
async function buildUnitsPerSheetMap(itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const docs = await InventoryModel.find({ _id: { $in: itemIds } }, { units_per_sheet: 1 }).lean();
  return new Map(docs.map(d => [String(d._id), d.units_per_sheet ?? 1]));
}

/**
 * GET /admin/reports/today — live KPIs for the dashboard.
 */
router.get('/today', async (_req: Request, res: Response) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [sales, loadings] = await Promise.all([
      SaleModel.find({ timestamp: { $gte: start, $lte: end } }),
      LoadingModel.find({ date: { $gte: start, $lte: end } }),
    ]);

    const totalRevenue  = sales.reduce((s, sale) => s + sale.total_amount, 0);
    const totalSales    = sales.length;
    const totalProfit   = sales.reduce((s, sale) => s + ((sale as any).total_profit ?? 0), 0);
    const cashCollected = sales.filter(s => s.payment_mode === 'cash').reduce((s, sale) => s + sale.total_amount, 0);
    const activeBoys    = loadings.length;

    const itemMap = new Map<string, { item_id: string; item_name: string; hindi_name: string; sheets_sold: number; revenue: number }>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = String(item.item_id);
        const cur = itemMap.get(key) ?? { item_id: key, item_name: (item as any).item_name || '', hindi_name: (item as any).hindi_name || '', sheets_sold: 0, revenue: 0 };
        cur.sheets_sold += (item as any).sheets_sold ?? 0;
        cur.revenue     += (item as any).final_price  ?? 0;
        itemMap.set(key, cur);
      });
    });

    // units_per_sheet is needed by the frontend to render "X sheets Y pcs".
    // Sale items don't store it — look it up from inventory.
    const unitsMap = await buildUnitsPerSheetMap([...itemMap.keys()]);
    const topItems = [...itemMap.values()]
      .map(item => ({ ...item, units_per_sheet: unitsMap.get(item.item_id) ?? 1 }))
      .sort((a, b) => b.sheets_sold - a.sheets_sold)
      .slice(0, 5);

    return res.json({ totalRevenue, totalSales, totalProfit, cashCollected, activeBoys, topItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/item-sales?month=&year= — item-wise quantity sold for a month
 * (defaults to the current month). Returns ALL items sold, sorted by quantity desc.
 */
router.get('/item-sales', async (req: Request, res: Response) => {
  try {
    const { start, end } = resolveMonthRange(req.query['month'] as string | undefined, req.query['year'] as string | undefined);
    const sales = await SaleModel.find({ timestamp: { $gte: start, $lte: end } });

    const itemMap = new Map<string, { item_id: string; item_name: string; hindi_name: string; sheets_sold: number }>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = String(item.item_id);
        const cur = itemMap.get(key) ?? { item_id: key, item_name: (item as any).item_name || '', hindi_name: (item as any).hindi_name || '', sheets_sold: 0 };
        cur.sheets_sold += (item as any).sheets_sold ?? 0;
        itemMap.set(key, cur);
      });
    });

    // Attach units_per_sheet + mrp_per_unit (variants share a name, so MRP disambiguates).
    const ids = [...itemMap.keys()];
    const invDocs = ids.length
      ? await InventoryModel.find({ _id: { $in: ids } }, { units_per_sheet: 1, mrp_per_unit: 1 }).lean()
      : [];
    const invMap = new Map(invDocs.map(d => [String(d._id), d]));
    const items = [...itemMap.values()]
      .map(item => ({
        ...item,
        units_per_sheet: (invMap.get(item.item_id) as any)?.units_per_sheet ?? 1,
        mrp_per_unit:    (invMap.get(item.item_id) as any)?.mrp_per_unit ?? 0,
      }))
      .sort((a, b) => b.sheets_sold - a.sheets_sold);

    return res.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/eod-by-product — today stock grouped by item.
 */
router.get('/eod-by-product', async (_req: Request, res: Response) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [sales, loadings] = await Promise.all([
      SaleModel.find({ timestamp: { $gte: start, $lte: end } }),
      LoadingModel.find({ date: { $gte: start, $lte: end } }),
    ]);

    const openingMap = new Map<string, { item_id: string; item_name: string; hindi_name: string; opening: number }>();
    loadings.forEach(loading => {
      loading.items.forEach(item => {
        const key = String(item.item_id);
        const cur = openingMap.get(key) ?? { item_id: key, item_name: (item as any).item_name || '', hindi_name: (item as any).hindi_name || '', opening: 0 };
        cur.opening += item.qty;
        openingMap.set(key, cur);
      });
    });

    const soldMap = new Map<string, number>();
    const soldNames = new Map<string, { item_name: string; hindi_name: string }>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = String(item.item_id);
        soldMap.set(key, (soldMap.get(key) ?? 0) + ((item as any).sheets_sold ?? 0));
        if (!soldNames.has(key)) {
          soldNames.set(key, { item_name: (item as any).item_name || '', hindi_name: (item as any).hindi_name || '' });
        }
      });
    });

    // Include sold-only items (retail sales of stock not in today's loadings).
    soldMap.forEach((_v, key) => {
      if (!openingMap.has(key)) {
        const names = soldNames.get(key) ?? { item_name: '', hindi_name: '' };
        openingMap.set(key, { item_id: key, item_name: names.item_name, hindi_name: names.hindi_name, opening: 0 });
      }
    });

    const unitsMap = await buildUnitsPerSheetMap([...openingMap.keys()]);
    const result = [...openingMap.values()].map(item => ({
      ...item,
      units_per_sheet: unitsMap.get(item.item_id) ?? 1,
      sold:      soldMap.get(item.item_id) ?? 0,
      remaining: item.opening - (soldMap.get(item.item_id) ?? 0),
    })).sort((a, b) => b.sold - a.sold);

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/eod — EOD summary across all delivery boys (with names).
 */
router.get('/eod', async (_req: Request, res: Response) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const loadings = await LoadingModel.find({ date: { $gte: start, $lte: end } });

    const deliveryBoyIds = loadings.map(l => String(l.delivery_boy_id));
    const users = deliveryBoyIds.length ? await UserModel.find({ _id: { $in: deliveryBoyIds } }).lean() : [];
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const summary = await Promise.all(
      loadings.map(async (loading) => {
        const boyId = String(loading.delivery_boy_id);

        // True running balance (carryover + today's new loading − all sales − returns)
        const holdings = await computeHoldings(boyId);
        const withBoyTotal = holdings.reduce((sum, h) => sum + h.withBoy, 0);

        const sales = await SaleModel.find({
          delivery_boy_id: loading.delivery_boy_id,
          timestamp: { $gte: start, $lte: end },
        });

        const todaySold = sales.reduce(
          (sum, s) => sum + s.items.reduce((si, i) => si + ((i as any).sheets_sold ?? 0), 0),
          0
        );
        const cashCollected = sales.reduce((sum, s) => sum + s.total_amount, 0);
        const user = userMap.get(boyId);

        // Opening = what boy had at START of today = current balance + what was sold today
        const openingStock = Math.round((withBoyTotal + todaySold) * 1000) / 1000;
        const sold         = Math.round(todaySold * 1000) / 1000;
        const remaining    = Math.round(withBoyTotal * 1000) / 1000;

        return {
          delivery_boy_id:   loading.delivery_boy_id,
          delivery_boy_name: user?.name || user?.username || boyId,
          openingStock,
          sold,
          remaining,
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
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] as string | undefined;
    const year = req.query['year'] as string | undefined;
    const { start, end, monthNumber, yearNumber } = resolveMonthRange(month, year);

    const sales    = await SaleModel.find({ timestamp: { $gte: start, $lte: end } });
    const expenses = await ExpenseModel.find({ date: { $gte: start, $lte: end } });

    const totalRevenue   = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalProfit    = sales.reduce((sum, s) => sum + ((s as any).total_profit  ?? 0), 0);
    const totalExpenses  = expenses.reduce((sum, e) => sum + e.amount, 0);
    // netProfit = gross profit from production margins minus operational expenses
    const netProfit      = totalProfit - totalExpenses;

    return res.json({
      month: monthNumber + 1,
      year: yearNumber,
      totalRevenue,
      totalProfit,            // gross profit (final price − production cost) before expenses
      totalExpenses,
      netProfit,              // totalProfit − totalExpenses
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/staff-monthly — Monthly payroll / delivery-boy performance.
 */
router.get('/staff-monthly', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] as string | undefined;
    const year = req.query['year'] as string | undefined;
    const { start, end, monthNumber, yearNumber } = resolveMonthRange(month, year);

    const sales = await SaleModel.find({
      delivery_boy_id: { $ne: null },
      timestamp: { $gte: start, $lte: end },
    });

    const deliveryBoyIds = [...new Set(sales.map((sale) => String(sale.delivery_boy_id)))]
      .filter((id) => id && id !== 'null');

    const users = deliveryBoyIds.length
      ? await UserModel.find({ _id: { $in: deliveryBoyIds } }).lean()
      : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const grouped = new Map<string, { deliveryBoyId: string; boyName: string; totalSheets: number; totalSales: number; totalProfit: number; totalCashCollected: number; netCash: number; paymentStatus: string }>();

    sales.forEach((sale) => {
      const deliveryBoyId = String(sale.delivery_boy_id);
      const existing = grouped.get(deliveryBoyId) ?? {
        deliveryBoyId,
        boyName: userMap.get(deliveryBoyId)?.name || userMap.get(deliveryBoyId)?.username || deliveryBoyId,
        totalSheets: 0,
        totalSales: 0,
        totalProfit: 0,
        totalCashCollected: 0,
        netCash: 0,
        paymentStatus: 'Pending',
      };

      const saleSheets = sale.items.reduce((sum, item) => sum + ((item as any).sheets_sold ?? 0), 0);
      const saleCash   = sale.total_amount;

      existing.totalSheets  += saleSheets;
      existing.totalSales   += saleCash;
      existing.totalProfit   += ((sale as any).total_profit   ?? 0);
      existing.totalCashCollected += sale.payment_mode === 'cash' ? saleCash : 0;
      existing.netCash = existing.totalCashCollected;
      grouped.set(deliveryBoyId, existing);
    });

    // Round cross-item sheet totals (wholesale/whole in practice) to kill float dust.
    grouped.forEach((g) => { g.totalSheets = Math.round(g.totalSheets); });

    const staff = [...grouped.values()].sort((a, b) => a.boyName.localeCompare(b.boyName));

    return res.json({
      month: monthNumber + 1,
      year: yearNumber,
      staff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
