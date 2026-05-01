import { Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/components/layout/admin-layout";
import { LoginPage } from "@/features/auth/login-page";
import { RedirectIfAuthed, RequireAuth } from "@/features/auth/require-auth";
import { CategoriesPage } from "@/features/categories/categories-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { InsightsPage } from "@/features/insights/insights-page";
import { InvestmentsPage } from "@/features/investments/investments-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TransactionsPage } from "@/features/transactions/transactions-page";

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
