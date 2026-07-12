import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
async function main() {
  await mongoose.connect(MONGO_URI);
  const all = await InventoryModel.find({}).lean();
  const names = ['chilli powder', 'turmeric powder', 'coriander powder', 'cumin powder'];
  for (const n of names) {
    console.log(`--- ${n} ---`);
    all.filter((d: any) => (d.item_name || '').toLowerCase() === n).forEach((d: any) => {
      console.log(
        String(d._id), '| hindi:', d.hindi_name, '| variant:', d.variant_name || '-',
        '| mrp:', d.mrp_per_unit, '| qty/unit(g):', d.quantity_per_unit, '| units/sheet:', d.units_per_sheet,
        '| whl/sheet:', d.wholesale_price_per_sheet, '| cost/sheet:', d.cost_per_sheet ?? 0,
        '| flat/pouch:', d.flat_profit_per_pouch ?? 0, '| category:', d.category, '| mode:', d.sale_mode,
        '| stock:', d.total_stock
      );
    });
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
