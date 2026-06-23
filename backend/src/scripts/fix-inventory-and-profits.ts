/**
 * fix-inventory-and-profits.ts  —  one-time migration
 *
 * 1. Delete all "Nigella seeds" entries (same item as Kalongi / मंगरैल).
 * 2. Set wholesale_price_per_sheet (per-packet cost) for every inventory item
 *    based on the true per-sheet cost: ₹45 for MRP-₹5, ₹90 for MRP-₹10.
 *    Formula: new_per_pkt = sheet_price / units_per_sheet
 * 3. Update existing Sale documents: re-snapshot wholesale price and
 *    recompute profit = new_per_pkt × units × 0.10 × sheets_sold.
 *
 * Usage: cd backend && npx ts-node src/scripts/fix-inventory-and-profits.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { InventoryModel } from '../models/inventory.model';
import { SaleModel } from '../models/sale.model';

dotenv.config();

const SHEET_PRICES: Record<number, number> = {
  5:  45,   // MRP ₹5  → ₹45 per sheet
  10: 90,   // MRP ₹10 → ₹90 per sheet
};

async function main() {
  const uri = process.env['MONGODB_URI'] || process.env['MONGO_URI'] || '';
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected.');

  // ── Step 1: Delete Nigella seeds duplicates ─────────────────────────────
  const deleted = await InventoryModel.deleteMany({ item_name: 'Nigella seeds' });
  console.log(`Deleted ${deleted.deletedCount} Nigella seeds doc(s). Kalongi (मंगरैल) kept.`);

  // ── Step 2: Update per-packet wholesale in Inventory ────────────────────
  const allItems = await InventoryModel.find({}).lean();
  const inventoryBulk: Parameters<typeof InventoryModel.bulkWrite>[0] = [];
  const wholesaleMap = new Map<string, { perPkt: number; units: number }>();

  for (const doc of allItems) {
    const sheetPrice = SHEET_PRICES[(doc as any).mrp_per_unit ?? 0];
    if (sheetPrice == null) {
      console.warn(`  Skipping ${(doc as any).item_name} — unknown MRP ${(doc as any).mrp_per_unit}`);
      continue;
    }
    const units  = Math.max(1, (doc as any).units_per_sheet ?? 1);
    const perPkt = sheetPrice / units;

    wholesaleMap.set(String(doc._id), { perPkt, units });
    inventoryBulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { wholesale_price_per_sheet: perPkt } },
      },
    });
    console.log(`  ${(doc as any).item_name}: MRP ₹${(doc as any).mrp_per_unit} → ₹${sheetPrice}/sheet ÷ ${units} units = ₹${perPkt.toFixed(4)}/pkt`);
  }

  if (inventoryBulk.length > 0) {
    await InventoryModel.bulkWrite(inventoryBulk);
    console.log(`Updated ${inventoryBulk.length} inventory doc(s).`);
  }

  // ── Step 3: Fix historical Sale documents ───────────────────────────────
  const allSales = await SaleModel.find({}).lean();
  console.log(`\nProcessing ${allSales.length} sale doc(s)...`);

  const saleBulk: Parameters<typeof SaleModel.bulkWrite>[0] = [];
  let saleUpdated = 0;

  for (const sale of allSales) {
    let changed = false;
    let totalProfit = 0;

    const updatedItems = ((sale as any).items as any[]).map((item: any) => {
      if (item.sale_type === 'retail') {
        totalProfit += item.profit ?? 0;
        return item;
      }

      const inv = wholesaleMap.get(String(item.item_id));
      if (!inv) {
        // Item deleted from inventory — keep existing profit
        totalProfit += item.profit ?? 0;
        return item;
      }

      const newProfit = inv.perPkt * inv.units * 0.10 * (item.sheets_sold ?? 0);

      if (
        Math.abs((item.wholesale_price_per_sheet ?? 0) - inv.perPkt) > 0.0001 ||
        Math.abs((item.profit ?? 0) - newProfit) > 0.0001
      ) {
        changed = true;
        totalProfit += newProfit;
        return { ...item, wholesale_price_per_sheet: inv.perPkt, profit: newProfit };
      }

      totalProfit += item.profit ?? 0;
      return item;
    });

    if (changed) {
      saleBulk.push({
        updateOne: {
          filter: { _id: (sale as any)._id },
          update: { $set: { items: updatedItems, total_profit: totalProfit } },
        },
      });
      saleUpdated++;
    }
  }

  if (saleBulk.length > 0) {
    await SaleModel.bulkWrite(saleBulk);
    console.log(`Updated ${saleUpdated} sale doc(s) with corrected wholesale price + profit.`);
  } else {
    console.log('No sale docs needed updating.');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
