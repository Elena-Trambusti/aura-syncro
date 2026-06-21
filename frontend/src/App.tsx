/**
 * Aura Syncro — Software Gestionale per Ristoranti
 * Copyright (c) 2026 Elena Trambusti. Tutti i diritti riservati.
 * Contatto: elenatrambusti2024@gmail.com
 * Software proprietario e riservato. Vedere LICENSE per i dettagli.
 * CONFIDENZIALE — NON DISTRIBUIRE
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import TablesPage from './pages/TablesPage'
import OrdersPage from './pages/OrdersPage'
import MenuPage from './pages/MenuPage'
import ReservationsPage from './pages/ReservationsPage'
import CrmPage from './pages/CrmPage'
import StaffPage from './pages/StaffPage'
import InventoryPage from './pages/InventoryPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import LoyaltyPage from './pages/LoyaltyPage'
import MarketingPage from './pages/MarketingPage'
import ReportsPage from './pages/ReportsPage'
import ReportFiscal from './pages/ReportFiscal'
import KitchenDisplayPage from './pages/KitchenDisplayPage'
import PublicMenuPage from './pages/PublicMenuPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import PaymentsPage from './pages/PaymentsPage'
import AIPredictivePage from './pages/AIPredictivePage'
import CheckoutPage from './pages/CheckoutPage'
import BillingPage from './pages/BillingPage'
import QRBuilderPage from './pages/QRBuilderPage'
import OnboardingPage from './pages/OnboardingPage'
import RequireRole from './components/auth/RequireRole'
import RequireProPlan from './components/auth/RequireProPlan'
import RequirePermission from './components/auth/RequirePermission'
import DashboardAccessGate from './components/auth/DashboardAccessGate'
import AuthLoadingScreen from './components/auth/AuthLoadingScreen'
import { ADMIN_NAV_ROLES, STAFF_MANAGE_ROLES } from './lib/rbac'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <AuthLoadingScreen />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <AuthLoadingScreen />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      {/* Pagine pubbliche senza auth */}
      <Route path="/menu/:slug" element={<PublicMenuPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
      {/* KDS — stesso sbarramento tier della dashboard */}
      <Route
        path="/cucina"
        element={
          <ProtectedRoute>
            <DashboardAccessGate>
              <KitchenDisplayPage />
            </DashboardAccessGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardAccessGate>
              <DashboardLayout />
            </DashboardAccessGate>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tavoli" element={<TablesPage />} />
        <Route path="checkout/:orderId" element={<RequirePermission permissions={['orders.pay']}><CheckoutPage /></RequirePermission>} />
        <Route path="ordini" element={<OrdersPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="prenotazioni" element={<ReservationsPage />} />
        <Route path="crm" element={<RequireProPlan><CrmPage /></RequireProPlan>} />
        <Route path="clienti" element={<Navigate to="/crm" replace />} />
        <Route path="personale" element={<Navigate to="/dashboard/staff" replace />} />
        <Route path="dashboard/onboarding" element={<OnboardingPage />} />
        <Route path="dashboard/billing" element={<BillingPage />} />
        <Route path="dashboard/staff" element={<RequireRole roles={STAFF_MANAGE_ROLES}><StaffPage /></RequireRole>} />
        <Route path="magazzino" element={<InventoryPage />} />
        <Route path="analytics" element={<RequireProPlan><AnalyticsPage /></RequireProPlan>} />
        <Route path="fedelta" element={<RequireProPlan><LoyaltyPage /></RequireProPlan>} />
        <Route path="marketing" element={<RequireProPlan><MarketingPage /></RequireProPlan>} />
        <Route path="report" element={<Outlet />}>
          <Route index element={<ReportsPage />} />
          <Route path="fiscal" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><ReportFiscal /></RequireProPlan></RequireRole>} />
        </Route>
        <Route path="pagamenti" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><PaymentsPage /></RequireProPlan></RequireRole>} />
        <Route path="dashboard/ai-predictive" element={<RequireProPlan><AIPredictivePage /></RequireProPlan>} />
        <Route path="dashboard/qr-builder" element={<QRBuilderPage />} />
        <Route path="ai" element={<Navigate to="/dashboard/ai-predictive" replace />} />
        <Route path="impostazioni" element={<RequireRole roles={ADMIN_NAV_ROLES}><SettingsPage /></RequireRole>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
