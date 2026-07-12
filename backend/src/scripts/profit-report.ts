/**
 * profit-report.ts  (reporting, read-only)
 *
 * Answers "how much profit have I actually made so far?" using the owner's REAL
 * economics — not the app's rough "10% of wholesale" figure stored on each sale.
 *
 * Two profit models per item (chosen per item|mrp variant):
 *
 *   1. FLAT_PROFIT_PER_POUCH — a fixed ₹/pouch the owner quotes directly.
 *        profit = pouches_sold × flat        (pouches_sold = sheets_sold × units_per_sheet)
 *      Used for Cardamom & Garam Masala (₹5 → ₹1/pouch, ₹10 → ₹2/pouch).
 *
 *   2. COST_PER_SHEET — real cost/sheet from the owner's costing sheet.
 *        profit = final_price − cost_per_sheet × sheets_sold
 *      Used for everything else.
 *
 * Variant is resolved per sale line: item_id → inventory (mrp_per_unit, units_per_sheet).
 * Any line matching neither model is reported separately (revenue counted, profit
 * unknown) so nothing is silently dropped.
 *
 * Read-only. Writes nothing. Run: npx ts-node src/scripts/profit-report.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

// Flat profit per POUCH (owner-quoted). Takes precedence over COST_PER_SHEET.
// A sheet is units_per_sheet pouches (12 here), read from inventory per item.
const FLAT_PROFIT_PER_POUCH: Record<string, number> = {
  'Cardamom|5': 1,
  'Cardamom|10': 2,
  'Garam Masala|5': 1,
  'Garam Masala|10': 2,
};

// Real cost/sheet from the owner's costing sheet, keyed "<item_name>|<mrp>".
// Item names use the DB spelling (Fenugrik/Phoron) so the join is exact.
// Garam Masala Powder derived from ₹460/kg × pack-wt(4g/8g) × 12 + packing + delivery
// (packing ₹10 both; delivery ₹5 on ₹5 variant, ₹10 on ₹10 variant — matches the sheet's pattern).
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
  'Fenugrik Seeds|5': 35.8,   // "Fenugreek Seeds" on the sheet
  'Fenugrik Seeds|10': 61.6,
  'Panch Phoron|5': 34.6,     // "Panch Phoran" on the sheet
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
  'Garam Masala Powder|5': 37.1,   // 460×0.004×12=22.08 +10 +5
  'Garam Masala Powder|10': 64.2,  // 460×0.008×12=44.16 +10 +10
};

const inr = (n: number) => '₹' + n.toFixed(2);
const sh = (n: number) => (Math.round(n * 100) / 100).toString();

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  // item_id -> variant key + units_per_sheet (for pouch math)
  const inv = await InventoryModel.find({}).lean();
  const keyByItemId = new Map<string, string>();
  const unitsByItemId = new Map<string, number>();
  for (const d of inv as any[]) {
    keyByItemId.set(String(d._id), `${d.item_name}|${d.mrp_per_unit}`);
    unitsByItemId.set(String(d._id), Math.max(1, Number(d.units_per_sheet) || 12));
  }

  const sales = await SaleModel.find({}).lean();

  let revenue = 0;
  let cogs = 0;              // cost of goods on cost-based lines only
  let profit = 0;           // total real profit (flat + cost-based)
  let dbProfit = 0;         // app's stored (10%) profit, for comparison
  let uncostedRevenue = 0;
  let saleLines = 0;

  const perItem = new Map<string, { rev: number; profit: number; sheets: number; model: string }>();
  const uncosted = new Map<string, { rev: number; sheets: number }>();

  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const s of sales as any[]) {
    dbProfit += Number(s.total_profit || 0);
    const ts = s.timestamp ? new Date(s.timestamp) : null;
    if (ts) {
      if (!earliest || ts < earliest) earliest = ts;
      if (!latest || ts > latest) latest = ts;
    }
    for (const it of s.items) {
      saleLines++;
      const rev = Number(it.final_price || 0);
      const sheets = Number(it.sheets_sold || 0);
      revenue += rev;
      const id = String(it.item_id);
      const key = keyByItemId.get(id) || `${it.item_name}|?`;
      const units = unitsByItemId.get(id) ?? 12;

      const flat = FLAT_PROFIT_PER_POUCH[key];
      const cps = COST_PER_SHEET[key];

      let lineProfit: number;
      let model: string;
      if (flat != null) {
        lineProfit = sheets * units * flat;   // pouches × flat ₹/pouch
        model = `flat ₹${flat}/pouch`;
      } else if (cps != null) {
        lineProfit = rev - cps * sheets;       // revenue − real cost
        cogs += cps * sheets;
        model = `cost ₹${cps}/sheet`;
      } else {
        uncostedRevenue += rev;
        const u = uncosted.get(key) || { rev: 0, sheets: 0 };
        u.rev += rev; u.sheets += sheets; uncosted.set(key, u);
        continue;
      }

      profit += lineProfit;
      const p = perItem.get(key) || { rev: 0, profit: 0, sheets: 0, model };
      p.rev += rev; p.profit += lineProfit; p.sheets += sheets; p.model = model;
      perItem.set(key, p);
    }
  }

  console.log(`Sales in DB: ${sales.length}  |  line items: ${saleLines}`);
  if (earliest && latest) {
    console.log(`Date range:  ${earliest.toISOString().slice(0, 10)} → ${latest.toISOString().slice(0, 10)}\n`);
  }

  console.log('Per item/variant, most profitable first:');
  console.log('  ' + 'item | ₹mrp'.padEnd(26) + 'sheets   revenue      profit   basis');
  [...perItem.entries()]
    .sort((a, b) => b[1].profit - a[1].profit)
    .forEach(([k, v]) => {
      console.log(
        '  ' + k.padEnd(26) +
        sh(v.sheets).padStart(6) + '  ' +
        inr(v.rev).padStart(10) + '  ' +
        inr(v.profit).padStart(10) + '   ' + v.model
      );
    });

  if (uncosted.size) {
    console.log('\n⚠  Still uncosted (no cost/flat given — revenue counted, profit unknown):');
    [...uncosted.entries()]
      .sort((a, b) => b[1].rev - a[1].rev)
      .forEach(([k, v]) =>
        console.log(`  ${k.padEnd(26)} ${sh(v.sheets).padStart(6)} sheets  revenue ${inr(v.rev)}`)
      );
  }

  console.log('\n────────────────────────── TOTALS ──────────────────────────');
  console.log(`Total revenue (all sales):            ${inr(revenue)}`);
  if (uncostedRevenue > 0) {
    console.log(`  uncosted revenue (excluded):        ${inr(uncostedRevenue)}  (${((uncostedRevenue / revenue) * 100).toFixed(0)}%)`);
  }
  console.log(`Cost of goods (cost-based lines):     ${inr(cogs)}`);
  console.log(`\n➤ TOTAL REAL PROFIT so far:           ${inr(profit)}`);
  console.log(`  (overall margin on revenue: ${((profit / revenue) * 100).toFixed(1)}%)`);
  console.log(`  App-stored profit for reference:    ${inr(dbProfit)}  (old 10% formula)`);
  console.log('─────────────────────────────────────────────────────────────');

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
