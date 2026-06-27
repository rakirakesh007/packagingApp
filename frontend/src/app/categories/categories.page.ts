import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService, Category } from '../services/category.service';
import { GlobalLoadingService } from '../services/global-loading.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage implements OnInit {
  private categoryService = inject(CategoryService);
  private loading         = inject(GlobalLoadingService);
  private toast           = inject(ToastService);

  categories = signal<Category[]>([]);
  newName     = '';
  newHindi    = '';
  saving      = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.show();
    this.categoryService.getAll().subscribe({
      next:     (cats) => this.categories.set(cats),
      error:    (err)  => { console.error(err); this.loading.hide(); },
      complete: ()     => this.loading.hide(),
    });
  }

  add(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.saving.set(true);
    this.categoryService.add(name, this.newHindi.trim()).subscribe({
      next: (cat) => {
        this.categories.update((cs) => [...cs, cat].sort((a, b) => a.name.localeCompare(b.name)));
        this.newName  = '';
        this.newHindi = '';
        this.saving.set(false);
        this.toast.success(`Category "${cat.name}" added.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'Could not add category.');
      },
    });
  }

  delete(cat: Category): void {
    if (!confirm(`Delete category "${cat.name}"? Inventory items in this category will become uncategorized.`)) return;
    this.categoryService.delete(cat.id).subscribe({
      next: () => {
        this.categories.update((cs) => cs.filter((c) => c.id !== cat.id));
        this.toast.success(`"${cat.name}" deleted.`);
      },
      error: (err) => this.toast.error(err?.error?.message ?? 'Could not delete.'),
    });
  }
}
