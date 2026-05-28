import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MarketingOverview, MarketingTemplate } from '../models/marketing.model';

@Injectable({ providedIn: 'root' })
export class MarketingService {
  private http = inject(HttpClient);

  getOverview(month: number, year: number) {
    return this.http.get<MarketingOverview>(`/admin/marketing/overview?month=${month}&year=${year}`);
  }

  createTemplate(payload: Partial<MarketingTemplate>) {
    return this.http.post<MarketingTemplate>('/admin/marketing/templates', payload);
  }

  updateTemplate(id: string, payload: Partial<MarketingTemplate>) {
    return this.http.patch<MarketingTemplate>(`/admin/marketing/templates/${id}`, payload);
  }

  markTemplateUsed(id: string) {
    return this.http.post<MarketingTemplate>(`/admin/marketing/templates/${id}/use`, {});
  }

  deleteTemplate(id: string) {
    return this.http.delete<{ message: string }>(`/admin/marketing/templates/${id}`);
  }
}
