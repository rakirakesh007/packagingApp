import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

/** Renders active toasts. Place once in the app shell (and login page). */
@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class.toast--success]="toast.type === 'success'"
          [class.toast--error]="toast.type === 'error'"
          [class.toast--info]="toast.type === 'info'"
          (click)="toastService.dismiss(toast.id)"
        >
          <span class="toast__icon">
            {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ' }}
          </span>
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        bottom: calc(76px + env(safe-area-inset-bottom)); /* above mobile tab bar */
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        width: min(92vw, 420px);
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 16px;
        border-radius: 10px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        animation: toast-in 0.2s ease-out;
      }
      .toast--success { background: #16a34a; }
      .toast--error   { background: #dc2626; }
      .toast--info    { background: #2563eb; }
      .toast__icon { font-weight: 700; }
      @keyframes toast-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
})
export class ToastOutletComponent {
  toastService = inject(ToastService);
}
