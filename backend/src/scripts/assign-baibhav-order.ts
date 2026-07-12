/**
 * assign-baibhav-order.ts  (one-off)
 *
 * Assigns the combined order (handwritten whole-spices + typed powder list) to
 * delivery boy Baibhav as a single Loading doc dated today. Overlapping items
 * are summed (Cumin ₹10 = 2+1 = 3; Black Pepper ₹10 = 1+3 = 4).
 * Denormalizes name/price/variant from Inventory (matches the app's flow).
 *
 * Run:  npx ts-node src/scripts/assign-baibhav-order.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
import { LoadingModel } from '../models/loading.model';
import { computeHoldings } from '../utils/holdings.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const BAIBHAV_ID = '6a27f13db8a9796c37ffd24b';

// [item_id, qty, label]
const LINES: Array<[string, number, string]> = [
  // ── Whole spices (handwritten Order) ──
  ['6a3e29b5263612b26e286520', 2, 'Carom Seeds ₹5 (Ajwain)'],
  ['6a36cbb1aed7a1b6d2942bec', 1, 'Carom Seeds ₹10'],
  ['6a3e29ca263612b26e286523', 2, 'Kalongi ₹5 (Mangrail)'],
  ['6a360d072afd8461199b899c', 1, 'Kalongi ₹10'],
  ['6a3d209eabd5f087e37b1a1f', 1, 'Cumin ₹5 (Jeera)'],
  ['6a36cbecaed7a1b6d2942bef', 3, 'Cumin ₹10 (2 order + 1 table)'],
  ['6a2aa692124739f1f9b2ad1d', 4, 'Garam Masala ₹5'],
  ['6a2b900925ed4ad84926aa46', 4, 'Garam Masala ₹10'],
  ['6a4b8f3aa8b45eb1a1b84174', 1, 'Cinnamon ₹5 (Dalchini)'],
  ['6a3e2a25263612b26e286536', 1, 'Panch Phoron ₹5'],
  ['6a4b5a083e1268899d83fac6', 1, 'Mustard ₹5 (Sarson)'],
  ['6a36cc47aed7a1b6d2942bf5', 2, 'Yellow Mustard ₹5 (Peeli Sarson)'],
  ['6a2b90aa25ed4ad84926aa4f', 1, 'Clove ₹10 (Long)'],
  ['6a2b908725ed4ad84926aa4c', 4, 'Black Pepper ₹10 (1 order + 3 table)'],
  ['6a2b904d25ed4ad84926aa49', 1, 'Cardamom ₹10 (Elaichi)'],
  // ── Powders + misc (typed table) ──
  ['6a3f8786a16dd21ce6914a5f', 6, 'Chilli Powder ₹5'],
  ['6a26b5db0778f3c30c12a56e', 1, 'Chilli Powder ₹10'],
  ['6a3e296c263612b26e28651d', 7, 'Turmeric Powder ₹5'],
  ['6a3fd9e681d5bc61d33cf79b', 8, 'Coriander Powder ₹5'],
  ['6a37dd5d5bb50882ef7ff32a', 1, 'Coriander Powder ₹10'],
  ['6a37e7bfd6705d5df3fc89ff', 2, 'Cumin Powder ₹10'],
  ['6a3f8817a16dd21ce6914a64', 3, 'Fenugreek Seeds ₹5 (Methi)'],
  ['6a3609dd2afd8461199b8997', 3, 'Fennel Seeds ₹5 (Saunf)'],
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d: any) => [String(d._id), d]));

  const items = LINES.map(([id, qty, label]) => {
    const inv: any = invMap.get(id);
    if (!inv) throw new Error(`Inventory item not found: ${id} (${label})`);
    return {
      item_id: new mongoose.Types.ObjectId(id),
      qty,
      item_name: inv.item_name ?? '',
      hindi_name: inv.hindi_name ?? '',
      wholesale_price_per_sheet: inv.wholesale_price_per_sheet ?? 0,
      variant_name: inv.variant_name ?? '',
    };
  });

  const totalSheets = LINES.reduce((s, l) => s + l[1], 0);
  console.log(`Assigning ${LINES.length} lines (${totalSheets} sheets) to Baibhav:`);
  LINES.forEach(([, qty, label]) => console.log(`  ${label.padEnd(38)} ${qty}`));

  const [loading] = await LoadingModel.create([
    { delivery_boy_id: new mongoose.Types.ObjectId(BAIBHAV_ID), items, date: new Date() },
  ]);
  console.log(`\nCreated Loading ${loading._id}.`);

  // Verify via holdings
  const holdings = await computeHoldings(BAIBHAV_ID);
  const held = holdings.reduce((s, h) => s + h.withBoy, 0);
  console.log(`\nVerify → Baibhav now holds ${holdings.length} items (${held} sheets):`);
  holdings.forEach((h) => console.log(`  ${h.item_name.padEnd(20)} mrp₹${h.mrp_per_unit}  ${h.withBoy}`));

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
