import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/** Decoded JWT payload shape. */
interface JwtPayload {
  id: string;
  role: 'admin' | 'delivery_boy';
  /** Expiry as Unix seconds (set by the backend's 7d token). */
  exp?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Whether the current session is authenticated. */
  isAuthenticated = signal(false);
  /** Role of the currently logged-in user. */
  userRole = signal<'admin' | 'delivery_boy' | null>(null);
  /** MongoDB _id of the currently logged-in user. */
  userId = signal<string | null>(null);
  /** Raw JWT consumed by the auth interceptor. */
  token = signal<string | null>(localStorage.getItem('token'));

  constructor() {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      this._applyToken(storedToken);
    }
  }

  /** Authenticates user. Uses firstValueFrom instead of deprecated toPromise(). */
  async login(credentials: { username: string; password: string }): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ token: string }>('/auth/login', credentials)
    );
    this._applyToken(response.token);
    localStorage.setItem('token', response.token);
    const role = this.userRole();
    this.router.navigate([role === 'admin' ? '/app/admin' : '/app/sales']);
  }

  /** Clears all auth state and redirects to login. */
  logout(): void {
    this._clearState();
    this.router.navigate(['/login']);
  }

  /** Clears auth state without navigating (used during app init). */
  private _clearState(): void {
    this.isAuthenticated.set(false);
    this.userRole.set(null);
    this.userId.set(null);
    this.token.set(null);
    localStorage.removeItem('token');
  }

  /** Decodes a JWT and sets all auth signals. Expired tokens are discarded. */
  private _applyToken(rawToken: string): void {
    try {
      const payload = JSON.parse(atob(rawToken.split('.')[1])) as JwtPayload;
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        // Token already expired (7-day JWT) — treat as logged out.
        this._clearState();
        return;
      }
      this.token.set(rawToken);
      this.isAuthenticated.set(true);
      this.userRole.set(payload.role);
      this.userId.set(payload.id);
    } catch {
      this._clearState();
    }
  }
}
