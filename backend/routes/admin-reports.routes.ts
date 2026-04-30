import express from 'express';
import Assignment from '../models/assignment.model';
import Sale from '../models/sale.model';
import Expense from '../models/expense.model';

const router = express.Router();

// GET /admin/reports/eod - EOD Summary
router.get('/eod', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignments = await Assignment.aggregate([
      { $match: { timestamp: { $gte: today } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$delivery_boy_id',
          openingStock: { $sum: '$items.qty' },
        },
      },
    ]);

    const sales = await Sale.aggregate([
      { $match: { timestamp: { $gte: today } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$delivery_boy_id',
          sold: { $sum: '$items.qty' },
          cashCollected: { $sum: '$total_amount' },
        },
      },
    ]);

    const eodSummary = assignments.map((assignment) => {
      const sale = sales.find((s) => s._id.toString() === assignment._id.toString());
      return {
        delivery_boy_id: assignment._id,
        openingStock: assignment.openingStock,
        sold: sale ? sale.sold : 0,
        remaining: assignment.openingStock - (sale ? sale.sold : 0),
        cashCollected: sale ? sale.cashCollected : 0,
      };
    });

    res.json(eodSummary);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// GET /admin/reports/monthly - Monthly Summary
router.get('/monthly', async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sales = await Sale.aggregate([
      { $match: { timestamp: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total_amount' },
        },
      },
    ]);

    const expenses = await Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
        },
      },
    ]);

    const totalSales = sales[0]?.totalSales || 0;
    const totalExpenses = expenses[0]?.totalExpenses || 0;

    res.json({
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

export default router;