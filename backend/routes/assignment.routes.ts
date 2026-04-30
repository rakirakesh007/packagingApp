import express from 'express';
import Assignment from '../models/assignment.model';
import Inventory from '../models/inventory.model';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// POST / - Create new assignment
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  const { delivery_boy_id, items } = req.body;

  try {
    // Deduct stock from inventory
    for (const item of items) {
      const updatedItem = await Inventory.findByIdAndUpdate(
        item.item_id,
        { $inc: { total_stock: -item.qty } },
        { new: true }
      );

      if (!updatedItem || updatedItem.total_stock < 0) {
        return res.status(400).json({
          message: `Insufficient stock for item ID: ${item.item_id}`,
        });
      }
    }

    // Create assignment
    const newAssignment = new Assignment({
      delivery_boy_id,
      items,
    });
    const savedAssignment = await newAssignment.save();

    res.status(201).json(savedAssignment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// GET /active/:delivery_boy_id - Fetch active assignment for a delivery boy
router.get('/active/:delivery_boy_id', authMiddleware, async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      delivery_boy_id: req.params.delivery_boy_id,
      status: 'Active',
    }).populate('items.item_id');

    if (!assignment) {
      return res.status(404).json({ message: 'No active assignment found' });
    }

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;