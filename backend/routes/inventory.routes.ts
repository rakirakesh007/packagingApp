import express from 'express';
import Inventory from '../models/inventory.model';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// GET / - Fetch all items
router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await Inventory.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// POST / - Add new spice product (Admin only)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const newItem = new Inventory(req.body);
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error });
  }
});

// PATCH /:id - Update stock or prices (Admin only)
router.patch('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error });
  }
});

// PATCH /:id/deduct - Deduct stock during a sale
router.patch('/:id/deduct', authMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;
    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $inc: { total_stock: -quantity } },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error });
  }
});

export default router;