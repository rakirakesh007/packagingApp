/**
 * return-all-vishal.ts  (one-off)
 *
 * Records a Return for every sheet Vishal currently holds, zeroing his holdings
 * (withBoy = assigned − sold − returned → 0). History (Loadings + Sales) is
 * preserved. Uses computeHoldings as the source of truth for what he holds.
 *
 * Run:  npx ts-node src/scripts/return-all-vishal.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { ReturnModel } from '../models/return.model';
import { computeHoldings } from '../utils/holdings.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const before = await computeHoldings(VISHAL_ID);
  if (before.length === 0) {
    console.log('Vishal already holds nothing. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Recording returns for ${before.length} items:`);
  const now = new Date();
  const docs = before.map((h) => {
    console.log(`  ${h.item_name.padEnd(22)} mrp₹${h.mrp_per_unit}  return ${h.withBoy}`);
    return { delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID), item_id: new mongoose.Types.ObjectId(h.item_id), qty: h.withBoy, date: now };
  });
  const totalReturned = before.reduce((s, h) => s + h.withBoy, 0);

  await ReturnModel.insertMany(docs);
  console.log(`\nInserted ${docs.length} Return records (${totalReturned} sheets total).`);

  // Verify
  const after = await computeHoldings(VISHAL_ID);
  console.log(`\nVerify → Vishal now holds ${after.length} items (${after.reduce((s, h) => s + h.withBoy, 0)} sheets).`);
  if (after.length > 0) {
    console.log('Remaining:');
    after.forEach((h) => console.log(`  ${h.item_name} mrp₹${h.mrp_per_unit}: ${h.withBoy}`));
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
