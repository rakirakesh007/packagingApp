import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    // Public customer storefront — no auth, shareable link.
    path: 'customer',
    loadComponent: () =>
      import('./customer-store/customer-store.page').then((m) => m.CustomerStorePage),
  },
  {
    path: 'label-sheet',
    loadComponent: () =>
      import('./label-sheet/label-sheet.component').then((m) => m.LabelSheetComponent),
    canActivate: [authGuard, adminGuard],
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
        canActivate: [adminGuard],
      },
      {
        path: 'marketing',
        loadComponent: () =>
          import('./marketing-dashboard/marketing-dashboard.page').then((m) => m.MarketingDashboardPage),
        canActivate: [adminGuard],
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./inventory/inventory.page').then((m) => m.InventoryPage),
        canActivate: [adminGuard],
      },
      {
        // Picker for a mixed label sheet. Lives inside the app shell (unlike
        // /label-sheet, which sits outside it so printing has no nav chrome).
        path: 'label-picker',
        loadComponent: () =>
          import('./label-picker/label-picker.page').then((m) => m.LabelPickerPage),
        canActivate: [adminGuard],
      },
      {
        path: 'assignment',
        loadComponent: () =>
          import('./assignment/assignment.page').then((m) => m.AssignmentPage),
        canActivate: [adminGuard],
      },
      {
        path: 'bulk-entry',
        loadComponent: () =>
          import('./admin-bulk-entry/admin-bulk-entry.component').then(
            (m) => m.AdminBulkEntryComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./expense/expense.page').then((m) => m.ExpensePage),
        canActivate: [adminGuard],
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./admin-reports/admin-reports.page').then((m) => m.AdminReportsPage),
        canActivate: [adminGuard],
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users-admin/users-admin.page').then((m) => m.UsersAdminPage),
        canActivate: [adminGuard],
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
