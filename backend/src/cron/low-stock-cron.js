import cron from 'node-cron';
import { InventoryModel } from '../models/inventory.model';

// Schedule a task to run every day at 8 AM
cron.schedule('0 8 * * *', async () => {
  try {
    const lowStockItems = await InventoryModel.find({
      total_stock: { $lte: '$low_stock_threshold' },
    });

    console.log('Low Stock Items:', lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
  }
});