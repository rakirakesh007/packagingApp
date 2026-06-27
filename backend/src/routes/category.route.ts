import { Router, Request, Response } from 'express';
import { CategoryModel } from '../models/category.model';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cats = await CategoryModel.find().sort({ name: 1 }).lean();
    return res.json(cats.map((c) => ({ id: String(c._id), name: c.name, hindi_name: c.hindi_name })));
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, hindi_name } = req.body as { name?: string; hindi_name?: string };
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
    const cat = await CategoryModel.create({ name: name.trim(), hindi_name: (hindi_name ?? '').trim() });
    return res.status(201).json({ id: String(cat._id), name: cat.name, hindi_name: cat.hindi_name });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ message: 'Category already exists' });
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await CategoryModel.findByIdAndDelete(req.params['id']);
    if (!result) return res.status(404).json({ message: 'Category not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
