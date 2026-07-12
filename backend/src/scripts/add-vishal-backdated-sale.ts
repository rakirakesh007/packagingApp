/**
 * add-vishal-backdated-sale.ts  (one-off)
 *
 * Records a single wholesale sale attributed to delivery boy Vishal, backdated
 * to 2026-07-04, matching a cart the app itself cannot backdate. Money is
 * computed server-side using the same formula as sale.route.ts (never trust the
 * client): final_price = selling_per_sheet × sheets_sold;
 *          profit      = wholesale × units_per_sheet × 0.10 × sheets_sold.
 *
 * total_stock is decremented per line (allowed to go negative for the two
 * zero-stock items — Methi & Cumin — per explicit instruction). reserved_stock
 * is left untouched (this was never an assigned load).
 *
 * Run:  npx ts-node src/scripts/add-vishal-backdated-sale.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SaleModel } from '../models/sale.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

const VISHAL_ID = '6a47c8a1c93eb867eb5812d9';
const SALE_DATE = new Date('2026-07-04T12:00:00+05:30'); // midday IST, safely inside the day

// [item_id, sheets_sold, selling_price_per_sheet]
const LINES: Array<[string, number, number]> = [
  ['6a328ec0f66eebbce5b0eaf6', 1, 45], // Black Pepper (whl 3.75)
  ['6a2aa692124739f1f9b2ad1d', 2, 45], // Garam Masala (whl 3.75)
  ['6a2b904d25ed4ad84926aa49', 5, 90], // Cardamom (whl 7.5)
  ['6a3f8817a16dd21ce6914a64', 1, 45], // Methi / Fenugreek (whl 3.75) — goes negative
  ['6a3d209eabd5f087e37b1a1f', 2, 40], // Cumin / Jeera (sheet, whl 3.75) — goes negative
  ['6a3609dd2afd8461199b8997', 1, 45], // Fennel (whl 3.75)
  ['6a3f8924a16dd21ce6914a69', 1, 45], // Cumin Powder (whl 3.75)
  ['6a2b900925ed4ad84926aa46', 1, 80], // Garam Masala 2nd variant (whl 7.5)
  ['6a3f8786a16dd21ce6914a5f', 1, 45], // Chilli Powder (whl 3.75)
  ['6a3e296c263612b26e28651d', 2, 45], // Turmeric Powder (whl 3.75)
  ['6a3fd9e681d5bc61d33cf79b', 2, 87], // Coriander Powder (whl 3.75)
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const ids = LINES.map((l) => l[0]);
  const invDocs = await InventoryModel.find({ _id: { $in: ids } }).lean();
  const invMap = new Map(invDocs.map((d) => [String(d._id), d]));

  const saleItems = LINES.map(([itemId, sheetsSold, sellPerSheet]) => {
    const inv: any = invMap.get(itemId);
    if (!inv) throw new Error(`Inventory item not found: ${itemId}`);
    const wholesale = inv.wholesale_price_per_sheet ?? 0; // per-packet wholesale
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
    console.log(`  ${i.item_name.padEnd(22)} ${i.sheets_sold} sheet(s) @ ₹${i.selling_price_per_sheet} = ₹${i.final_price}`)
  );
  console.log(`  TOTAL = ₹${total_amount}  |  profit = ₹${total_profit.toFixed(2)}`);
  console.log(`  delivery_boy = Vishal (${VISHAL_ID})  |  date = ${SALE_DATE.toISOString()}\n`);

  const session = await mongoose.startSession();
  let saleId = '';
  try {
    await session.withTransaction(async () => {
      const [created] = await SaleModel.create(
        [
          {
            delivery_boy_id: new mongoose.Types.ObjectId(VISHAL_ID),
            shop_id: null,
            shop_name: '',
            customer_name: '',
            items: saleItems,
            total_amount,
            total_profit,
            payment_mode: 'cash',
            timestamp: SALE_DATE,
          },
        ],
        { session }
      );
      saleId = String(created._id);

      for (const [itemId, sheetsSold] of LINES) {
        await InventoryModel.findByIdAndUpdate(
          itemId,
          { $inc: { total_stock: -sheetsSold } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Inserted sale ${saleId}. Stock decremented for ${LINES.length} lines.`);

  // Verify
  const verify = await SaleModel.findById(saleId).lean();
  console.log(`Verify → total_amount=₹${verify?.total_amount}, items=${verify?.items.length}, timestamp=${verify?.timestamp?.toISOString()}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
