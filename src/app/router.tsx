import { Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/components/layout/admin-layout";
import { LoginPage } from "@/features/auth/login-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { InvestmentsPage } from "@/features/investments/investments-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TransactionsPage } from "@/features/transactions/transactions-page";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="investments" element={<InvestmentsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
