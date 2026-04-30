import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  isAuthenticated = signal(false);
  userRole = signal<'admin' | 'delivery_boy' | null>(null);

  login(credentials: { username: string; password: string }) {
    return this.http.post<{ token: string }>(`/auth/login`, credentials).toPromise().then((response) => {
      if (!response) throw new Error('No response from server');
      const token = response.token;
      const payload = JSON.parse(atob(token.split('.')[1]));

      this.isAuthenticated.set(true);
      this.userRole.set(payload.role);

      localStorage.setItem('token', token);
      this.router.navigate([payload.role === 'admin' ? '/admin' : '/delivery']);
    });
  }

  logout() {
    this.isAuthenticated.set(false);
    this.userRole.set(null);
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}