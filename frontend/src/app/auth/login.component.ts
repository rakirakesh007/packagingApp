import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { GlobalLoadingService } from '../services/global-loading.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private loading = inject(GlobalLoadingService);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  isLoading = this.loading.isLoading;
  errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.errorMessage.set(null);
    this.loading.show();
    try {
      await this.authService.login(
        this.loginForm.value as { username: string; password: string }
      );
    } catch (err: unknown) {
      this.errorMessage.set('Invalid credentials. Please try again.');
    } finally {
      this.loading.hide();
    }
  }
}
