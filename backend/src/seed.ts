import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { InventoryModel } from './models/inventory.model';
import { ShopModel } from './models/shop.model';
import { UserModel } from './models/user.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

const spices = [
  { item_name: 'Jeera',         hindi_name: 'जीरा',        description: 'Premium roasted cumin from Rajasthan', quantity: 100, mrp: 280, total_stock: 100, unit_price: 250,  purchase_price: 180, low_stock_threshold: 20 },
  { item_name: 'Black Pepper',  hindi_name: 'काली मिर्च',  description: 'Whole black peppercorns', quantity: 100, mrp: 450, total_stock: 80,  unit_price: 400,  purchase_price: 320, low_stock_threshold: 15 },
  { item_name: 'Turmeric',      hindi_name: 'हल्दी',       description: 'Strong color and aroma', quantity: 100, mrp: 210, total_stock: 120, unit_price: 180,  purchase_price: 120, low_stock_threshold: 25 },
  { item_name: 'Red Chilli',    hindi_name: 'लाल मिर्च',    description: 'Medium hot dry red chilli', quantity: 100, mrp: 260, total_stock: 90,  unit_price: 220,  purchase_price: 160, low_stock_threshold: 18 },
  { item_name: 'Coriander',     hindi_name: 'धनिया',       description: 'Freshly ground coriander', quantity: 100, mrp: 180, total_stock: 110, unit_price: 140,  purchase_price: 90,  low_stock_threshold: 22 },
  { item_name: 'Mustard Seeds', hindi_name: 'सरसों',       description: 'Bold yellow mustard seeds', quantity: 100, mrp: 160, total_stock: 70,  unit_price: 130,  purchase_price: 80,  low_stock_threshold: 10 },
  { item_name: 'Fennel',        hindi_name: 'सौंफ',        description: 'Sweet aromatic fennel', quantity: 100, mrp: 240, total_stock: 60,  unit_price: 210,  purchase_price: 150, low_stock_threshold: 12 },
  { item_name: 'Fenugreek',     hindi_name: 'मेथी',        description: 'Healthy fenugreek seeds', quantity: 100, mrp: 190, total_stock: 50,  unit_price: 160,  purchase_price: 110, low_stock_threshold: 8  },
  { item_name: 'Cloves',        hindi_name: 'लौंग',        description: 'Strong whole cloves', quantity: 50, mrp: 1050, total_stock: 30,  unit_price: 900,  purchase_price: 700, low_stock_threshold: 5  },
  { item_name: 'Cardamom',      hindi_name: 'इलायची',      description: 'Premium green cardamom', quantity: 25, mrp: 1450, total_stock: 20,  unit_price: 1200, purchase_price: 950, low_stock_threshold: 3  },
];

const shops = [
  { name: 'Sharma Kirana',   mobile: '9876543210', address: 'MG Road, Block 1',    total_orders_count: 12 },
  { name: 'Patel Stores',    mobile: '9876543211', address: 'Gandhi Nagar, Shop 5', total_orders_count: 8  },
  { name: 'Raj Provisions',  mobile: '9876543212', address: 'Station Road, #12',   total_orders_count: 5  },
  { name: 'Kumar Traders',   mobile: '9876543213', address: 'Market Street, #7',   total_orders_count: 15 },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Seed inventory
    await InventoryModel.deleteMany({});
    await InventoryModel.insertMany(spices);
    console.log(`✓ Seeded ${spices.length} inventory items`);

    // Seed shops (upsert by mobile)
    for (const shop of shops) {
      await ShopModel.findOneAndUpdate(
        { mobile: shop.mobile },
        { $setOnInsert: shop },
        { upsert: true }
      );
    }
    console.log(`✓ Seeded ${shops.length} shops`);

    // Seed users (skip if already exist)
    const adminExists = await UserModel.findOne({ username: 'admin' });
    if (!adminExists) {
      await UserModel.create([
        { username: 'admin', password: await bcrypt.hash('admin123', 10), role: 'admin' },
        { username: 'boy1',  password: await bcrypt.hash('pass123',  10), role: 'delivery_boy', name: 'Ravi Kumar' },
      ]);
      console.log('✓ Seeded users (admin/admin123, boy1/pass123)');
    } else {
      console.log('✓ Users already exist, skipping');
    }

    console.log('\nSeed complete. Credentials: admin/admin123 | boy1/pass123');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
