/**
 * fix-50g-label-and-assign.ts  (one-off)
 *
 * 1. Sets variant_name = "50g" on the 4 new 50g packet items so every screen
 *    (assignment, cart, holdings, reports) labels them distinctly instead of "—".
 * 2. Assigns Coriander 50g + Cumin 50g (qty 1 each) to Vishal via a Loading doc
 *    — these two never saved through the UI (look-alike rows). Chilli 50g and
 *    Turmeric 50g are already assigned, so they are NOT re-assigned here.
 *
 * Run:  npx ts-node src/scripts/fix-50g-label-and-assign.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
import { LoadingModel } from '../models/loading.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';

const FIFTY_G_IDS = [
  '6a5129cfb85ce414db3f4b60', // Chilli 50g
  '6a5129cfb85ce414db3f4b61', // Turmeric 50g
  '6a5129cfb85ce414db3f4b62', // Coriander 50g
  '6a5129cfb85ce414db3f4b63', // Cumin 50g
];

// Items to assign now (the two that never saved). [id, qty]
const ASSIGN: Array<[string, number]> = [
  ['6a5129cfb85ce414db3f4b62', 1], // Coriander 50g
  ['6a5129cfb85ce414db3f4b63', 1], // Cumin 50g
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  // ── 1. Label all 4 as "50g" ──────────────────────────────────────────────
  const labelRes = await InventoryModel.updateMany(
    { _id: { $in: FIFTY_G_IDS } },
    { $set: { variant_name: '50g' } }
  );
  console.log(`Labelled variant_name="50g" on ${labelRes.modifiedCount} items.`);

  // ── 2. Assign the 2 missing ones to Vishal (denormalized fields from Inventory) ─
  const invDocs = await InventoryModel.find({ _id: { $in: ASSIGN.map((a) => a[0]) } }).lean();
  const invMap = new Map(invDocs.map((d: any) => [String(d._id), d]));

  const items = ASSIGN.map(([id, qty]) => {
    const inv: any = invMap.get(id);
    if (!inv) throw new Error(`Inventory item not found: ${id}`);
    return {
      item_id: new mongoose.Types.ObjectId(id),
      qty,
      item_name: inv.item_name ?? '',
      hindi_name: inv.hindi_name ?? '',
      wholesale_price_per_sheet: inv.wholesale_price_per_sheet ?? 0,
      variant_name: '50g',
    };
  });

  const [loading] = await LoadingModel.create([
    { delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID), items, date: new Date() },
  ]);

  console.log(`\nCreated Loading ${loading._id} for Vishal:`);
  items.forEach((it) => console.log(`  ${it.item_name} 50g  qty ${it.qty}  (sell ₹${it.wholesale_price_per_sheet}/pouch)`));

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
