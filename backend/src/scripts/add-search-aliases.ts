import mongoose from 'mongoose';
import { InventoryModel } from '../models/inventory.model';

const MONGO_URI = process.env['MONGO_URI'];
if (!MONGO_URI) throw new Error('MONGO_URI env var required. Run: MONGO_URI=... npx ts-node src/scripts/add-search-aliases.ts');

// item_name → space/comma keywords for romanized + alternate search
const aliases: Record<string, string> = {
  'Chilli Powder':        'lal mirch powder mirchi red chilli lal mirchi',
  'Garam Masala':         'garam masala masala',
  'Garam Masala Powder':  'garam masala powder masala powder',
  'Cardamom':             'elaichi choti elaichi ilaychi hari elaichi',
  'Black Pepper':         'kali mirch kaali mirch kali miri',
  'Clove':                'laung loung lavang',
  'Panch Phoron':         'panch phoron panch phoran paanch phoran five spice',
  'Fennel Seeds':         'saunf sonf sauf fennel',
  'Kalongi':              'kalongi kalaunji nigella mangrail onion seeds black seed',
  'Carom Seeds':          'ajwain ajwayan thymol seeds bishop weed',
  'Cumin':                'jeera zeera jira safed jeera white cumin',
  'Fenugrik Seeds':       'methi fenugreek methidana methi dana',
  'Yellow Mustard':       'pili sarson sarson yellow mustard rai peeli sarson',
  'Turmeric Powder':      'haldi turmeric halad haldi powder',
  'Coriander Powder':     'dhaniya dhania coriander dhaniya powder dhania powder',
  'Cumin Powder':         'jeera powder zeera powder jira powder',
};

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  let updated = 0;
  for (const [itemName, aliasStr] of Object.entries(aliases)) {
    const result = await InventoryModel.updateMany(
      { item_name: itemName },
      { $set: { search_aliases: aliasStr } }
    );
    console.log(`${itemName}: updated ${result.modifiedCount} doc(s)`);
    updated += result.modifiedCount;
  }

  console.log(`\nDone — ${updated} total documents updated.`);
  await mongoose.disconnect();
})();
