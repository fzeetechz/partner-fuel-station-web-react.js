import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAppStore } from "../../store";
import { Auth } from "../../features/auth/Auth";
import { PartnerLayout } from "../../features/live/Layout";
import {
  Overview,
  FuelPricing,
  InventoryPage,
  StationOrders,
  AuthorizationsPage,
  DevicesPage,
  TransactionsPage,
  SettlementsPage,
  ReportsPage,
  WalletPage,
  NotificationsPage,
  SupportPage,
} from "../../features/live/Operations";
import { StationProfile, AccountSettings } from "../../features/live/Profile";
import { PrivateFilesPage } from "../../features/live/Files";
import { DispensePage } from "../../features/live/Dispense";
function Protected() {
  const session = useAppStore((s) => s.session);
  const location = useLocation();
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  );
}
export function Router() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <Routes>
      <Route path="/auth/:mode/:token?" element={<Auth />} />
      <Route element={<Protected />}>
        <Route element={<PartnerLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Overview />} />
          <Route path="stations" element={<StationProfile />} />
          <Route path="fuel-prices" element={<FuelPricing />} />
          <Route path="orders" element={<StationOrders />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="dispense" element={<DispensePage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="pos-devices" element={<DevicesPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="invoices" element={<TransactionsPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="settings" element={<AccountSettings />} />
          <Route path="files" element={<PrivateFilesPage />} />
          <Route path="staff" element={<Navigate to="/stations" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
