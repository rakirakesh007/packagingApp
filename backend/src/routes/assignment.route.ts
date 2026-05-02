import { Router, Request, Response } from 'express';
import { LoadingModel } from '../models/loading.model';
import { InventoryModel } from '../models/inventory.model';

const router = Router();

/**
 * POST /assignment — Create a morning loading assignment for a delivery boy.
 */
router.post('/', async (req: Request, res: Response) => {
  const { delivery_boy_id, items } = req.body;

  if (!delivery_boy_id || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'delivery_boy_id and items are required.' });
  }

  try {
    const assignment = await LoadingModel.create({
      delivery_boy_id,
      date: new Date(),
      items: items.map((i: { item_id: string; qty: number }) => ({
        item_id: i.item_id,
        qty: i.qty,
      })),
    });
    return res.status(201).json(assignment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/**
 * GET /assignment/active/:deliveryBoyId — Get today's active assignment.
 */
router.get('/active/:deliveryBoyId', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

    const assignment = await LoadingModel.findOne({
      delivery_boy_id: req.params.deliveryBoyId,
      date: { $gte: start, $lte: end },
    }).populate('items.item_id');

    if (!assignment) {
      return res.status(404).json({ message: 'No active assignment found for today.' });
    }

    return res.json(assignment);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
