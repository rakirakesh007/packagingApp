import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { LoadingModel } from '../models/loading.model';
import { InventoryModel } from '../models/inventory.model'; // still needed to denormalize item_name/unit_price at load time
import { ReturnModel } from '../models/return.model';
import { requireAdmin, requireSelfOrAdmin } from '../middleware/auth.middleware';
import { computeHoldings } from '../utils/holdings.util';

const router = Router();

type LoadingItemPayload = {
  item_id: string;
  qty: number;
  item_name: string;
  hindi_name: string;
  wholesale_price_per_sheet: number;
  variant_name: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function dayBounds(dateParam?: string): { start: Date; end: Date } {
  const base  = dateParam ? new Date(dateParam) : new Date();
  const inIST = new Date(base.getTime() + IST_OFFSET_MS);
  const y = inIST.getUTCFullYear(), m = inIST.getUTCMonth(), d = inIST.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d,  0,  0,  0,   0) - IST_OFFSET_MS),
    end:   new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS),
  };
}

/**
 * POST /assignment
 * Creates a new Loading document or appends to the existing one for the
 * same delivery boy + date.
 *
 * Stock model:
 *   Assignment records what's loaded onto a delivery boy (the Loading doc) and
 *   touches inventory NOT AT ALL — there is no stock guard and no reservation.
 *   What a boy still holds is derived on read via computeHoldings
 *   (assigned − sold − returned). total_stock only moves when a sale is recorded.
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { delivery_boy_id, items, date } = req.body as {
    delivery_boy_id: string;
    items: { item_id: string; qty: number; item_name?: string; hindi_name?: string; wholesale_price_per_sheet?: number; variant_name?: string }[];
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
          variant_name: (inv as any)?.variant_name ?? item.variant_name ?? '',
        });
        return acc;
      },
      new Map(),
    );

    const normalizedItems = Array.from(requestedItems.values());

    // Persist the loading only — inventory is not touched at assignment.
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
            variant_name:              String(item.variant_name ?? ''),
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
          current.variant_name = incoming.variant_name || current.variant_name;
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
 * Logs a Return row so the boy's holdings (assigned − sold − returned) reflect it.
 * Inventory is not touched. Cannot return more than the boy currently holds (withBoy).
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

    // Log the returns so the running balance (computeHoldings) reflects them.
    await ReturnModel.create(
      items.map((i) => ({ delivery_boy_id, item_id: i.item_id, qty: i.qty })),
    );

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
