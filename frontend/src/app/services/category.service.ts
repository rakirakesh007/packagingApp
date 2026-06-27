import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: string;
  name: string;
  hindi_name: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);

  getAll(): Observable<Category[]> {
    return this.http.get<Category[]>('/categories');
  }

  add(name: string, hindi_name: string): Observable<Category> {
    return this.http.post<Category>('/categories', { name, hindi_name });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/categories/${id}`);
  }
}
