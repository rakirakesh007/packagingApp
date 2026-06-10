import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from './models/user.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

// Credentials come from env — never hardcode production passwords.
//   ADMIN_USERNAME (default: admin)
//   ADMIN_PASSWORD (required)
// Delivery boys are created afterwards via the admin → Delivery Boys page.
async function seedUsers() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('❌ Set ADMIN_PASSWORD (and optionally ADMIN_USERNAME) before running:');
    console.error('   ADMIN_PASSWORD=yourStrongPassword npx ts-node src/seed-users.ts');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  // Upsert instead of wiping the collection — safe to run on a live database.
  await UserModel.findOneAndUpdate(
    { username },
    {
      username,
      password: await bcrypt.hash(password, 10),
      role: 'admin',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`✅ Admin user "${username}" created/updated.`);
  console.log('   Add delivery boys from the admin → Delivery Boys page.');
  await mongoose.disconnect();
}

seedUsers();
