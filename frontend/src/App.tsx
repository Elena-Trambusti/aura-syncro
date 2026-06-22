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
import PricingPage from './pages/PricingPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
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
import PublicReservationPage from './pages/PublicReservationPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import PaymentDepositSuccessPage from './pages/PaymentDepositSuccessPage'
import PaymentsPage from './pages/PaymentsPage'
import AIPredictivePage from './pages/AIPredictivePage'
import CheckoutPage from './pages/CheckoutPage'
import BillingPage from './pages/BillingPage'
import QRBuilderPage from './pages/QRBuilderPage'
import OnboardingPage from './pages/OnboardingPage'
import PlatformAdminPage from './pages/PlatformAdminPage'
import LandingPage from './pages/LandingPage'
import LandingRoute from './components/landing/LandingRoute'
import RequireRole from './components/auth/RequireRole'
import RequireProPlan from './components/auth/RequireProPlan'
import RequirePermission from './components/auth/RequirePermission'
import DashboardAccessGate from './components/auth/DashboardAccessGate'
import AuthLoadingScreen from './components/auth/AuthLoadingScreen'
import PwaRegistrar from './components/PwaRegistrar'
import { ADMIN_NAV_ROLES, STAFF_MANAGE_ROLES } from './lib/rbac'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <AuthLoadingScreen />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <AuthLoadingScreen />
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/prezzi" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/termini" element={<TermsPage />} />
      <Route path="/platform-admin" element={<PlatformAdminPage />} />
      {/* Pagine pubbliche senza auth */}
      <Route path="/menu/:slug" element={<PublicMenuPage />} />
      <Route path="/prenota/:slug" element={<PublicReservationPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
      <Route path="/payment/deposit-success" element={<PaymentDepositSuccessPage />} />
      {/* KDS — stesso sbarramento tier della dashboard */}
      <Route
        path="/cucina"
        element={
          <ProtectedRoute>
            <DashboardAccessGate>
              <RequirePermission permissions={['orders.read']}>
                <KitchenDisplayPage />
              </RequirePermission>
            </DashboardAccessGate>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<LandingRoute><LandingPage /></LandingRoute>} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardAccessGate>
              <DashboardLayout />
            </DashboardAccessGate>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="tavoli" element={<RequirePermission permissions={['tables.read']}><TablesPage /></RequirePermission>} />
        <Route path="checkout/:orderId" element={<RequirePermission permissions={['orders.pay']}><CheckoutPage /></RequirePermission>} />
        <Route path="ordini" element={<RequirePermission permissions={['orders.read']}><OrdersPage /></RequirePermission>} />
        <Route path="menu" element={<RequirePermission permissions={['menu.read']}><MenuPage /></RequirePermission>} />
        <Route path="prenotazioni" element={<RequirePermission permissions={['reservations.read']}><ReservationsPage /></RequirePermission>} />
        <Route path="crm" element={<RequireProPlan><CrmPage /></RequireProPlan>} />
        <Route path="clienti" element={<Navigate to="/crm" replace />} />
        <Route path="personale" element={<Navigate to="/dashboard/staff" replace />} />
        <Route path="dashboard/onboarding" element={<OnboardingPage />} />
        <Route path="dashboard/billing" element={<BillingPage />} />
        <Route path="dashboard/staff" element={<RequireRole roles={STAFF_MANAGE_ROLES}><StaffPage /></RequireRole>} />
        <Route path="magazzino" element={<RequirePermission permissions={['inventory.read']}><InventoryPage /></RequirePermission>} />
        <Route path="analytics" element={<RequireProPlan><AnalyticsPage /></RequireProPlan>} />
        <Route path="fedelta" element={<RequireProPlan><LoyaltyPage /></RequireProPlan>} />
        <Route path="marketing" element={<RequireProPlan><MarketingPage /></RequireProPlan>} />
        <Route path="report" element={<Outlet />}>
          <Route index element={<RequirePermission permissions={['reports.read']}><ReportsPage /></RequirePermission>} />
          <Route path="fiscal" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><ReportFiscal /></RequireProPlan></RequireRole>} />
        </Route>
        <Route path="pagamenti" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><PaymentsPage /></RequireProPlan></RequireRole>} />
        <Route path="dashboard/ai-predictive" element={<RequireProPlan><AIPredictivePage /></RequireProPlan>} />
        <Route path="dashboard/qr-builder" element={<RequirePermission permissions={['menu.manage']}><QRBuilderPage /></RequirePermission>} />
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
        <PwaRegistrar />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
