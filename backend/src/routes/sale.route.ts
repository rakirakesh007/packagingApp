import { Router, Request, Response } from 'express';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';
import { ShopModel } from '../models/shop.model';

const router = Router();

async function buildSaleItems(
  items: Array<{ item_id: string; sheets_sold: number; discount_amount?: number; item_name?: string; hindi_name?: string; description?: string }>,
): Promise<Array<{ item_id: string; sheets_sold: number; wholesale_price_per_sheet: number; discount_amount: number; final_price: number; profit: number; item_name: string; hindi_name: string; description: string }>> {
  const inventoryDocs = await InventoryModel.find({ _id: { $in: items.map((item) => item.item_id) } }).lean();
  const inventoryMap = new Map<string, { item_name?: string; hindi_name?: string; description?: string; wholesale_price_per_sheet?: number; production_cost_per_sheet?: number }>(
    inventoryDocs.map((doc) => [String(doc._id), doc])
  );

  return items.map((item) => {
    const inv = inventoryMap.get(item.item_id);
    const wholesale     = inv?.wholesale_price_per_sheet ?? 0;
    const productionCost = inv?.production_cost_per_sheet ?? 0;
    const discount       = item.discount_amount ?? 0;
    const finalPerSheet  = Math.max(0, wholesale - discount);
    return {
      item_id:                   item.item_id,
      sheets_sold:               item.sheets_sold,
      wholesale_price_per_sheet: wholesale,
      discount_amount:           discount,
      final_price:               finalPerSheet * item.sheets_sold,
      profit:                    (finalPerSheet - productionCost) * item.sheets_sold,
      item_name:                 inv?.item_name  ?? item.item_name  ?? '',
      hindi_name:                inv?.hindi_name ?? item.hindi_name ?? '',
      description:               inv?.description ?? item.description ?? '',
    };
  });
}

/**
 * POST /sale — Create a new sale. Auto-creates/updates Shop record.
 * Uses MongoDB $inc to atomically decrement stock (Golden Rule: never overwrite).
 */
