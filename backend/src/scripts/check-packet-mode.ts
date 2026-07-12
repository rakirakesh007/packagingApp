import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
async function main() {
  await mongoose.connect(MONGO_URI);
  const docs = await InventoryModel.find({ sale_mode: 'packet' }).limit(5).lean();
  docs.forEach((d: any) => console.log(
    d.item_name, '| units_per_sheet:', d.units_per_sheet, '| qty/unit:', d.quantity_per_unit,
    '| mrp:', d.mrp_per_unit, '| whl/sheet:', d.wholesale_price_per_sheet, '| cost/sheet:', d.cost_per_sheet,
    '| total_stock:', d.total_stock
  ));
  console.log('count:', docs.length);
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
