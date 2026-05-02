import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GlobalLoadingService } from '../services/global-loading.service';
import { User } from '../services/assignment.service';

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './users-admin.page.html',
  styleUrls: ['./users-admin.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminPage implements OnInit {
  private http    = inject(HttpClient);
  private loading = inject(GlobalLoadingService);
  private fb      = inject(FormBuilder);

  users       = signal<User[]>([]);
  showAddForm = signal(false);
  editingId   = signal<string | null>(null);
  errorMsg    = signal<string | null>(null);
  successMsg  = signal<string | null>(null);

  activeCount   = computed(() => this.users().filter((u) => u.isActive).length);
  inactiveCount = computed(() => this.users().filter((u) => !u.isActive).length);

  addForm = this.fb.group({
    name:          ['', Validators.required],
    username:      ['', [Validators.required, Validators.minLength(3)]],
    password:      ['', [Validators.required, Validators.minLength(6)]],
    mobile_number: [''],
  });

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.loading.show();
    this.http.get<User[]>('/users?role=delivery_boy').subscribe({
      next:     (data) => this.users.set(data),
      error:    (err)  => { console.error(err); this.loading.hide(); },
      complete: ()     => this.loading.hide(),
    });
  }

  openAddForm(): void {
    this.addForm.reset();
    this.errorMsg.set(null);
    this.showAddForm.set(true);
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    this.errorMsg.set(null);
  }

  submitAdd(): void {
    if (this.addForm.invalid) return;
    this.loading.show();
    this.errorMsg.set(null);
    this.http.post<User>('/users', this.addForm.value).subscribe({
      next: (created) => {
        this.users.update((u) => [created, ...u]);
        this.showAddForm.set(false);
        this.addForm.reset();
        this.loading.hide();
        this.showSuccess('Delivery boy added successfully.');
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Failed to create user.');
        this.loading.hide();
      },
    });
  }

  toggleActive(user: User): void {
    const next = !user.isActive;
    this.http.patch<User>(`/users/${user._id}`, { isActive: next }).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u._id === updated._id ? updated : u))
        );
        this.showSuccess(`${user.name || user.username} marked as ${next ? 'Active' : 'Inactive'}.`);
      },
      error: (err) => console.error(err),
    });
  }

  deleteUser(user: User): void {
    if (!confirm(`Delete "${user.name || user.username}"? This cannot be undone.`)) return;
    this.loading.show();
    this.http.delete(`/users/${user._id}`).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u._id !== user._id));
        this.loading.hide();
        this.showSuccess('User deleted.');
      },
      error: (err) => { console.error(err); this.loading.hide(); },
    });
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