router.post('/', async (req: Request, res: Response) => {
  const { customer_name, shop_name, shop_mobile, items, payment_mode, delivery_boy_id } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items are required.' });
  }

  try {
    // Marketing Logic: auto-create or update Shop record if mobile provided
    let shop_id = null;
    if (shop_mobile) {
      const shop = await ShopModel.findOneAndUpdate(
        { mobile: shop_mobile },
        {
          $setOnInsert: { name: shop_name || shop_mobile, mobile: shop_mobile },
          $inc: { total_orders_count: 1 },
        },
        { upsert: true, new: true }
      );
      shop_id = shop._id;
    }

    const saleItems = await buildSaleItems(items);

    // Decrement total_stock (item permanently sold) AND reserved_stock
    // (item is no longer "in field" — reservation is consumed by the sale).
    await Promise.all(
      items.map((item: { item_id: string; sheets_sold: number }) =>
        InventoryModel.findByIdAndUpdate(item.item_id, {
          $inc: { total_stock: -item.sheets_sold, reserved_stock: -item.sheets_sold },
        })
      )
    );

    // Compute totals server-side from enriched sale items
    const total_amount   = saleItems.reduce((sum, i) => sum + i.final_price, 0);
    const total_discount = saleItems.reduce((sum, i) => sum + i.discount_amount * i.sheets_sold, 0);
    const total_profit   = saleItems.reduce((sum, i) => sum + i.profit, 0);

    const sale = await SaleModel.create({
      customer_name,
      shop_name: shop_name || customer_name || '',
      shop_id,
      items: saleItems,
      total_amount,
      total_discount,
      total_profit,
      payment_mode: payment_mode || 'cash',
      delivery_boy_id,
    });

    return res.status(201).json(sale);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** GET /sale/today/:deliveryBoyId?date=YYYY-MM-DD — Today's sales for daily report. */
router.get('/today/:deliveryBoyId', async (req: Request, res: Response) => {
  try {
    const dateParam = req.query['date'] as string | undefined;
    const day = dateParam ? new Date(dateParam) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end   = new Date(day); end.setHours(23, 59, 59, 999);

    const sales = await SaleModel.find({
      delivery_boy_id: req.params.deliveryBoyId,
      timestamp: { $gte: start, $lte: end },
    }).sort({ timestamp: -1 });
    return res.json(sales);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** GET /sale/history/:deliveryBoyId — Full sales history. */
router.get('/history/:deliveryBoyId', async (req: Request, res: Response) => {
  try {
    const sales = await SaleModel.find({
      delivery_boy_id: req.params.deliveryBoyId,
    }).sort({ timestamp: -1 });
    return res.json(sales);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** POST /sale/bulk — Atomic bulk insert from Admin Bulk Entry spreadsheet UI. */
router.post('/bulk', async (req: Request, res: Response) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'Rows are required.' });
  }

  try {
    const normalizedRows = rows.map((row: Record<string, unknown>) => {
      const itemId        = String(row['item'] ?? row['itemId'] ?? row['item_id'] ?? '');
      const sheets_sold   = Number(row['sheets_sold'] ?? row['quantity'] ?? 0);
      const discount_amount = Number(row['discount_amount'] ?? 0);

      return {
        shopName: String(row['shopName'] ?? ''),
        shopMobile: String(row['shopMobile'] ?? ''),
        itemId,
        sheets_sold,
        discount_amount,
        itemName: String(row['itemName'] ?? ''),
        hindiName: String(row['hindiName'] ?? ''),
        description: String(row['description'] ?? ''),
      };
    });

    const inventoryDocs = await InventoryModel.find({
      _id: { $in: normalizedRows.map((row) => row.itemId) },
    }).lean();
    const inventoryMap = new Map(inventoryDocs.map((doc) => [String(doc._id), doc]));

    // Upsert shops for any rows that include a mobile number
    await Promise.all(
      normalizedRows
        .filter((row) => row.shopMobile)
        .map((row) =>
          ShopModel.findOneAndUpdate(
            { mobile: row.shopMobile },
            {
              $setOnInsert: { name: row.shopName || row.shopMobile, mobile: row.shopMobile },
              $inc: { total_orders_count: 1 },
            },
            { upsert: true, new: true }
          )
        )
    );

    const sales = await SaleModel.insertMany(
      normalizedRows.map((row) => {
        const inv             = inventoryMap.get(row.itemId);
        const wholesale       = inv?.wholesale_price_per_sheet ?? 0;
        const productionCost  = inv?.production_cost_per_sheet ?? 0;
        const discount        = row.discount_amount;
        const finalPerSheet   = Math.max(0, wholesale - discount);
        const final_price     = finalPerSheet * row.sheets_sold;
        const profit          = (finalPerSheet - productionCost) * row.sheets_sold;
        return {
          delivery_boy_id: null, // admin bulk entry — no delivery boy
          customer_name: row.shopName,
          shop_name: row.shopName,
          items: [
            {
              item_id:                   row.itemId,
              sheets_sold:               row.sheets_sold,
              wholesale_price_per_sheet: wholesale,
              discount_amount:           discount,
              final_price,
              profit,
              item_name:   inv?.item_name  ?? row.itemName  ?? '',
              hindi_name:  inv?.hindi_name ?? row.hindiName ?? '',
              description: inv?.description ?? row.description ?? '',
            },
          ],
          total_amount:   final_price,
          total_discount: discount * row.sheets_sold,
          total_profit:   profit,
          payment_mode: 'cash',
        };
      })
    );

    // Admin bulk entry: no delivery boy assignment, so no reserved_stock was incremented.
    // Only decrement total_stock.
    await Promise.all(
      normalizedRows.map((row) =>
        InventoryModel.findByIdAndUpdate(
          row.itemId,
          { $inc: { total_stock: -row.sheets_sold } }
        )
      )
    );

    return res.status(201).json({ inserted: sales.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
