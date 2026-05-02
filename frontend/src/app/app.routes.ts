import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./app-shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      // ── Admin routes ────────────────────────────────────────────────────
      {
        path: 'admin',
        loadComponent: () =>
          import('./admin-dashboard/admin-dashboard.page').then((m) => m.AdminDashboardPage),
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
        path: 'bulk-entry',
        loadComponent: () =>
          import('./admin-bulk-entry/admin-bulk-entry.component').then(
            (m) => m.AdminBulkEntryComponent
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./expense/expense.page').then((m) => m.ExpensePage),
      },
      {
        path: 'eod-report',
        loadComponent: () =>
          import('./eod-report/eod-report.component').then((m) => m.EodReportComponent),
      },
      // ── Delivery Boy routes ─────────────────────────────────────────────
      {
        path: 'sales',
        loadComponent: () =>
          import('./sales-cart/sales-cart.page').then((m) => m.SalesCartPage),
      },
      {
        path: 'daily-report',
        loadComponent: () =>
          import('./daily-sales/daily-sales.page').then((m) => m.DailySalesPage),
      },
      // ── Legacy billing redirect ─────────────────────────────────────────
      { path: 'billing', redirectTo: 'sales', pathMatch: 'full' },
      { path: '', redirectTo: 'admin', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
