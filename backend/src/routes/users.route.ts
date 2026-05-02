import { Router, Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * GET /users — list users.
 * Supports query params: role, isActive
 * e.g. GET /users?role=delivery_boy&isActive=true
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: Record<string, unknown> = {};
    if (req.query['role'])     query['role']     = String(req.query['role']);
    if (req.query['isActive'] !== undefined)
      query['isActive'] = req.query['isActive'] === 'true';

    const users = await UserModel.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** POST /users — create a new delivery boy (admin only). */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, password, name, mobile_number } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      username,
      password: hashed,
      role: 'delivery_boy',
      name:          name          || '',
      mobile_number: mobile_number || '',
      isActive: true,
    });
    const { password: _p, ...safe } = user.toObject();
    return res.status(201).json(safe);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const isDupe = typeof msg === 'string' && msg.includes('duplicate key');
    return res.status(isDupe ? 409 : 400).json({ message: isDupe ? 'Username already exists.' : msg });
  }
});

/** PATCH /users/:id — update name, mobile_number, isActive, password. */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, mobile_number, isActive, password } = req.body;
    const update: Record<string, unknown> = {};
    if (name          !== undefined) update['name']          = name;
    if (mobile_number !== undefined) update['mobile_number'] = mobile_number;
    if (isActive      !== undefined) update['isActive']      = isActive;
    if (password) update['password'] = await bcrypt.hash(password, 10);

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select('-password').lean();

    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/** DELETE /users/:id — remove a delivery boy. */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ message: 'Deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
