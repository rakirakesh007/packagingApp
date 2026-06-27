import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env['MONGO_URI'];
if (!MONGO_URI) throw new Error('MONGO_URI env var required. Run: MONGO_URI=... npx ts-node src/scripts/seed-categories.ts');

// item_name → category name
const ITEM_CATEGORIES: Record<string, string> = {
  'Chilli Powder':       'Powder Spices',
  'Turmeric Powder':     'Powder Spices',
  'Coriander Powder':    'Powder Spices',
  'Cumin Powder':        'Powder Spices',
  'Garam Masala Powder': 'Powder Spices',
  'Cardamom':            'Whole Spices',
  'Black Pepper':        'Whole Spices',
  'Clove':               'Whole Spices',
  'Fennel Seeds':        'Whole Spices',
  'Kalongi':             'Whole Spices',
  'Carom Seeds':         'Whole Spices',
  'Cumin':               'Whole Spices',
  'Fenugrik Seeds':      'Whole Spices',
  'Yellow Mustard':      'Whole Spices',
  'Panch Phoron':        'Mix Masala Whole',
  'Garam Masala':        'Mix Masala Powder',
};

(async () => {
  await mongoose.connect(MONGO_URI as string);
  console.log('Connected to MongoDB Atlas');

  // Assign categories to inventory items
  let updated = 0;
  for (const [itemName, category] of Object.entries(ITEM_CATEGORIES)) {
    const r = await InventoryModel.updateMany({ item_name: itemName }, { $set: { category } });
    if (r.modifiedCount > 0) {
      console.log(`  ${itemName} → ${category}`);
      updated += r.modifiedCount;
    }
  }

  console.log(`\nDone — ${updated} inventory items categorized.`);
  await mongoose.disconnect();
})();
