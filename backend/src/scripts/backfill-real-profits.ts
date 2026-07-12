/**
 * backfill-real-profits.ts  (one-off, idempotent)
 *
 * Recomputes profit on ALL historical sales using the real-profit model
 * (utils/profit.util.ts) now that inventory carries cost_per_sheet /
 * flat_profit_per_pouch (run seed-real-costs.ts FIRST).
 *
 * Rules per sale line:
 *   - item has flat/cost data → profit = computeProfit(final_price, sheets, inv)
 *   - item not costed        → stored profit left untouched (no churn)
 * total_profit is re-summed per sale either way.
 *
 * Prints old vs new grand totals. Safe to re-run.
 *
 * Run:  npx ts-node src/scripts/backfill-real-profits.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';
import { computeProfit } from '../utils/profit.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const inv = await InventoryModel.find({}).lean();
  const invMap = new Map(inv.map((d: any) => [String(d._id), d]));

  const sales = await SaleModel.find({});
  let oldTotal = 0;
  let newTotal = 0;
  let salesChanged = 0;
  let linesRecomputed = 0;
  let linesSkipped = 0;

  for (const sale of sales) {
    const oldProfit = (sale as any).total_profit ?? 0;
    oldTotal += oldProfit;

    let saleProfit = 0;
    let changed = false;

    for (const item of sale.items as any[]) {
      const invDoc: any = invMap.get(String(item.item_id));
      const hasRealCost = ((invDoc?.flat_profit_per_pouch ?? 0) > 0) || ((invDoc?.cost_per_sheet ?? 0) > 0);
      if (hasRealCost) {
        const newProfit = computeProfit(item.final_price ?? 0, item.sheets_sold ?? 0, invDoc);
        if (Math.abs(newProfit - (item.profit ?? 0)) > 0.001) {
          item.profit = newProfit;
          changed = true;
        }
        linesRecomputed++;
      } else {
        linesSkipped++;
      }
      saleProfit += item.profit ?? 0;
    }

    if (Math.abs(saleProfit - oldProfit) > 0.001) changed = true;
    if (changed) {
      (sale as any).total_profit = saleProfit;
      sale.markModified('items');
      await sale.save();
      salesChanged++;
    }
    newTotal += saleProfit;
  }

  console.log(`Sales scanned:     ${sales.length}  (${salesChanged} updated)`);
  console.log(`Lines recomputed:  ${linesRecomputed}  |  left as-is (uncosted): ${linesSkipped}`);
  console.log(`\nGrand total profit:  ₹${oldTotal.toFixed(2)}  →  ₹${newTotal.toFixed(2)}`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
