/**
 * seed-real-costs.ts  (one-off, idempotent)
 *
 * Seeds the real-profit fields on Inventory from the owner's costing sheet:
 *   - flat_profit_per_pouch : owner-quoted fixed ₹/pouch (takes precedence)
 *   - cost_per_sheet        : real production cost per sheet
 *
 * Matched by (item_name, mrp_per_unit) so both ₹5/₹10 variants get their own
 * value. Items not listed keep 0 → profit falls back to the legacy 10% formula
 * until the owner fills the field on the Inventory page.
 *
 * Safe to re-run: pure $set of the same values.
 *
 * Run:  npx ts-node src/scripts/seed-real-costs.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

// Owner-quoted flat profit per pouch, keyed "<item_name>|<mrp>".
const FLAT_PROFIT_PER_POUCH: Record<string, number> = {
  'Cardamom|5': 1,
  'Cardamom|10': 2,
  'Garam Masala|5': 1,
  'Garam Masala|10': 2,
};

// Real cost/sheet from the owner's costing sheet (DB spellings: Fenugrik/Phoron).
// Garam Masala Powder derived from ₹460/kg × pack-wt(4g/8g) × 12 + packing + delivery.
const COST_PER_SHEET: Record<string, number> = {
  'Chilli Powder|5': 38.0,
  'Chilli Powder|10': 77.5,
  'Turmeric Powder|5': 37.6,
  'Turmeric Powder|10': 76.6,
  'Coriander Powder|5': 36.4,
  'Coriander Powder|10': 73.6,
  'Cumin Powder|5': 39.0,
  'Cumin Powder|10': 74.0,
  'Black Pepper Powder|10': 76.9,
  'Cumin|5': 43.2,
  'Cumin|10': 76.3,
  'Kalongi|5': 38.5,
  'Kalongi|10': 78.8,
  'Clove|5': 50.8,
  'Clove|10': 81.7,
  'Fenugrik Seeds|5': 35.8,
  'Fenugrik Seeds|10': 61.6,
  'Panch Phoron|5': 34.6,
  'Panch Phoron|10': 69.0,
  'Yellow Mustard|5': 41.9,
  'Carom Seeds|5': 38.3,
  'Carom Seeds|10': 78.1,
  'Fennel Seeds|5': 37.1,
  'Black Pepper|5': 49.4,
  'Black Pepper|10': 78.8,
  'Cinnamon|5': 33.4,
  'Bay Leaf|5': 40.5,
  'Mustard|5': 34.6,
  'Garam Masala Powder|5': 37.1,
  'Garam Masala Powder|10': 64.2,
};

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const docs = await InventoryModel.find({}).lean();
  let updated = 0;
  const untouched: string[] = [];

  console.log('item | ₹mrp'.padEnd(30) + 'flat/pouch   cost/sheet');
  for (const d of docs as any[]) {
    const key = `${d.item_name}|${d.mrp_per_unit}`;
    const flat = FLAT_PROFIT_PER_POUCH[key] ?? 0;
    const cost = COST_PER_SHEET[key] ?? 0;
    if (flat === 0 && cost === 0) {
      untouched.push(key);
      continue;
    }
    await InventoryModel.updateOne(
      { _id: d._id },
      { $set: { flat_profit_per_pouch: flat, cost_per_sheet: cost } },
    );
    updated++;
    console.log(
      key.padEnd(30) +
      (flat ? `₹${flat}` : '—').padStart(10) + '  ' +
      (cost ? `₹${cost}` : '—').padStart(11) +
      (d.flat_profit_per_pouch !== flat || d.cost_per_sheet !== cost ? '   (changed)' : '   (same)')
    );
  }

  console.log(`\nUpdated ${updated} items.`);
  if (untouched.length) {
    console.log(`No cost data (legacy 10% fallback stays) for ${untouched.length} items:`);
    untouched.forEach((k) => console.log(`  ${k}`));
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
