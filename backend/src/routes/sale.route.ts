import { Router, Request, Response } from 'express';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';
import { ShopModel } from '../models/shop.model';

const router = Router();

/**
 * POST /sale — Create a new sale. Auto-creates/updates Shop record.
 * Uses MongoDB $inc to atomically decrement stock (Golden Rule: never overwrite).
 */
router.post('/', async (req: Request, res: Response) => {
  const { customer_name, shop_name, shop_mobile, items, total_amount, payment_mode, delivery_boy_id } =
    req.body;

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

    // Atomically decrement stock for each item sold.
    await Promise.all(
      items.map((item: { item_id: string; qty: number }) =>
        InventoryModel.findByIdAndUpdate(item.item_id, {
          $inc: { total_stock: -item.qty },
        })
      )
    );

    const sale = await SaleModel.create({
      customer_name,
      shop_name: shop_name || customer_name || '',
      shop_id,
      items,
      total_amount,
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
    const sales = await SaleModel.insertMany(
      rows.map((row: Record<string, unknown>) => ({
        customer_name: row['shopName'],
        items: [
          {
            item_id: row['item'],
            qty: row['quantity'],
            subtotal: Number(row['quantity']) * Number(row['price']),
          },
        ],
        total_amount: Number(row['quantity']) * Number(row['price']),
        payment_mode: 'cash',
      }))
    );

    // Atomically update stock for each row.
    await Promise.all(
      rows.map((row: Record<string, unknown>) =>
        InventoryModel.findOneAndUpdate(
          { item_name: row['item'] },
          { $inc: { total_stock: -Number(row['quantity']) } }
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
