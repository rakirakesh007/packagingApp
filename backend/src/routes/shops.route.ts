import { Router, Request, Response } from 'express';
import { ShopModel } from '../models/shop.model';

const router = Router();

/** GET /shops — list all shops (admin marketing view). */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const shops = await ShopModel.find().sort({ total_orders_count: -1 });
    return res.json(shops);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** GET /shops/search?mobile=xxx — find shop by mobile (for checkout pre-fill). */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ message: 'mobile query param required.' });
    const shop = await ShopModel.findOne({ mobile: String(mobile) });
    return res.json(shop ?? null);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** POST /shops — create a new shop. */
router.post('/', async (req: Request, res: Response) => {
  try {
    const shop = await ShopModel.create(req.body);
    return res.status(201).json(shop);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
