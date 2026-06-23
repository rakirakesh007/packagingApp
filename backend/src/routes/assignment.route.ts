import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { LoadingModel } from '../models/loading.model';
import { InventoryModel } from '../models/inventory.model'; // still needed to denormalize item_name/unit_price at load time
import { SaleModel } from '../models/sale.model';
import { ReturnModel } from '../models/return.model';
import { requireAdmin, requireSelfOrAdmin } from '../middleware/auth.middleware';

const router = Router();

type Holding = {
  item_id: string;
  item_name: string;
  hindi_name: string;
  units_per_sheet: number;
  assigned: number;
  sold: number;
  returned: number;
  withBoy: number;
};

/**
 * Running balance of everything a delivery boy still physically holds, across all days:
 *   withBoy = Σ assigned (Loading) − Σ sold (Sale) − Σ returned (Return)
 */
async function computeHoldings(deliveryBoyId: string): Promise<Holding[]> {
  const [loadings, sales, returns] = await Promise.all([
    LoadingModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
    SaleModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
    ReturnModel.find({ delivery_boy_id: deliveryBoyId }).lean(),
  ]);

  const map = new Map<string, Holding>();
  const ensure = (id: string): Holding => {
    let h = map.get(id);
    if (!h) {
      h = { item_id: id, item_name: '', hindi_name: '', units_per_sheet: 1, assigned: 0, sold: 0, returned: 0, withBoy: 0 };
      map.set(id, h);
    }
    return h;
  };

  for (const l of loadings) {
    for (const it of (l.items as any[])) {
      const h = ensure(String(it.item_id));
      h.assigned += Number(it.qty) || 0;
      if (it.item_name)  h.item_name  = String(it.item_name);
      if (it.hindi_name) h.hindi_name = String(it.hindi_name);
    }
  }
  for (const s of sales) {
    for (const it of (s.items as any[])) {
      ensure(String(it.item_id)).sold += Number(it.sheets_sold) || 0;
    }
  }
  for (const r of returns) {
    ensure(String(r.item_id)).returned += Number(r.qty) || 0;
  }

  // Attach units_per_sheet (+ names fallback) from inventory.
  const ids = [...map.keys()];
  if (ids.length) {
    const invDocs = await InventoryModel.find(
      { _id: { $in: ids } },
      { units_per_sheet: 1, item_name: 1, hindi_name: 1 }
    ).lean();
    for (const inv of invDocs) {
      const h = map.get(String(inv._id));
      if (!h) continue;
      h.units_per_sheet = (inv as any).units_per_sheet ?? 1;
      if (!h.item_name)  h.item_name  = (inv as any).item_name  ?? '';
      if (!h.hindi_name) h.hindi_name = (inv as any).hindi_name ?? '';
    }
  }

  return [...map.values()]
    .map((h) => ({ ...h, withBoy: h.assigned - h.sold - h.returned }))
    .filter((h) => h.withBoy > 0.0001)
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

type LoadingItemPayload = {
  item_id: string;
  qty: number;
  item_name: string;
  hindi_name: string;
  wholesale_price_per_sheet: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dayBounds(dateParam?: string): { start: Date; end: Date } {
  const day = dateParam ? new Date(dateParam) : new Date();
  const start = new Date(day); start.setHours(0,  0,  0,   0);
  const end   = new Date(day); end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * POST /assignment
 * Creates a new Loading document or appends to the existing one for the
 * same delivery boy + date.
 *
 * Stock model (Option A + reserved_stock):
 *   - total_stock  : never touched here — only decremented when a sale is recorded.
 *   - reserved_stock: incremented here so the admin sees correct "available" stock
 *                     (available = total_stock − reserved_stock).
 *   On return  → reserved_stock decremented  (POST /assignment/return)
 *   On sale    → total_stock  AND reserved_stock both decremented
 *   This prevents double-deduction and over-assignment of the same stock.
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { delivery_boy_id, items, date } = req.body as {
    delivery_boy_id: string;
    items: { item_id: string; qty: number; item_name?: string; hindi_name?: string; wholesale_price_per_sheet?: number }[];
    date?: string;
  };

  if (!delivery_boy_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'delivery_boy_id and items are required.' });
  }

  const { start, end } = dayBounds(date);

  // Same day + same delivery boy is now additive instead of blocked.
  const existing = await LoadingModel.findOne({
    delivery_boy_id,
    date: { $gte: start, $lte: end },
  });

  // Validate all item_ids are valid ObjectIds up-front
  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.item_id)) {
      return res.status(400).json({ message: `Invalid item_id: ${item.item_id}` });
    }
  }

  try {
    // Step 1: Fetch inventory to denormalize item_name, hindi_name & unit_price
    const inventoryDocs = await InventoryModel.find({
      _id: { $in: items.map((i) => i.item_id) },
    }).lean();
    const invMap = new Map(
      inventoryDocs.map((doc) => [String(doc._id), doc])
    );

    const requestedItems = items.reduce<Map<string, LoadingItemPayload>>(
      (acc, item) => {
        const current = acc.get(item.item_id);
        const inv = invMap.get(item.item_id);
        const nextQty = (current?.qty ?? 0) + item.qty;
        acc.set(item.item_id, {
          item_id: item.item_id,
          qty: nextQty,
          item_name: inv?.item_name ?? item.item_name ?? '',
          hindi_name: inv?.hindi_name ?? item.hindi_name ?? '',
          wholesale_price_per_sheet: item.wholesale_price_per_sheet || inv?.wholesale_price_per_sheet || 0,
        });
        return acc;
      },
      new Map(),
    );

    const normalizedItems = Array.from(requestedItems.values());

    if (existing) {
      // Explicitly convert each Mongoose subdocument field to a plain value.
      // Spreading Mongoose subdocs (which use defineProperty internally) can lose values.
      const currentItems = new Map<string, LoadingItemPayload>(
        (existing.items as any[]).map((item) => [
          String(item.item_id),
          {
            item_id:                   String(item.item_id),
            qty:                       Number(item.qty),
            item_name:                 String(item.item_name  ?? ''),
            hindi_name:                String(item.hindi_name ?? ''),
            wholesale_price_per_sheet: Number(item.wholesale_price_per_sheet ?? 0),
          },
        ])
      );

      for (const incoming of normalizedItems) {
        const current = currentItems.get(incoming.item_id);
        if (current) {
          current.qty += incoming.qty;
          current.item_name = incoming.item_name || current.item_name;
          current.hindi_name = incoming.hindi_name || current.hindi_name;
          current.wholesale_price_per_sheet = incoming.wholesale_price_per_sheet || current.wholesale_price_per_sheet;
          currentItems.set(incoming.item_id, current);
        } else {
          currentItems.set(incoming.item_id, incoming);
        }
      }

      existing.set('items', Array.from(currentItems.values()));
      existing.date = date ? new Date(date) : existing.date;
      await existing.save();
    } else {
      await LoadingModel.create({
        delivery_boy_id,
        date: date ? new Date(date) : new Date(),
        items: normalizedItems,
      });
    }

    // Increment reserved_stock so admin sees correct available stock (total_stock − reserved_stock).
    // total_stock is NOT touched — it only moves when a sale is recorded.
    await InventoryModel.bulkWrite(
      normalizedItems.map((i) => ({
        updateOne: {
          filter: { _id: i.item_id },
          update: { $inc: { reserved_stock: i.qty } },
        },
      }))
    );

    const assignment = existing
      ? await LoadingModel.findOne({
          delivery_boy_id,
          date: { $gte: start, $lte: end },
        }).lean()
      : await LoadingModel.findOne({
          delivery_boy_id,
          date: { $gte: start, $lte: end },
        }).lean();

    return res.status(existing ? 200 : 201).json(assignment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /assignment/holdings/:deliveryBoyId
 * Running balance of what the boy still holds (across all days). See computeHoldings().
 */
router.get('/holdings/:deliveryBoyId', requireSelfOrAdmin('deliveryBoyId'), async (req: Request, res: Response) => {
  try {
    const boyId = String(req.params.deliveryBoyId);
    if (!mongoose.Types.ObjectId.isValid(boyId)) {
      return res.status(400).json({ message: 'Invalid delivery_boy_id.' });
    }
    const holdings = await computeHoldings(boyId);
    return res.json(holdings);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /assignment/return
 * Called when a delivery boy returns unsold items to the warehouse.
 * Logs a Return row + decrements reserved_stock. total_stock is unchanged (never deducted at assignment).
 * Cannot return more than the boy currently holds (withBoy).
 *
 * Body: { delivery_boy_id, items: [{ item_id, qty }] }
 */
router.post('/return', requireAdmin, async (req: Request, res: Response) => {
  const { delivery_boy_id, items } = req.body as {
    delivery_boy_id: string;
    items: { item_id: string; qty: number }[];
  };

  if (!delivery_boy_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'delivery_boy_id and items are required.' });
  }

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.item_id)) {
      return res.status(400).json({ message: `Invalid item_id: ${item.item_id}` });
    }
    if (!(Number(item.qty) > 0)) {
      return res.status(400).json({ message: `qty must be positive for item_id: ${item.item_id}` });
    }
  }

  try {
    // Validate against the current running balance — can't return more than held.
    const holdings = await computeHoldings(delivery_boy_id);
    const heldMap = new Map(holdings.map((h) => [h.item_id, h.withBoy]));
    for (const item of items) {
      const held = heldMap.get(item.item_id) ?? 0;
      if (item.qty > held + 0.0001) {
        return res.status(400).json({ message: `Cannot return ${item.qty}; boy holds only ${held}.` });
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Release reservation — item is physically back in the warehouse.
        await InventoryModel.bulkWrite(
          items.map((i) => ({
            updateOne: {
              filter: { _id: i.item_id, reserved_stock: { $gte: i.qty } },
              update: { $inc: { reserved_stock: -i.qty } },
            },
          })),
          { session }
        );
        // Log the returns so the running balance reflects them.
        await ReturnModel.create(
          items.map((i) => ({ delivery_boy_id, item_id: i.item_id, qty: i.qty })),
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const updated = await computeHoldings(delivery_boy_id);
    return res.status(200).json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /assignment/active/:deliveryBoyId
 * Returns today's assignment (no populate needed — fields are denormalized).
 */
router.get('/active/:deliveryBoyId', requireSelfOrAdmin('deliveryBoyId'), async (req: Request, res: Response) => {
  try {
    const { start, end } = dayBounds();
    const assignment = await LoadingModel.findOne({
      delivery_boy_id: req.params.deliveryBoyId,
      date: { $gte: start, $lte: end },
    }).lean();

    if (!assignment) {
      return res.status(404).json({ message: 'No active assignment found for today.' });
    }
    return res.json(assignment);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /assignment/date/:deliveryBoyId?date=YYYY-MM-DD
 * Returns the assignment for any given date (used by delivery boy cart).
 */
router.get('/date/:deliveryBoyId', requireSelfOrAdmin('deliveryBoyId'), async (req: Request, res: Response) => {
  try {
    const { start, end } = dayBounds(req.query['date'] as string | undefined);
    const assignment = await LoadingModel.findOne({
      delivery_boy_id: req.params.deliveryBoyId,
      date: { $gte: start, $lte: end },
    }).lean();

    if (!assignment) {
      return res.status(404).json({ message: 'No assignment found for this date.' });
    }
    return res.json(assignment);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
