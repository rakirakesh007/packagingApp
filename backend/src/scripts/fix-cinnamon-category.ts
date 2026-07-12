import 'dotenv/config';
import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';
const MONGO_URI = process.env.MONGO_URI || '';
async function main(){
  await mongoose.connect(MONGO_URI);
  const r = await InventoryModel.updateMany({ item_name: 'Cinnamon' }, { $set: { category: 'Whole Spices' } });
  console.log(`Cinnamon → Whole Spices : ${r.modifiedCount} updated`);
  const d = await InventoryModel.find({ item_name: 'Cinnamon' }, { item_name:1, mrp_per_unit:1, category:1 }).lean();
  d.forEach((x:any)=>console.log(`  ${x.item_name} ₹${x.mrp_per_unit} → ${x.category}`));
  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
