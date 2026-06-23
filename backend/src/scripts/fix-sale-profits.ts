/**
 * fix-sale-profits.ts
 * One-time migration: recompute wholesale profit as 10% of per-sheet WHOLESALE cost
 * (previously incorrectly stored as 10% of selling price).
 *
 * Retail items are untouched — their profit = (selling - wholesale) × packets is correct.
 *
 * Usage: npx ts-node src/scripts/fix-sale-profits.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';

dotenv.config();

async function main() {
  const uri = process.env['MONGODB_URI'] || process.env['MONGO_URI'] || '';
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Build item_id → units_per_sheet map from current inventory.
  // Fallback to 1 if an item was deleted after the sale.
  const invDocs = await InventoryModel.find({}, { units_per_sheet: 1 }).lean();
  const unitsMap = new Map<string, number>(
    invDocs.map((d) => [String(d._id), (d as any).units_per_sheet ?? 1])
  );

  const allSales = await SaleModel.find({}).lean();
  console.log(`Found ${allSales.length} sale document(s) to process.`);

  let updatedCount = 0;
  const bulkOps: Parameters<typeof SaleModel.bulkWrite>[0] = [];

  for (const sale of allSales) {
    let changed = false;
    let totalProfit = 0;

    const updatedItems = (sale.items as any[]).map((item: any) => {
      // Retail profit formula is already correct — skip.
      if (item.sale_type === 'retail') {
        totalProfit += item.profit ?? 0;
        return item;
      }

      // Wholesale (or undefined sale_type from delivery boy route — always wholesale).
      const units         = unitsMap.get(String(item.item_id)) ?? 1;
      const wholesale     = item.wholesale_price_per_sheet ?? 0; // per-packet cost snapshot
      const sheets        = item.sheets_sold ?? 0;
      const correctProfit = wholesale * units * 0.10 * sheets;

      if (Math.abs((item.profit ?? 0) - correctProfit) > 0.001) {
        changed = true;
        totalProfit += correctProfit;
        return { ...item, profit: correctProfit };
      }

      totalProfit += item.profit ?? 0;
      return item;
    });

    if (changed) {
      bulkOps.push({
        updateOne: {
          filter: { _id: sale._id },
          update: { $set: { items: updatedItems, total_profit: totalProfit } },
        },
      });
      updatedCount++;
    }
  }

  if (bulkOps.length > 0) {
    await SaleModel.bulkWrite(bulkOps);
    console.log(`✅ Updated ${updatedCount} sale document(s) with corrected profit.`);
  } else {
    console.log('✅ No changes needed — all profit values already correct.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
