/**
 * assign-vishal-3july.ts  (one-off)
 *
 * Records a morning loading (assignment) for delivery boy Vishal dated
 * 2026-07-03, from a handwritten slip. Notation on the slip is
 * "<MRP-variant> × <sheets>", so the ₹5 vs ₹10 variant is chosen per line.
 *
 * Mirrors POST /assignment: creates/merges the Loading doc and increments
 * reserved_stock per item. Unlike the endpoint it does NOT enforce the
 * available-stock guard — full quantities are assigned as written even where
 * stock is short (per instruction), so admin "available" may read negative for
 * those lines until stock is topped up / reserved is reconciled.
 *
 * Run:  npx ts-node src/scripts/assign-vishal-3july.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { LoadingModel } from '../models/loading.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const DATE = new Date('2026-07-03T12:00:00+05:30'); // midday IST, safely inside 3 July

// [item_id, qty, label]
const LINES: Array<[string, number, string]> = [
  ['6a2aa692124739f1f9b2ad1d', 1, 'Garam Masala ₹5'],
  ['6a2b900925ed4ad84926aa46', 1, 'Garam Masala ₹10'],
  ['6a2b90aa25ed4ad84926aa4f', 1, 'Clove ₹10'],
  ['6a2b908725ed4ad84926aa4c', 1, 'Black Pepper ₹10'],
  ['6a36cc47aed7a1b6d2942bf5', 1, 'Yellow Mustard ₹5'],
  ['6a3d209eabd5f087e37b1a1f', 1, 'Cumin ₹5'],
  ['6a2b904d25ed4ad84926aa49', 2, 'Cardamom ₹10'],
  ['6a2e5aff59190695356c5d66', 2, 'Cardamom ₹5'],
  ['6a3e2a25263612b26e286536', 1, 'Panch Phoron ₹5'],
  ['6a3e29b5263612b26e286520', 1, 'Carom Seeds ₹5'],
  ['6a3e29ca263612b26e286523', 1, 'Kalongi ₹5'],
  ['6a3f8817a16dd21ce6914a64', 1, 'Methi ₹5'],
  ['6a3609dd2afd8461199b8997', 1, 'Fennel ₹5'],
  ['6a3f8786a16dd21ce6914a5f', 2, 'Chilli Powder ₹5'],
  ['6a3fd9e681d5bc61d33cf79b', 1, 'Coriander Powder ₹5'],
  ['6a3f8924a16dd21ce6914a69', 2, 'Cumin Powder ₹5'],
  ['6a37dca65bb50882ef7ff322', 2, 'Garam Masala Powder ₹5'],
  ['6a3e296c263612b26e28651d', 2, 'Turmeric Powder ₹5'],
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d) => [String(d._id), d as any]));

  // Build denormalized loading items
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
  const start = new Date('2026-07-03T00:00:00+05:30');
  const end = new Date('2026-07-03T23:59:59.999+05:30');
  const existing = await LoadingModel.findOne({
    delivery_boy_id: VISHAL_ID,
    date: { $gte: start, $lte: end },
  });
  if (existing) {
    throw new Error(`A loading already exists for Vishal on 2026-07-03 (${existing._id}). Aborting to avoid double-assign.`);
  }

  console.log('Assigning to Vishal on 2026-07-03:');
  LINES.forEach(([, qty, label]) => console.log(`  ${label.padEnd(24)} ${qty} sheet(s)`));
  console.log(`  ${LINES.length} lines, ${LINES.reduce((s, l) => s + l[1], 0)} sheets total.\n`);

  const session = await mongoose.startSession();
  let loadingId = '';
  try {
    await session.withTransaction(async () => {
      const [created] = await LoadingModel.create(
        [{ delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID), date: DATE, items: loadingItems }],
        { session }
      );
      loadingId = String(created._id);

      for (const [itemId, qty] of LINES) {
        await InventoryModel.findByIdAndUpdate(itemId, { $inc: { reserved_stock: qty } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Created loading ${loadingId}. reserved_stock incremented for ${LINES.length} lines.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
