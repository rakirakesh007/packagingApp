/**
 * add-vishal-sale-8july.ts  (one-off)
 *
 * Records one wholesale sale (one cart) for delivery boy Vishal, backdated to
 * 2026-07-08. All lines sold at ₹40/sheet (negotiated). Mirrors POST /sale
 * exactly — money computed server-side via computeProfit (flat ₹/pouch > real
 * cost/sheet > legacy 10% fallback); total_stock decremented per line inside a
 * transaction (allowed to go negative — sales never block on stock).
 *
 * Run:  npx ts-node src/scripts/add-vishal-sale-8july.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';
import { computeProfit } from '../utils/profit.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';
const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const SALE_DATE = new Date('2026-07-08T12:00:00+05:30'); // midday IST, safely inside the day
const SELL_PER_SHEET = 40;

// [item_id, sheets_sold, label]
const LINES: Array<[string, number, string]> = [
  ['6a3d209eabd5f087e37b1a1f', 3, 'Cumin ₹5 (जीरा)'],
  ['6a3e29ca263612b26e286523', 4, 'Kalongi ₹5 (मंगरैल)'],
  ['6a3e2a25263612b26e286536', 3, 'Panch Phoron ₹5 (पांच फोरन)'],
  ['6a36cc47aed7a1b6d2942bf5', 2, 'Yellow Mustard ₹5 (पीली सरसों)'],
  ['6a3e29b5263612b26e286520', 3, 'Carom Seeds ₹5 (अजवाइन)'],
  ['6a3609dd2afd8461199b8997', 1, 'Fennel Seeds ₹5 (सौंफ)'],
  ['6a4b8f3aa8b45eb1a1b84174', 1, 'Cinnamon ₹5 (दालचीनी)'],
  ['6a4b5a083e1268899d83fac6', 2, 'Mustard ₹5 (सरसों)'],
  ['6a2aa692124739f1f9b2ad1d', 3, 'Garam Masala ₹5 (गरम मसाला)'],
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d) => [String(d._id), d as any]));

  const saleItems = LINES.map(([itemId, sheetsSold]) => {
    const inv: any = invMap.get(itemId);
    if (!inv) throw new Error(`Inventory item not found: ${itemId}`);
    const wholesale = inv.wholesale_price_per_sheet ?? 0;
    const finalPrice = SELL_PER_SHEET * sheetsSold;
    return {
      item_id: new mongoose.Types.ObjectId(itemId),
      sale_type: 'wholesale' as const,
      sheets_sold: sheetsSold,
      packets_sold: null,
      wholesale_price_per_sheet: wholesale,
      selling_price_per_sheet: SELL_PER_SHEET,
      final_price: finalPrice,
      profit: computeProfit(finalPrice, sheetsSold, inv),
      item_name: inv.item_name ?? '',
      hindi_name: inv.hindi_name ?? '',
      description: inv.description ?? '',
    };
  });

  const total_amount = saleItems.reduce((s, i) => s + i.final_price, 0);
  const total_profit = saleItems.reduce((s, i) => s + i.profit, 0);

  console.log('Sale to insert (Vishal, 2026-07-08):');
  saleItems.forEach((i) =>
    console.log(`  ${i.item_name.padEnd(20)} ${i.sheets_sold} × ₹${i.selling_price_per_sheet} = ₹${i.final_price}  profit=₹${i.profit.toFixed(2)}`)
  );
  console.log(`  TOTAL = ₹${total_amount}  |  profit = ₹${total_profit.toFixed(2)}`);
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
  const verify = await SaleModel.findById(saleId).lean();
  console.log(`Verify → total_amount=₹${verify?.total_amount}, total_profit=₹${verify?.total_profit?.toFixed(2)}, items=${verify?.items.length}, timestamp=${verify?.timestamp?.toISOString()}`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
