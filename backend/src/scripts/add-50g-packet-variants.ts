/**
 * add-50g-packet-variants.ts  (one-off)
 *
 * Adds a new 50g-pouch variant for 4 existing Powder Spices items, sold as
 * individual packets (not sheets). Pricing/costing sourced from
 * spice_costing.xlsx's "50g PACKETS" formula, reconciled against
 * spice_costing_v2.xlsx's live rates and the user's confirmed sell prices:
 *   cost = rate × 50/1000 × 1.02 (2% wastage) + labour + packing + delivery
 * Existing 5₹/10₹ sheet-pouch variants for these items are untouched — this
 * only inserts 4 brand-new Inventory documents.
 *
 * Run:  npx ts-node src/scripts/add-50g-packet-variants.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

const ITEMS = [
  { item_name: 'Chilli Powder',    hindi_name: 'लाल मिर्च पाउडर', mrp_per_unit: 22, wholesale_price_per_sheet: 16, cost_per_sheet: 15.985 },
  { item_name: 'Turmeric Powder',  hindi_name: 'हल्दी पाउडर',     mrp_per_unit: 20, wholesale_price_per_sheet: 15, cost_per_sheet: 13.435 },
  { item_name: 'Coriander Powder', hindi_name: 'धनिया पाउडर',     mrp_per_unit: 20, wholesale_price_per_sheet: 15, cost_per_sheet: 12.925 },
  { item_name: 'Cumin Powder',     hindi_name: 'जीरा पाउडर',      mrp_per_unit: 24, wholesale_price_per_sheet: 18, cost_per_sheet: 18.025 },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const docs = ITEMS.map((i) => ({
    item_name: i.item_name,
    hindi_name: i.hindi_name,
    quantity_per_unit: 50,
    mrp_per_unit: i.mrp_per_unit,
    units_per_sheet: 1,
    wholesale_price_per_sheet: i.wholesale_price_per_sheet,
    cost_per_sheet: i.cost_per_sheet,
    sale_mode: 'packet' as const,
    category: 'Powder Spices',
    total_stock: 0,
    low_stock_threshold: 0,
  }));

  console.log('Inserting:');
  docs.forEach((d) =>
    console.log(`  ${d.item_name.padEnd(18)} 50g  MRP=₹${d.mrp_per_unit}  sell=₹${d.wholesale_price_per_sheet}  cost=₹${d.cost_per_sheet}`)
  );

  const created = await InventoryModel.create(docs);
  console.log(`\nInserted ${created.length} items:`);
  created.forEach((d) => console.log(`  ${d.item_name} 50g -> _id=${d._id}`));

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
