import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/** Decoded JWT payload shape. */
interface JwtPayload {
  id: string;
  role: 'admin' | 'delivery_boy';
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
    this.isAuthenticated.set(false);
    this.userRole.set(null);
    this.userId.set(null);
    this.token.set(null);
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  /** Decodes a JWT and sets all auth signals. */
  private _applyToken(rawToken: string): void {
    try {
      const payload = JSON.parse(atob(rawToken.split('.')[1])) as JwtPayload;
      this.token.set(rawToken);
      this.isAuthenticated.set(true);
      this.userRole.set(payload.role);
      this.userId.set(payload.id);
    } catch {
      this.logout();
    }
  }
}
