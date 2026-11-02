import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';
import { ShopModel } from '../models/shop.model';
import { requireAdmin, requireSelfOrAdmin } from '../middleware/auth.middleware';
import { computeProfit } from '../utils/profit.util';
import { computePackCost } from '../utils/pack-cost.util';

const router = Router();

async function buildSaleItems(
  items: Array<{ item_id: string; sheets_sold: number; selling_price_per_sheet?: number; item_name?: string; hindi_name?: string; description?: string }>,
): Promise<Array<{ item_id: string; sheets_sold: number; wholesale_price_per_sheet: number; selling_price_per_sheet: number; final_price: number; profit: number; item_name: string; hindi_name: string; description: string }>> {
  const inventoryDocs = await InventoryModel.find({ _id: { $in: items.map((item) => item.item_id) } }).lean();
  const inventoryMap = new Map<string, { item_name?: string; hindi_name?: string; description?: string; wholesale_price_per_sheet?: number; units_per_sheet?: number; cost_per_sheet?: number; flat_profit_per_pouch?: number }>(
    inventoryDocs.map((doc) => [String(doc._id), doc])
  );

  return items.map((item) => {
    const inv = inventoryMap.get(item.item_id);
    const wholesale = inv?.wholesale_price_per_sheet ?? 0; // per-packet wholesale
    const units     = Math.max(1, inv?.units_per_sheet ?? 1);
    // Editable negotiated price; defaults to per-sheet wholesale (per-packet × units,
    // rounded to a clean integer) when not provided.
    const sellingPerSheet = Math.max(0, item.selling_price_per_sheet ?? Math.round(wholesale * units));
    const finalPrice      = sellingPerSheet * item.sheets_sold;
    return {
      item_id:                   item.item_id,
      sheets_sold:               item.sheets_sold,
      wholesale_price_per_sheet: wholesale,
      selling_price_per_sheet:   sellingPerSheet,
      final_price:               finalPrice,
      // Real profit: flat ₹/pouch > real cost/sheet > legacy 10% fallback.
      profit:                    computeProfit(finalPrice, item.sheets_sold, inv),
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

    // Compute totals server-side from enriched sale items
    const total_amount = saleItems.reduce((sum, i) => sum + i.final_price, 0);
    const total_profit = saleItems.reduce((sum, i) => sum + i.profit, 0);

    // Decrement stock AND create the sale atomically (Golden Rule #1: never
    // overwrite stock). total_stock is informational — the sale is never blocked
    // on stock, so it may go negative on an oversell.
    const session = await mongoose.startSession();
    let sale;
    try {
      await session.withTransaction(async () => {
        for (const item of items as { item_id: string; sheets_sold: number }[]) {
          await InventoryModel.findByIdAndUpdate(
            item.item_id,
            { $inc: { total_stock: -item.sheets_sold } },
            { session }
          );
        }

        const [created] = await SaleModel.create(
          [
            {
              customer_name,
              shop_name: shop_name || customer_name || '',
              shop_id,
              items: saleItems,
              total_amount,
              total_profit,
              payment_mode: payment_mode || 'cash',
              delivery_boy_id,
            },
          ],
          { session }
        );
        sale = created;
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json(sale);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** GET /sale/today/:deliveryBoyId?date=YYYY-MM-DD — Today's sales for daily report. */
router.get('/today/:deliveryBoyId', requireSelfOrAdmin('deliveryBoyId'), async (req: Request, res: Response) => {
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
router.get('/history/:deliveryBoyId', requireSelfOrAdmin('deliveryBoyId'), async (req: Request, res: Response) => {
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

/** POST /sale/bulk — Atomic bulk insert from Admin Bulk Entry spreadsheet UI (admin only). */
router.post('/bulk', requireAdmin, async (req: Request, res: Response) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'Rows are required.' });
  }

  try {
    // ── Normalise incoming rows ──────────────────────────────────────────────
    const normalizedRows = rows.map((row: Record<string, unknown>) => {
      const itemId       = String(row['item'] ?? row['itemId'] ?? row['item_id'] ?? '');
      const saleType     = String(row['sale_type'] ?? 'wholesale') as 'wholesale' | 'retail';
      const unitType     = String(row['unit_type'] ?? 'sheet') as 'sheet' | 'packet';
      const quantitySold = Number(row['quantity_sold'] ?? row['sheets_sold'] ?? row['quantity'] ?? 0);
      // Editable negotiated price: per-sheet for wholesale, per-packet for retail. 0 ⇒ fall back to default.
      const sellingPrice = Number(row['selling_price'] ?? 0);
      // Optional pack overrides (distributor deals packed to a non-standard weight).
      // All 0/absent on an ordinary row ⇒ nothing below changes behaviour.
      const packGrams    = Number(row['grams_per_unit'] ?? 0);
      const packRate     = Number(row['rate_per_kg'] ?? 0);
      const packCostRow  = Number(row['cost_per_sheet'] ?? 0);
      return {
        shopName:      String(row['shopName'] ?? ''),
        shopMobile:    String(row['shopMobile'] ?? ''),
        itemId,
        saleType,
        unitType,
        quantitySold,
        sellingPrice,
        packGrams,
        packRate,
        packCostRow,
        itemName:    String(row['itemName'] ?? ''),
        hindiName:   String(row['hindiName'] ?? ''),
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

    // ── Build sale documents ─────────────────────────────────────────────────
    const saleDocuments = normalizedRows.map((row) => {
      const inv          = inventoryMap.get(row.itemId);
      const wholesale    = inv?.wholesale_price_per_sheet ?? 0;
      const unitsPerSheet = Math.max(1, inv?.units_per_sheet ?? 10);
      const mrpPerUnit   = inv?.mrp_per_unit ?? 0;

      let sheetsSold: number;
      let packetsSold: number | null;
      let finalPrice: number;
      let profit: number;
      let sellingPerSheet: number;

      // Real cost data present ⇒ computeProfit (flat ₹/pouch > cost/sheet).
      const hasRealCost = ((inv as any)?.flat_profit_per_pouch ?? 0) > 0 || ((inv as any)?.cost_per_sheet ?? 0) > 0;

      // ── Pack override (distributor deals) ──────────────────────────────────
      // A row may be packed to a non-standard weight, so its cost is derived for
      // this line only. Resolution order:
      //   1. an explicit cost typed on the row (escape hatch when the item has no
      //      stored packing/labour, which would otherwise understate cost)
      //   2. derived from grams + rate on the row
      //   3. none — behave exactly as before
      // The item document is NEVER updated from these; a distributor deal must not
      // change the retail pack size, the storefront price, or anyone's labels.
      const packGrams = row.packGrams > 0 ? row.packGrams : 0;
      const packRate  = row.packRate  > 0 ? row.packRate  : 0;
      const derivedCost = computePackCost({
        grams: packGrams,
        rate_per_kg: packRate,
        units_per_sheet: unitsPerSheet,
        labour_cost_per_sheet:   (inv as any)?.labour_cost_per_sheet,
        packing_cost_per_sheet:  (inv as any)?.packing_cost_per_sheet,
        delivery_cost_per_sheet: (inv as any)?.delivery_cost_per_sheet,
      });
      const overrideCost = row.packCostRow > 0 ? row.packCostRow : derivedCost;

      if (row.saleType === 'retail') {
        // Retail: quantity is in individual packets; price is per packet (defaults to MRP).
        packetsSold  = row.quantitySold;
        sheetsSold   = packetsSold / unitsPerSheet;           // fractional sheets consumed
        const sellingPerUnit = Math.max(0, row.sellingPrice || mrpPerUnit);
        finalPrice       = sellingPerUnit * packetsSold;
        // Uncosted retail keeps its own legacy: selling − per-packet wholesale.
        profit = (hasRealCost || overrideCost > 0)
          ? computeProfit(finalPrice, sheetsSold, inv, overrideCost)
          : (sellingPerUnit - wholesale) * packetsSold;
        sellingPerSheet  = sellingPerUnit * unitsPerSheet;    // normalized per-sheet snapshot
      } else {
        // Wholesale: quantity is in sheets; price is per sheet (defaults to per-packet wholesale × units).
        sheetsSold  = row.quantitySold;
        packetsSold = null;
        sellingPerSheet = Math.max(0, row.sellingPrice || Math.round(wholesale * unitsPerSheet));
        finalPrice  = sellingPerSheet * sheetsSold;
        // computeProfit falls back to the legacy 10% formula when the item isn't costed.
        profit      = computeProfit(finalPrice, sheetsSold, inv, overrideCost);
      }

      // What this line was actually packed to, and the cost its profit came from.
      // Falls back to the item's standard values so every sale is auditable, not
      // just distributor ones.
      const gramsUsed = packGrams || ((inv as any)?.quantity_per_unit ?? 0) || null;
      const rateUsed  = packRate  || ((inv as any)?.rate_per_kg ?? 0) || null;
      const costUsed  = overrideCost || ((inv as any)?.cost_per_sheet ?? 0) || null;

      return {
        // ─ sale document ─
        delivery_boy_id: null,
        customer_name:   row.shopName,
        shop_name:       row.shopName,
        items: [
          {
            item_id:                   row.itemId,
            sale_type:                 row.saleType,
            sheets_sold:               sheetsSold,
            packets_sold:              packetsSold,
            wholesale_price_per_sheet: wholesale,
            selling_price_per_sheet:   sellingPerSheet,
            final_price:               finalPrice,
            profit,
            grams_per_unit:            gramsUsed,
            rate_per_kg_used:          rateUsed,
            cost_per_sheet_used:       costUsed,
            item_name:   inv?.item_name  ?? row.itemName  ?? '',
            hindi_name:  inv?.hindi_name ?? row.hindiName ?? '',
            description: inv?.description ?? row.description ?? '',
          },
        ],
        total_amount:   finalPrice,
        total_profit:   profit,
        payment_mode:   'cash',
        // ─ for stock deduction (keep alongside doc for the $inc loop below) ─
        _itemId:    row.itemId,
        _sheetsDelta: sheetsSold,
      };
    });

    // ── Insert sales + decrement stock atomically (Golden Rule #1) ──────────
    // total_stock is informational; the entry is never blocked on stock.
    const session = await mongoose.startSession();
    let insertedCount = 0;
    try {
      await session.withTransaction(async () => {
        const sales = await SaleModel.insertMany(
          // strip the internal _itemId/_sheetsDelta helpers before inserting
          saleDocuments.map(({ _itemId: _a, _sheetsDelta: _b, ...doc }) => doc),
          { session }
        );
        insertedCount = sales.length;

        for (const { _itemId, _sheetsDelta } of saleDocuments) {
          // Decrement total_stock by sheets consumed (fractional for retail)
          await InventoryModel.findByIdAndUpdate(
            _itemId,
            { $inc: { total_stock: -_sheetsDelta } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json({ inserted: insertedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
