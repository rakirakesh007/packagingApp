/**
 * reset-dummy-data.ts
 * Drops inventories, sales, and loadings collections so the new
 * production-model schema starts from a clean slate.
 * Usage: npx ts-node src/scripts/reset-dummy-data.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const COLLECTIONS = ['inventories', 'sales', 'loadings'];

async function reset(): Promise<void> {
  const uri = process.env['MONGO_URI'] || 'mongodb://localhost:27017/spice_app';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB:', uri);

  for (const col of COLLECTIONS) {
    try {
      await mongoose.connection.db?.collection(col).drop();
      console.log(`🗑  Dropped: ${col}`);
    } catch {
      console.log(`⚠️  ${col} did not exist — skipped`);
    }
  }

  console.log('\n✅ Reset complete. Collections dropped:', COLLECTIONS.join(', '));
  await mongoose.disconnect();
}

reset().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
