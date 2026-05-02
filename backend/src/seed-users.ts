import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from './models/user.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

async function seedUsers() {
  await mongoose.connect(MONGO_URI);
  await UserModel.deleteMany({});
  await UserModel.create([
    {
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
    },
    {
      username: 'boy1',
      password: await bcrypt.hash('pass123', 10),
      role: 'delivery_boy',
    },
  ]);
  console.log('Seeded admin and delivery boy users.');
  await mongoose.disconnect();
}

seedUsers();
