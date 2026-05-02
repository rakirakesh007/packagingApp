import { Router, Request, Response } from 'express';
import { ExpenseModel } from '../models/expense.model';

const router = Router();

/** GET /expenses — List all expenses. */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const expenses = await ExpenseModel.find().sort({ date: -1 });
    return res.json(expenses);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** POST /expenses — Create a new expense entry. */
router.post('/', async (req: Request, res: Response) => {
  const { category, amount, description, date } = req.body;
  if (!category || amount == null) {
    return res.status(400).json({ message: 'category and amount are required.' });
  }
  try {
    const expense = await ExpenseModel.create({
      category,
      amount,
      description,
      date: date ? new Date(date) : new Date(),
    });
    return res.status(201).json(expense);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

/** DELETE /expenses/:id — Delete an expense by ID. */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await ExpenseModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Expense not found.' });
    return res.json({ message: 'Deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message });
  }
});

export default router;
