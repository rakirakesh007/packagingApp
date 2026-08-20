import { Router, Request, Response } from 'express';
import { SaleModel } from '../models/sale.model';
import { LoadingModel } from '../models/loading.model';
import { ExpenseModel } from '../models/expense.model';
import { InventoryModel } from '../models/inventory.model';
import { UserModel } from '../models/user.model';
import { computeHoldings } from '../utils/holdings.util';

const router = Router();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Expense categories that are ALREADY baked into each sale's cost_per_sheet
 * (pouch/label = Packaging, material = Raw Material, delivery-boy = Salary).
 * These are production/stock costs, NOT overhead — subtracting them from
 * gross profit again would double-count. So Net Profit excludes them; they are
 * reported separately as "stock purchased" (a cash-out / inventory figure).
 */
const COGS_EXPENSE_CATEGORIES = new Set(['Raw Material', 'Packaging', 'Salary']);

/** Split expenses into overhead (reduces Net Profit) vs stock/COGS (does not). */
function splitExpenses(expenses: Array<{ category?: string; amount?: number }>): {
  overhead: number;
  stock: number;
  total: number;
} {
  let overhead = 0, stock = 0;
  for (const e of expenses) {
    const amt = e.amount ?? 0;
    if (COGS_EXPENSE_CATEGORIES.has(e.category ?? '')) stock += amt;
    else overhead += amt;
  }
  return { overhead, stock, total: overhead + stock };
}

function getISTDayBounds(): { start: Date; end: Date } {
  const inIST = new Date(Date.now() + IST_OFFSET_MS);
  const y = inIST.getUTCFullYear(), m = inIST.getUTCMonth(), d = inIST.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d,  0,  0,  0,   0) - IST_OFFSET_MS),
    end:   new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS),
  };
}

