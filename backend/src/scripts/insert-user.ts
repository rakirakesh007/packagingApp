import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/user.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

async function insertUser() {
  await mongoose.connect(MONGO_URI);
  await UserModel.findOneAndUpdate(
    { username: 'rakesh' },
    {
      password: await bcrypt.hash('3010', 10),
      role: 'admin',
      mobile_number: '8050991832',
    },
    { upsert: true }
  );
  console.log('Inserted user rakesh (admin)');
  await mongoose.disconnect();
}

insertUser();
