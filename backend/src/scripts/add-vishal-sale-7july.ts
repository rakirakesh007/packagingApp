/**
 * add-vishal-sale-7july.ts  (one-off)
 *
 * Records one wholesale sale (one cart) for delivery boy Vishal, dated now,
 * that the deployed app failed to submit ("insufficient" error — a transient
 * failure; Vishal's holdings fully cover every line, and POST /sale never blocks
 * on stock anyway). Mirrors POST /sale exactly:
 *   final_price = selling_per_sheet × sheets
 *   profit      = wholesale × units × 0.10 × sheets   (app's stored formula)
 * total_stock is decremented per line inside a transaction.
 *
 * काली मिर्च @ ₹40 = the ₹5 Black Pepper variant (the ₹10 sells at ₹80).
 *
 * Run:  npx ts-node src/scripts/add-vishal-sale-7july.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const SALE_DATE = new Date(); // today, now

// [item_id, sheets_sold, selling_price_per_sheet, label]
const LINES: Array<[string, number, number, string]> = [
  ['6a4b5a083e1268899d83fac6', 2, 40, 'Mustard ₹5 (सरसों)'],
  ['6a36cc47aed7a1b6d2942bf5', 1, 40, 'Yellow Mustard ₹5 (पीली सरसों)'],
  ['6a4b8deda8b45eb1a1b8416d', 1, 40, 'Black Cardamom ₹5 (बड़ी इलायची)'],
  ['6a4b8f3aa8b45eb1a1b84174', 1, 40, 'Cinnamon ₹5 (दालचीनी)'],
  ['6a328ec0f66eebbce5b0eaf6', 1, 40, 'Black Pepper ₹5 (काली मिर्च)'],
  ['6a3e29ca263612b26e286523', 1, 40, 'Kalongi ₹5 (मंगरैल)'],
  ['6a3e29b5263612b26e286520', 1, 40, 'Carom Seeds ₹5 (अजवाइन)'],
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d) => [String(d._id), d as any]));

  const saleItems = LINES.map(([itemId, sheetsSold, sellPerSheet]) => {
    const inv: any = invMap.get(itemId);
    if (!inv) throw new Error(`Inventory item not found: ${itemId}`);
    const wholesale = inv.wholesale_price_per_sheet ?? 0;
    const units = Math.max(1, inv.units_per_sheet ?? 1);
    return {
      item_id: new mongoose.Types.ObjectId(itemId),
      sale_type: 'wholesale' as const,
      sheets_sold: sheetsSold,
      packets_sold: null,
      wholesale_price_per_sheet: wholesale,
      selling_price_per_sheet: sellPerSheet,
      final_price: sellPerSheet * sheetsSold,
      profit: wholesale * units * 0.1 * sheetsSold,
      item_name: inv.item_name ?? '',
      hindi_name: inv.hindi_name ?? '',
      description: inv.description ?? '',
    };
  });

  const total_amount = saleItems.reduce((s, i) => s + i.final_price, 0);
  const total_profit = saleItems.reduce((s, i) => s + i.profit, 0);

  console.log('Sale to insert (Vishal, one cart):');
  LINES.forEach(([, sheets, sell, label], idx) =>
    console.log(`  ${label.padEnd(34)} ${sheets} × ₹${sell} = ₹${sheets * sell}`)
  );
  console.log(`  TOTAL = ₹${total_amount}  |  stored-profit = ₹${total_profit.toFixed(2)}`);
  console.log(`  date = ${SALE_DATE.toISOString()}\n`);

  const session = await mongoose.startSession();
  let saleId = '';
  try {
    await session.withTransaction(async () => {
      const [created] = await SaleModel.create(
        [{
          delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID),
          shop_id: null,
          shop_name: '',
          customer_name: '',
          items: saleItems,
          total_amount,
          total_profit,
          payment_mode: 'cash',
          timestamp: SALE_DATE,
        }],
        { session }
      );
      saleId = String(created._id);
      for (const [itemId, sheetsSold] of LINES) {
        await InventoryModel.findByIdAndUpdate(itemId, { $inc: { total_stock: -sheetsSold } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Inserted sale ${saleId}. Stock decremented for ${LINES.length} lines.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