function resolveMonthRange(month?: string, year?: string): { start: Date; end: Date; monthNumber: number; yearNumber: number } {
  const inIST = new Date(Date.now() + IST_OFFSET_MS);
  const monthNumber = month ? Math.max(1, Math.min(12, Number(month))) - 1 : inIST.getUTCMonth();
  const yearNumber = year ? Number(year) : inIST.getUTCFullYear();
  return {
    start: new Date(Date.UTC(yearNumber, monthNumber, 1, 0, 0, 0, 0) - IST_OFFSET_MS),
    end:   new Date(Date.UTC(yearNumber, monthNumber + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS),
    monthNumber,
    yearNumber,
  };
}

/** Map item_id → units_per_sheet (frontend needs it to render "X sheets Y pcs"). */
async function buildUnitsPerSheetMap(itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const docs = await InventoryModel.find({ _id: { $in: itemIds } }, { units_per_sheet: 1 }).lean();
  return new Map(docs.map(d => [String(d._id), d.units_per_sheet ?? 1]));
}

/** Map item_id → { units_per_sheet, wholesale_price_per_sheet } */
async function buildInvInfoMap(itemIds: string[]): Promise<Map<string, { units_per_sheet: number; wholesale_price_per_sheet: number }>> {
  if (itemIds.length === 0) return new Map();
  const docs = await InventoryModel.find({ _id: { $in: itemIds } }, { units_per_sheet: 1, wholesale_price_per_sheet: 1 }).lean();
  return new Map(docs.map(d => [String(d._id), {
    units_per_sheet:          (d as any).units_per_sheet          ?? 1,
    wholesale_price_per_sheet: (d as any).wholesale_price_per_sheet ?? 0,
  }]));
}

/**
 * GET /admin/reports/today — live KPIs for the dashboard.
 */
router.get('/today', async (_req: Request, res: Response) => {
  try {
    const { start, end } = getISTDayBounds();

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

    const itemMap = new Map<string, { item_id: string; item_name: string; hindi_name: string; sheets_sold: number; revenue: number; profit: number }>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = String(item.item_id);
        const cur = itemMap.get(key) ?? { item_id: key, item_name: (item as any).item_name || '', hindi_name: (item as any).hindi_name || '', sheets_sold: 0, revenue: 0, profit: 0 };
        cur.sheets_sold += (item as any).sheets_sold ?? 0;
        cur.revenue     += (item as any).final_price ?? 0;
        cur.profit      += (item as any).profit      ?? 0;
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
 * Opening = withBoy_current (across all boys) + today_sold (same correct formula as per-boy EOD).
 */
router.get('/eod-by-product', async (_req: Request, res: Response) => {
  try {
    const { start, end } = getISTDayBounds();

    const [sales, loadings] = await Promise.all([
      SaleModel.find({ timestamp: { $gte: start, $lte: end } }),
      LoadingModel.find({ date: { $gte: start, $lte: end } }),
    ]);

    // Today's sold per item (across all boys)
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

    // All active boy IDs from today's loadings + today's sales
    const allBoyIds = new Set<string>([
      ...loadings.map(l => String(l.delivery_boy_id)),
      ...sales.map(s => String(s.delivery_boy_id)),
    ]);

    // Aggregate withBoy per item across all boys
    const globalWithBoy = new Map<string, { withBoy: number; item_name: string; hindi_name: string; units_per_sheet: number }>();
    await Promise.all([...allBoyIds].map(async (boyId) => {
      const holdings = await computeHoldings(boyId);
      for (const h of holdings) {
        const cur = globalWithBoy.get(h.item_id) ?? { withBoy: 0, item_name: h.item_name, hindi_name: h.hindi_name, units_per_sheet: h.units_per_sheet };
        cur.withBoy += h.withBoy;
        if (!cur.item_name)  cur.item_name  = h.item_name;
        if (!cur.hindi_name) cur.hindi_name = h.hindi_name;
        globalWithBoy.set(h.item_id, cur);
      }
    }));

    // Union of items from globalWithBoy + sold today
    const allItemIds = new Set([...globalWithBoy.keys(), ...soldMap.keys()]);
    const invInfoMap = await buildInvInfoMap([...allItemIds]);

    const result = [...allItemIds].map(id => {
      const h = globalWithBoy.get(id);
      const todaySold = soldMap.get(id) ?? 0;
      const withBoy   = h?.withBoy ?? 0;
      const names     = soldNames.get(id) ?? { item_name: '', hindi_name: '' };
      const inv       = invInfoMap.get(id);
      return {
        item_id:                   id,
        item_name:                 h?.item_name  || names.item_name,
        hindi_name:                h?.hindi_name || names.hindi_name,
        units_per_sheet:           h?.units_per_sheet ?? inv?.units_per_sheet ?? 1,
        wholesale_price_per_sheet: inv?.wholesale_price_per_sheet ?? 0,
        opening:                   withBoy + todaySold,
        sold:                      todaySold,
        remaining:                 withBoy,
      };
    }).filter(r => r.opening > 0 || r.sold > 0).sort((a, b) => b.sold - a.sold);

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/eod — EOD summary across all delivery boys (with names).
 * Includes boys with today's loadings OR today's sales (handles carryover without new morning assignment).
 */
router.get('/eod', async (_req: Request, res: Response) => {
  try {
    const { start, end } = getISTDayBounds();

    const [loadings, todaySalesAll] = await Promise.all([
      LoadingModel.find({ date: { $gte: start, $lte: end } }),
      SaleModel.find({ timestamp: { $gte: start, $lte: end } }),
    ]);

    const boyIdSet = new Set<string>([
      ...loadings.map(l => String(l.delivery_boy_id)),
      ...todaySalesAll.map(s => String(s.delivery_boy_id)).filter(id => id && id !== 'null'),
    ]);
    const allBoyIds = [...boyIdSet];

    if (allBoyIds.length === 0) return res.json([]);

    const users = await UserModel.find({ _id: { $in: allBoyIds } }).lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const summary = await Promise.all(
      allBoyIds.map(async (boyId) => {
        const holdings = await computeHoldings(boyId);
        const withBoyTotal = holdings.reduce((sum, h) => sum + h.withBoy, 0);

        const sales = await SaleModel.find({
          delivery_boy_id: boyId,
          timestamp: { $gte: start, $lte: end },
        });

        const todaySold = sales.reduce(
          (sum, s) => sum + s.items.reduce((si, i) => si + ((i as any).sheets_sold ?? 0), 0),
          0
        );
        const cashCollected = sales.reduce((sum, s) => sum + s.total_amount, 0);
        const user = userMap.get(boyId);

        const openingStock = Math.round((withBoyTotal + todaySold) * 1000) / 1000;
        const sold         = Math.round(todaySold * 1000) / 1000;
        const remaining    = Math.round(withBoyTotal * 1000) / 1000;

        return {
          delivery_boy_id:   boyId,
          delivery_boy_name: user?.name || user?.username || boyId,
          openingStock,
          sold,
          remaining,
          cashCollected,
        };
      })
    );

    return res.json(summary.filter(s => s.openingStock > 0 || s.sold > 0 || s.cashCollected > 0));
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
    const { overhead: overheadExpenses, stock: stockPurchased, total: totalExpenses } = splitExpenses(expenses);
    // Net Profit = gross profit − OVERHEAD only. Stock/COGS categories (Raw
    // Material, Packaging, Salary) are already inside cost_per_sheet, so they
    // must not be subtracted again. Reported separately as stockPurchased.
    const netProfit      = totalProfit - overheadExpenses;

    // Month's expenses grouped by category (Fuel, Raw Material, Salary, …), largest first.
    const byCategory = new Map<string, number>();
    expenses.forEach(e => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount));
    const expenseByCategory = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return res.json({
      month: monthNumber + 1,
      year: yearNumber,
      totalRevenue,
      totalProfit,            // gross profit (final price − production cost) before expenses
      totalExpenses,          // all expenses (overhead + stock) — kept for reference
      overheadExpenses,       // expenses that reduce Net Profit
      stockPurchased,         // Raw Material + Packaging + Salary (already in cost_per_sheet)
      netProfit,              // totalProfit − overheadExpenses
      expenseByCategory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/overall — All-time totals since the first recorded sale.
 */
router.get('/overall', async (_req: Request, res: Response) => {
  try {
    const [sales, expenses] = await Promise.all([
      SaleModel.find({}, { total_amount: 1, total_profit: 1, timestamp: 1, items: 1 }).lean(),
      ExpenseModel.find({}, { amount: 1, category: 1 }).lean(),
    ]);

    const totalRevenue  = sales.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
    const totalProfit   = sales.reduce((sum, s) => sum + ((s as any).total_profit ?? 0), 0);
    const { overhead: overheadExpenses, stock: stockPurchased, total: totalExpenses } = splitExpenses(expenses);
    const totalSheets   = sales.reduce(
      (sum, s) => sum + (s.items ?? []).reduce((si: number, i: any) => si + (i.sheets_sold ?? 0), 0),
      0
    );
    const firstSaleDate = sales.reduce<Date | null>((min, s) => {
      const ts = s.timestamp ? new Date(s.timestamp as any) : null;
      return ts && (!min || ts < min) ? ts : min;
    }, null);

    return res.json({
      totalRevenue,
      totalProfit,
      totalExpenses,          // all expenses (overhead + stock) — kept for reference
      overheadExpenses,       // expenses that reduce Net Profit
      stockPurchased,         // Raw Material + Packaging + Salary (already in cost_per_sheet)
      netProfit: totalProfit - overheadExpenses,
      totalSheets: Math.round(totalSheets * 1000) / 1000,
      salesCount: sales.length,
      firstSaleDate,
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

/**
 * GET /admin/reports/boy-payout?month=&year= — Delivery-boy commission owed.
 *
 * One row per (IST date × delivery boy). Commission is a FLAT per-sheet rate by
 * ₹-variant, regardless of the selling price:
 *   rate = mrp × 0.8   →   ₹5 → ₹4/sheet,   ₹10 → ₹8/sheet.
 *   payout_line = rate × sheets_sold, summed per (date, boy).
 * sheets5 / sheets10 tally sheets by variant (all current inventory is ₹5/₹10).
 *
 * Pack size: the rate above assumes a 12-pouch sheet. Items with units_per_sheet
 * of 10 earn ZERO commission until a 10-pouch rate is agreed — their sheets still
 * appear in the sheets5/sheets10 counts, they just contribute ₹0 to payout.
 */
router.get('/boy-payout', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] as string | undefined;
    const year  = req.query['year']  as string | undefined;
    const { start, end } = resolveMonthRange(month, year);

    const sales = await SaleModel.find({
      delivery_boy_id: { $ne: null },
      timestamp: { $gte: start, $lte: end },
    }).lean();

    // item_id → mrp_per_unit + sale_mode. MRP is the ₹5/₹10 sheet discriminator;
    // sale_mode 'packet' items (e.g. 50g pouches) use a flat per-pouch commission.
    const itemIds = [...new Set(sales.flatMap(s => s.items.map(i => String(i.item_id))))];
    const invDocs = itemIds.length
      ? await InventoryModel.find({ _id: { $in: itemIds } }, { mrp_per_unit: 1, sale_mode: 1, units_per_sheet: 1 }).lean()
      : [];
    const mrpMap   = new Map(invDocs.map(d => [String(d._id), (d as any).mrp_per_unit ?? 0]));
    const modeMap  = new Map(invDocs.map(d => [String(d._id), (d as any).sale_mode ?? 'sheet']));
    const unitsMap = new Map(invDocs.map(d => [String(d._id), (d as any).units_per_sheet ?? 12]));

    // Resolve delivery-boy names.
    const boyIds = [...new Set(sales.map(s => String(s.delivery_boy_id)).filter(id => id && id !== 'null'))];
    const users = boyIds.length ? await UserModel.find({ _id: { $in: boyIds } }).lean() : [];
    const userMap = new Map(users.map(u => [String(u._id), u]));

    // Flat delivery commission per 50g (packet-mode) pouch sold.
    const PACKET_COMMISSION = 2;

    const rows = new Map<string, { date: string; delivery_boy_id: string; delivery_boy_name: string; sheets5: number; sheets10: number; packets: number; payout: number }>();

    sales.forEach(sale => {
      const boyId = String(sale.delivery_boy_id);
      const dateKey = new Date((sale.timestamp as Date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
      const key = `${dateKey}|${boyId}`;
      const row = rows.get(key) ?? {
        date: dateKey,
        delivery_boy_id: boyId,
        delivery_boy_name: userMap.get(boyId)?.name || userMap.get(boyId)?.username || boyId,
        sheets5: 0,
        sheets10: 0,
        packets: 0,
        payout: 0,
      };

      sale.items.forEach(item => {
        const mrp    = mrpMap.get(String(item.item_id)) ?? 0;
        const mode   = modeMap.get(String(item.item_id)) ?? 'sheet';
        const sheets = (item as any).sheets_sold ?? 0;
        if (sheets <= 0) return;
        // Packet-mode items (50g pouches, units_per_sheet=1) earn a flat per-pouch
        // commission — the ₹5/₹10 per-sheet rate does not apply to them.
        if (mode === 'packet') {
          row.payout  += PACKET_COMMISSION * sheets;
          row.packets += sheets;
          return;
        }
        if (mrp <= 0) return;
        // 10-pouch sheets earn NO commission for now — the per-sheet rate below is
        // calibrated for 12-pouch sheets and a rate for 10-pouch has not been set yet.
        // Their sheets still tally into sheets5/sheets10 so the volume stays visible.
        const isTenPouch = unitsMap.get(String(item.item_id)) === 10;
        // Flat commission per sheet by variant: ₹5 → ₹4, ₹10 → ₹8 (mrp × 0.8),
        // regardless of the selling price.
        const rate = isTenPouch ? 0 : mrp * 0.8;
        row.payout += rate * sheets;
        if (mrp === 5)  row.sheets5  += sheets;
        else if (mrp === 10) row.sheets10 += sheets;
      });

      rows.set(key, row);
    });

    const result = [...rows.values()]
      .map(r => ({
        ...r,
        sheets5: Math.round(r.sheets5 * 1000) / 1000,
        sheets10: Math.round(r.sheets10 * 1000) / 1000,
        packets: Math.round(r.packets * 1000) / 1000,
        payout: Math.round(r.payout * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.delivery_boy_name.localeCompare(b.delivery_boy_name));

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /admin/reports/daily-sales?month=&year= — Revenue per day for bar chart.
 */
router.get('/daily-sales', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] as string | undefined;
    const year  = req.query['year']  as string | undefined;
    const { start, end, monthNumber, yearNumber } = resolveMonthRange(month, year);

    const sales = await SaleModel.find({ timestamp: { $gte: start, $lte: end } }).lean();

    const dailyMap = new Map<number, number>();
    sales.forEach(sale => {
      const dayIST = new Date((sale.timestamp as Date).getTime() + IST_OFFSET_MS).getUTCDate();
      dailyMap.set(dayIST, (dailyMap.get(dayIST) ?? 0) + sale.total_amount);
    });

    const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber + 1, 0)).getUTCDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      revenue: Math.round((dailyMap.get(i + 1) ?? 0) * 100) / 100,
    }));

    return res.json(days);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
