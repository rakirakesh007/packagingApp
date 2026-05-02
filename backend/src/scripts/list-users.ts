import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice-app';

async function listUsers() {
  await mongoose.connect(MONGO_URI);
  const users = await UserModel.find({});
  console.log('Users:', users);
  await mongoose.disconnect();
}

listUsers();
