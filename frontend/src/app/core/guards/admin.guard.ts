import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

/**
 * Restricts a route to admins. Delivery boys are sent to their sales page
 * (the backend enforces this server-side too — this guard is UX, not security).
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.userRole() === 'admin') {
    return true;
  }
  return router.createUrlTree([auth.isAuthenticated() ? '/app/sales' : '/login']);
};
