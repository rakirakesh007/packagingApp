/**
 * assign-vishal-6july.ts  (one-off)
 *
 * Records a morning loading (assignment) for delivery boy Vishal dated
 * 2026-07-06, from a handwritten slip. Slip notation is "<MRP-variant> × <sheets>",
 * so the ₹5 vs ₹10 variant is chosen per line (two items list both variants).
 *
 * Mirrors POST /assignment under the current (post-reserved_stock-removal) model:
 * it creates/merges the Loading doc ONLY and touches inventory NOT AT ALL — no
 * guard, no reservation. What Vishal holds is derived on read via computeHoldings.
 *
 * Run:  npx ts-node src/scripts/assign-vishal-6july.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { LoadingModel } from '../models/loading.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const DATE = new Date('2026-07-06T12:00:00+05:30'); // midday IST, safely inside 6 July

// [item_id, qty(sheets), label] — from the slip, "<MRP> × <sheets>"
const LINES: Array<[string, number, string]> = [
  ['6a3f8786a16dd21ce6914a5f', 2, 'Chilli Powder ₹5'],      // लाल मिर्च पाउडर 5×2
  ['6a3e296c263612b26e28651d', 2, 'Turmeric Powder ₹5'],    // हल्दी पाउडर 5×2
  ['6a3f8924a16dd21ce6914a69', 1, 'Cumin Powder ₹5'],       // जीरा पाउडर 5×1
  ['6a3fd9e681d5bc61d33cf79b', 2, 'Coriander Powder ₹5'],   // धनिया पाउडर 5×2
  ['6a3e2a25263612b26e286536', 2, 'Panch Phoron ₹5'],       // पंचफोरन 5×2
  ['6a3d209eabd5f087e37b1a1f', 2, 'Cumin ₹5'],              // जीरा 5×2
  ['6a3f8817a16dd21ce6914a64', 2, 'Fenugrik Seeds ₹5'],     // मेथी 5×2
  ['6a3609dd2afd8461199b8997', 2, 'Fennel Seeds ₹5'],       // सौंफ 5×2
  ['6a4b5a083e1268899d83fac6', 2, 'Mustard ₹5'],            // सरसो 5×2
  ['6a36cc47aed7a1b6d2942bf5', 2, 'Yellow Mustard ₹5'],     // पीला सरसो 5×2
  ['6a2aa692124739f1f9b2ad1d', 4, 'Garam Masala ₹5'],       // गरम मसाला 5×4
  ['6a3e29b5263612b26e286520', 2, 'Carom Seeds ₹5'],        // अजवाइन 5×2
  ['6a3e29ca263612b26e286523', 1, 'Kalongi ₹5'],            // मंगरेला 5×1
  ['6a2e5aff59190695356c5d66', 2, 'Cardamom ₹5'],           // इलाइची 5×2
  ['6a2b904d25ed4ad84926aa49', 2, 'Cardamom ₹10'],          // इलाइची 10×2
  ['6a4b8deda8b45eb1a1b8416d', 1, 'Black Cardamom ₹5'],     // बड़ी इलाइची 5×1
  ['6a4b8f3aa8b45eb1a1b84174', 1, 'Cinnamon ₹5'],           // दालचीनी 5×1
  ['6a328ec0f66eebbce5b0eaf6', 1, 'Black Pepper ₹5'],       // मरीच 5×1
  ['6a2b908725ed4ad84926aa4c', 1, 'Black Pepper ₹10'],      // मरीच 10×1
  ['6a2b90aa25ed4ad84926aa4f', 1, 'Clove ₹10'],             // लौंग 10×1
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d) => [String(d._id), d as any]));

  // Denormalize item fields into the loading (same shape as POST /assignment).
  const loadingItems = LINES.map(([itemId, qty]) => {
    const inv = invMap.get(itemId);
    if (!inv) throw new Error(`Inventory item not found: ${itemId}`);
    return {
      item_id: new mongoose.Types.ObjectId(itemId),
      qty,
      item_name: inv.item_name ?? '',
      hindi_name: inv.hindi_name ?? '',
      wholesale_price_per_sheet: inv.wholesale_price_per_sheet ?? 0,
      variant_name: inv.variant_name ?? '',
    };
  });

  // Guard against an existing loading for the same boy+day (endpoint is additive).
  const start = new Date('2026-07-06T00:00:00+05:30');
  const end = new Date('2026-07-06T23:59:59.999+05:30');
  const existing = await LoadingModel.findOne({
    delivery_boy_id: VISHAL_ID,
    date: { $gte: start, $lte: end },
  });
  if (existing) {
    throw new Error(`A loading already exists for Vishal on 2026-07-06 (${existing._id}). Aborting to avoid double-assign.`);
  }

  console.log('Assigning to Vishal on 2026-07-06:');
  LINES.forEach(([, qty, label]) => console.log(`  ${label.padEnd(24)} ${qty} sheet(s)`));
  console.log(`  ${LINES.length} lines, ${LINES.reduce((s, l) => s + l[1], 0)} sheets total.\n`);

  const [created] = await LoadingModel.create([
    { delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID), date: DATE, items: loadingItems },
  ]);

  console.log(`Created loading ${created._id}. Inventory untouched (no reservation).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
