import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: string;
  role: 'admin' | 'delivery_boy';
  name?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// No insecure fallback: production refuses to boot without a real secret.
export const JWT_SECRET = process.env.JWT_SECRET ?? '';

export function assertJwtSecretConfigured(): void {
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
      process.exit(1);
    }
    console.warn('⚠️  JWT_SECRET is not set — using insecure dev default. Set it in backend/.env.');
  }
}

const effectiveSecret = (): string => JWT_SECRET || 'dev-only-secret';

/** 401 unless the request carries a valid Bearer JWT. Attaches { id, role } as req.auth. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), effectiveSecret()) as jwt.JwtPayload;
    req.auth = { id: String(payload.id), role: payload.role as AuthPayload['role'] };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/** 403 unless requireAuth ran and the user is an admin. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  return next();
}

/**
 * For routes carrying a :deliveryBoyId param: delivery boys may only access
 * their own data; admins may access anyone's.
 */
export function requireSelfOrAdmin(param: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.role === 'admin') return next();
    if (req.auth?.id === req.params[param]) return next();
    return res.status(403).json({ message: 'You can only access your own data.' });
  };
}

export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, effectiveSecret(), { expiresIn: '7d' });
}
