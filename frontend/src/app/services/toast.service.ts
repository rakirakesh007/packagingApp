import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Lightweight signal-based toast notifications.
 * Rendered once by ToastOutletComponent in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;

  /** Active toasts, newest last. */
  toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push(message, 'success');
  }

  error(message: string): void {
    this.push(message, 'error', 5000);
  }

  info(message: string): void {
    this.push(message, 'info');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(message: string, type: Toast['type'], durationMs = 3000): void {
    const toast: Toast = { id: ++this.nextId, message, type };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}
