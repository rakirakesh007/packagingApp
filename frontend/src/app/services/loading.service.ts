import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private loading = signal(false);

  set(value: boolean) {
    this.loading.set(value);
  }

  get() {
    return this.loading();
  }
}