/**
 * vishal-holdings.ts — READ ONLY. Prints Vishal's current holdings via
 * computeHoldings (Σ assigned − Σ sold − Σ returned), same source of truth
 * as the app's cart/reports.
 * Run: npx ts-node src/scripts/vishal-holdings.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { computeHoldings } from '../utils/holdings.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';

async function main() {
  await mongoose.connect(MONGO_URI);
  const holdings = await computeHoldings(VISHAL_ID);

  console.log(`Vishal holdings (${holdings.length} items):\n`);
  console.log('item'.padEnd(24), 'mrp'.padEnd(5), 'variant'.padEnd(10), 'assigned', 'sold', 'returned', 'withBoy');
  let totalSheets = 0;
  let totalValue = 0;
  for (const h of holdings) {
    console.log(
      h.item_name.padEnd(24),
      `₹${h.mrp_per_unit}`.padEnd(5),
      (h.variant_name || '-').padEnd(10),
      String(h.assigned).padEnd(8),
      String(h.sold).padEnd(4),
      String(h.returned).padEnd(8),
      h.withBoy
    );
    totalSheets += h.withBoy;
    totalValue += h.withBoy * h.wholesale_price_per_sheet;
  }
  console.log(`\nTotal sheets with boy: ${totalSheets}`);
  console.log(`Approx wholesale value: ₹${totalValue.toFixed(2)}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
