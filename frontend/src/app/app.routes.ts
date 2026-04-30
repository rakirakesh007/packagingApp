import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.page').then(
        (m) => m.AdminDashboardPage
      ),
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./inventory/inventory.page').then((m) => m.InventoryPage),
  },
  {
    path: 'assignment',
    loadComponent: () =>
      import('./assignment/assignment.page').then((m) => m.AssignmentPage),
  },
  {
    path: 'billing',
    loadComponent: () =>
      import('./billing/billing.page').then((m) => m.BillingPage),
  },
  {
    path: 'bulk-entry',
    loadComponent: () =>
      import('./admin-bulk-entry/admin-bulk-entry.component').then(
        (m) => m.AdminBulkEntryComponent
      ),
  },
  {
    path: 'eod-report',
    loadComponent: () =>
      import('./eod-report/eod-report.component').then(
        (m) => m.EodReportComponent
      ),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];