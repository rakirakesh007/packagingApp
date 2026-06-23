import { Router, Request, Response } from 'express';
import { ExpenseModel } from '../models/expense.model';

const router = Router();

/** GET /expenses — List expenses, optionally scoped to a month via ?month=1-12&year=YYYY. */
router.get('/', async (req: Request, res: Response) => {
  try {
    const month = req.query['month'] ? parseInt(String(req.query['month']), 10) : null;
    const year  = req.query['year']  ? parseInt(String(req.query['year']), 10)  : null;

    let filter = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1); // first day of next month (exclusive)
      filter = { date: { $gte: start, $lt: end } };
    }

    const expenses = await ExpenseModel.find(filter).sort({ date: -1 });
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

/** PUT /expenses/:id — Update an existing expense. */
router.put('/:id', async (req: Request, res: Response) => {
  const { category, amount, description, date } = req.body;
  try {
    const update: Record<string, unknown> = {};
    if (category !== undefined)    update['category']    = category;
    if (amount !== undefined)      update['amount']      = amount;
    if (description !== undefined) update['description'] = description;
    if (date !== undefined)        update['date']        = new Date(date);

    const updated = await ExpenseModel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ message: 'Expense not found.' });
    return res.json(updated);
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
