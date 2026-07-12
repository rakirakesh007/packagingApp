/**
 * add-vishal-sale-today.ts  (one-off)
 *
 * Records a wholesale sale for delivery boy Vishal, dated now, matching a cart
 * the deployed app rejected (old reserved_stock guard). Money is computed
 * server-side (final = sell × sheets; profit = wholesale × units × 0.10 × sheets).
 * Decrements total_stock only; never blocks (may go negative) — same as the
 * remove-reserved-stock refactor.
 *
 * Run:  npx ts-node src/scripts/add-vishal-sale-today.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const SALE_DATE = new Date(); // today, now

// [item_id, sheets_sold, selling_price_per_sheet]
const LINES: Array<[string, number, number]> = [
  ['6a2b904d25ed4ad84926aa49', 2, 80], // Cardamom ₹10
  ['6a2e5aff59190695356c5d66', 2, 40], // Cardamom ₹5
  ['6a2b900925ed4ad84926aa46', 1, 80], // Garam Masala ₹10  (the one that errored)
  ['6a2aa692124739f1f9b2ad1d', 1, 40], // Garam Masala ₹5
  ['6a3609dd2afd8461199b8997', 1, 40], // Fennel ₹5
  ['6a2b908725ed4ad84926aa4c', 1, 80], // Black Pepper ₹10
  ['6a2b90aa25ed4ad84926aa4f', 1, 80], // Clove ₹10
  ['6a3f8817a16dd21ce6914a64', 1, 40], // Methi ₹5
  ['6a3e29b5263612b26e286520', 1, 40], // Carom ₹5
  ['6a3e29ca263612b26e286523', 1, 40], // Kalongi ₹5
  ['6a3e2a25263612b26e286536', 1, 40], // Panch Phoron ₹5
  ['6a3d209eabd5f087e37b1a1f', 1, 40], // Cumin ₹5
  ['6a3f8786a16dd21ce6914a5f', 2, 40], // Chilli Powder ₹5
  ['6a3fd9e681d5bc61d33cf79b', 2, 40], // Coriander Powder ₹5
  ['6a3f8924a16dd21ce6914a69', 2, 40], // Cumin Powder ₹5
  ['6a3e296c263612b26e28651d', 2, 40], // Turmeric Powder ₹5
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

  console.log('Sale to insert:');
  saleItems.forEach((i) =>
    console.log(`  ${i.item_name.padEnd(20)} ${i.sheets_sold} @ ₹${i.selling_price_per_sheet} = ₹${i.final_price}`)
  );
  console.log(`  TOTAL = ₹${total_amount}  |  profit = ₹${total_profit.toFixed(2)}`);
  console.log(`  delivery_boy = Vishal  |  date = ${SALE_DATE.toISOString()}\n`);

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
