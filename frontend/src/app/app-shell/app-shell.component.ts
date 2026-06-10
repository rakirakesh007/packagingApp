import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { ToastOutletComponent } from '../services/toast-outlet.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastOutletComponent],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly loading = inject(GlobalLoadingService);

  /** Exposes auth role signal directly to the template. */
  userRole = this.auth.userRole;

  logout(): void {
    this.auth.logout();
  }
}
