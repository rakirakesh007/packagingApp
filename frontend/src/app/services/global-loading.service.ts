import { Injectable, signal } from '@angular/core';

/**
 * Global loading service — tracks in-flight API requests.
 * Exposes a read-only signal consumed by the AppShell spinner.
 * Handles Render's free-tier cold-start delays (E13).
 */
@Injectable({ providedIn: 'root' })
export class GlobalLoadingService {
  private _loading = signal(false);

  /** Read-only signal for template consumption. */
  readonly isLoading = this._loading.asReadonly();

  /** Increment / start loading state. */
  show(): void {
    this._loading.set(true);
  }

  /** Decrement / stop loading state. */
  hide(): void {
    this._loading.set(false);
  }
}
