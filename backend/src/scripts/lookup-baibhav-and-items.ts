import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { InventoryModel } from '../models/inventory.model';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('=== users matching baibhav/vaibhav ===');
  const users = await UserModel.find({ $or: [
    { name: /ba?i?bhav|vaibhav|baibhav/i },
    { username: /ba?i?bhav|vaibhav|baibhav/i },
  ] }).lean();
  users.forEach((u: any) => console.log(String(u._id), '| name:', u.name, '| username:', u.username, '| role:', u.role));
  if (users.length === 0) {
    console.log('NO MATCH. All delivery boys:');
    const boys = await UserModel.find({ role: /delivery|boy/i }).lean();
    boys.forEach((u: any) => console.log(String(u._id), '| name:', u.name, '| username:', u.username, '| role:', u.role));
  }

  console.log('\n=== inventory (item | hindi | mrp | id) ===');
  const items = await InventoryModel.find({}, { item_name: 1, hindi_name: 1, mrp_per_unit: 1, variant_name: 1, wholesale_price_per_sheet: 1 }).lean();
  items.sort((a: any, b: any) => (a.item_name || '').localeCompare(b.item_name) || (a.mrp_per_unit - b.mrp_per_unit));
  items.forEach((d: any) => console.log(`${String(d._id)} | ${(d.item_name||'').padEnd(20)} | ${(d.hindi_name||'').padEnd(14)} | mrp₹${d.mrp_per_unit} | var:${d.variant_name||'-'}`));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
