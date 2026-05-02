import { Router, Request, Response } from 'express';
import { UserModel } from '../models/user.model';

const router = Router();

/** GET /users?role=delivery_boy — Fetch users by role (for assignment dropdowns). */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    const query = role ? { role: String(role) } : {};
    const users = await UserModel.find(query)
      .select('_id username role')
      .lean();
    // Return username as name for display in dropdowns
    return res.json(users.map((u) => ({ _id: u._id, name: u.username, role: u.role })));
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
