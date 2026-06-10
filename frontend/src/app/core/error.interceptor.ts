import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Global HTTP error handling:
 *  - 401 → session invalid/expired: clear auth state, return to login.
 *  - 403 → authenticated but not allowed: inform, stay on page.
 * Login-request failures are left to the login page's own error display.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = req.url.includes('/auth/login');

      if (error.status === 401 && !isLoginRequest) {
        toast.error('Session expired — please log in again.');
        auth.logout();
      } else if (error.status === 403 && !isLoginRequest) {
        toast.error("You don't have permission for that action.");
      }

      return throwError(() => error);
    })
  );
};
