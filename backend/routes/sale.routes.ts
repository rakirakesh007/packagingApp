import express from 'express';
import Sale from '../models/sale.model';
import Assignment from '../models/assignment.model';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// POST / - Create a new sale
router.post('/', authMiddleware, async (req, res) => {
  const { customer_name, items, total_amount, payment_mode, delivery_boy_id } = req.body;

  try {
    for (const item of items) {
      const assignment = await Assignment.findOne({
        delivery_boy_id,
        'items.item_id': item.item_id,
      });

      if (!assignment) {
        return res.status(400).json({ message: `No assignment found for item ID: ${item.item_id}` });
      }

      const assignedItem = assignment.items.find((i) => i.item_id.toString() === item.item_id);

      if (!assignedItem || assignedItem.qty < item.qty) {
        return res.status(400).json({
          message: `Insufficient assigned stock for item ID: ${item.item_id}`,
        });
      }
    }

    // Proceed with Sale creation
    const newSale = new Sale({
      customer_name,
      items,
      total_amount,
      payment_mode,
      delivery_boy_id,
    });
    const savedSale = await newSale.save();

    res.status(201).json(savedSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// GET /history/:delivery_boy_id - Fetch sales made by a specific boy today
router.get('/history/:delivery_boy_id', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sales = await Sale.find({
      delivery_boy_id: req.params.delivery_boy_id,
      timestamp: { $gte: today },
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;