import mongoose from 'mongoose';
import { CategoryModel } from '../models/category.model';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env['MONGO_URI'];
if (!MONGO_URI) throw new Error('MONGO_URI env var required. Run: MONGO_URI=... npx ts-node src/scripts/seed-categories.ts');

const CATEGORIES = [
  { name: 'Powder Spices',      hindi_name: 'पाउडर मसाले' },
  { name: 'Whole Spices',       hindi_name: 'साबुत मसाले' },
  { name: 'Mix Masala Whole',   hindi_name: 'मिक्स मसाला (साबुत)' },
  { name: 'Mix Masala Powder',  hindi_name: 'मिक्स मसाला (पाउडर)' },
];

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

  // Upsert categories
  for (const cat of CATEGORIES) {
    await CategoryModel.updateOne({ name: cat.name }, { $set: cat }, { upsert: true });
    console.log(`  Category upserted: ${cat.name}`);
  }

  // Assign categories to inventory items
  let updated = 0;
  for (const [itemName, category] of Object.entries(ITEM_CATEGORIES)) {
    const r = await InventoryModel.updateMany({ item_name: itemName }, { $set: { category } });
    if (r.modifiedCount > 0) {
      console.log(`  ${itemName} → ${category}`);
      updated += r.modifiedCount;
    }
  }

  console.log(`\nDone — ${CATEGORIES.length} categories seeded, ${updated} inventory items categorized.`);
  await mongoose.disconnect();
})();
