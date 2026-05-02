import { Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required.' });
  }
  const user = await UserModel.findOne({ username });
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });
  if (user.isActive === false) {
    return res.status(403).json({ message: 'Account is deactivated. Contact your admin.' });
  }
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { username: user.username, role: user.role } });
}
