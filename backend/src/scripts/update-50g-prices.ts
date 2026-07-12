/**
 * update-50g-prices.ts  (one-off)
 *
 * Reprices the 4 existing 50g packet variants to hit >=20% margin over cost.
 * Only mrp_per_unit and wholesale_price_per_sheet (sell) change; cost_per_sheet
 * and everything else stay. Matched by the _id returned when they were inserted.
 *
 * Run:  npx ts-node src/scripts/update-50g-prices.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

// [_id, label, new mrp, new sell]
const UPDATES: Array<[string, string, number, number]> = [
  ['6a5129cfb85ce414db3f4b60', 'Chilli Powder 50g',    27, 20],
  ['6a5129cfb85ce414db3f4b61', 'Turmeric Powder 50g',  23, 17],
  ['6a5129cfb85ce414db3f4b62', 'Coriander Powder 50g', 22, 16],
  ['6a5129cfb85ce414db3f4b63', 'Cumin Powder 50g',     30, 22],
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  for (const [id, label, mrp, sell] of UPDATES) {
    const before = await InventoryModel.findById(id).lean();
    if (!before) { console.log(`  SKIP (not found): ${label} ${id}`); continue; }
    const cost = (before as any).cost_per_sheet ?? 0;
    await InventoryModel.updateOne(
      { _id: id },
      { $set: { mrp_per_unit: mrp, wholesale_price_per_sheet: sell } }
    );
    const margin = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
    console.log(
      `  ${label.padEnd(22)} MRP ₹${(before as any).mrp_per_unit}→₹${mrp}  sell ₹${(before as any).wholesale_price_per_sheet}→₹${sell}  (cost ₹${cost}, margin ${margin.toFixed(1)}%)`
    );
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
