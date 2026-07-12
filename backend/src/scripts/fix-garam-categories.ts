/**
 * fix-garam-categories.ts (one-off) — recategorize per owner instruction:
 *   Garam Masala Powder → "Mix Masala Powder"
 *   Garam Masala        → "Mix Masala Whole"
 * Applies to all ₹-variants of each. Run: npx ts-node src/scripts/fix-garam-categories.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
const MONGO_URI = process.env.MONGO_URI || '';

async function main() {
  await mongoose.connect(MONGO_URI);
  const r1 = await InventoryModel.updateMany({ item_name: 'Garam Masala Powder' }, { $set: { category: 'Mix Masala Powder' } });
  const r2 = await InventoryModel.updateMany({ item_name: 'Garam Masala' },        { $set: { category: 'Mix Masala Whole' } });
  console.log(`Garam Masala Powder → Mix Masala Powder : ${r1.modifiedCount} updated`);
  console.log(`Garam Masala        → Mix Masala Whole  : ${r2.modifiedCount} updated`);

  // Verify: show the affected docs
  const docs = await InventoryModel.find({ item_name: { $in: ['Garam Masala', 'Garam Masala Powder'] } }, { item_name: 1, mrp_per_unit: 1, category: 1 }).lean();
  console.log('\nAfter:');
  docs.sort((a: any, b: any) => a.item_name.localeCompare(b.item_name) || a.mrp_per_unit - b.mrp_per_unit)
    .forEach((d: any) => console.log(`  ${d.item_name.padEnd(20)} ₹${d.mrp_per_unit} → ${d.category}`));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
