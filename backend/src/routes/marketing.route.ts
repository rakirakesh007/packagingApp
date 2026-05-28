import { Router, Request, Response } from 'express';
import { ShopModel } from '../models/shop.model';
import { SaleModel } from '../models/sale.model';
import { MarketingTemplateModel } from '../models/marketing-template.model';

const router = Router();

function resolveMonthRange(month?: string, year?: string): { start: Date; end: Date; monthNumber: number; yearNumber: number } {
  const now = new Date();
  const monthNumber = month ? Math.max(1, Math.min(12, Number(month))) - 1 : now.getMonth();
  const yearNumber = year ? Number(year) : now.getFullYear();
  const start = new Date(yearNumber, monthNumber, 1, 0, 0, 0, 0);
  const end = new Date(yearNumber, monthNumber + 1, 0, 23, 59, 59, 999);
  return { start, end, monthNumber, yearNumber };
}

async function buildOverview(month?: string, year?: string) {
  const { start, end, monthNumber, yearNumber } = resolveMonthRange(month, year);

  const [templates, shops, monthlySales] = await Promise.all([
    MarketingTemplateModel.find().sort({ updatedAt: -1 }).lean(),
    ShopModel.find().sort({ total_orders_count: -1 }).lean(),
    SaleModel.aggregate([
      {
        $match: {
          shop_id: { $ne: null },
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$shop_id',
          monthlySalesCount: { $sum: 1 },
          monthlySalesTotal: { $sum: '$total_amount' },
          lastOrderAt: { $max: '$timestamp' },
        },
      },
    ]),
  ]);

  const monthlyMap = new Map(
    monthlySales.map((row: { _id: unknown; monthlySalesCount: number; monthlySalesTotal: number; lastOrderAt: Date }) => [
      String(row._id),
      row,
    ])
  );

  const enrichedShops = shops.map((shop) => {
    const stats = monthlyMap.get(String(shop._id));
    return {
      shopId: String(shop._id),
      name: shop.name,
      mobile: shop.mobile,
      address: shop.address || '',
      totalOrdersCount: shop.total_orders_count ?? 0,
      monthlySalesCount: stats?.monthlySalesCount ?? 0,
      monthlySalesTotal: stats?.monthlySalesTotal ?? 0,
      lastOrderAt: stats?.lastOrderAt ?? null,
    };
  });

  const activeShops = enrichedShops.filter((shop) => shop.totalOrdersCount > 0).length;
  const totalBroadcastTargets = enrichedShops.filter((shop) => shop.mobile).length;
  const totalMonthlySales = enrichedShops.reduce((sum, shop) => sum + shop.monthlySalesTotal, 0);

  return {
    month: monthNumber + 1,
    year: yearNumber,
    totals: {
      totalShops: shops.length,
      activeShops,
      totalBroadcastTargets,
      totalMonthlySales,
    },
    templates,
    shops: enrichedShops,
  };
}

/** GET /admin/marketing/overview?month=&year= */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] as string | undefined;
    const year = req.query['year'] as string | undefined;
    const overview = await buildOverview(month, year);
    return res.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** GET /admin/marketing/templates */
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await MarketingTemplateModel.find().sort({ updatedAt: -1 }).lean();
    return res.json(templates);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** POST /admin/marketing/templates */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { title, category, body, isActive } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: 'title and body are required.' });
    }

    const template = await MarketingTemplateModel.create({
      title,
      category: category || 'general',
      body,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ message });
  }
});

/** PATCH /admin/marketing/templates/:id */
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { title, category, body, isActive, usageCount, lastUsedAt } = req.body;
    const update: Record<string, unknown> = {};
    if (title !== undefined) update['title'] = title;
    if (category !== undefined) update['category'] = category;
    if (body !== undefined) update['body'] = body;
    if (isActive !== undefined) update['isActive'] = isActive;
    if (usageCount !== undefined) update['usageCount'] = usageCount;
    if (lastUsedAt !== undefined) update['lastUsedAt'] = lastUsedAt;

    const template = await MarketingTemplateModel.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!template) return res.status(404).json({ message: 'Template not found.' });
    return res.json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ message });
  }
});

/** POST /admin/marketing/templates/:id/use */
router.post('/templates/:id/use', async (req: Request, res: Response) => {
  try {
    const template = await MarketingTemplateModel.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!template) return res.status(404).json({ message: 'Template not found.' });
    return res.json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** DELETE /admin/marketing/templates/:id */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await MarketingTemplateModel.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found.' });
    return res.json({ message: 'Deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
