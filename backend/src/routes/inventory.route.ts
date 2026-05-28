import { Router, Request, Response } from 'express';
import { InventoryModel } from '../models/inventory.model';

const router = Router();

/** GET /inventory — list all items. */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await InventoryModel.find().sort({ item_name: 1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** POST /inventory — create a new inventory item. */
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await InventoryModel.create(req.body);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** PATCH /inventory/:id — update stock or fields. */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const item = await InventoryModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.json(item);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** DELETE /inventory/:id — remove an item. */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await InventoryModel.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.json({ message: 'Deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** GET /inventory/low-stock — items at or below threshold. */
router.get('/low-stock', async (_req: Request, res: Response) => {
  try {
    // available_stock = total_stock − reserved_stock; alert when it drops to or below threshold
    const items = await InventoryModel.find({
      $expr: { $lte: [{ $subtract: ['$total_stock', '$reserved_stock'] }, '$low_stock_threshold'] },
    });
    return res.json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
