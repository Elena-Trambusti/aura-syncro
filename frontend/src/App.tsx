/**
 * Aura Syncro  Software Gestionale per Ristoranti
 * Copyright (c) 2026 Elena Trambusti. Tutti i diritti riservati.
 * Contatto: elenatrambusti2024@gmail.com
 * Software proprietario e riservato. Vedere LICENSE per i dettagli.
 * CONFIDENZIALE  NON DISTRIBUIRE
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Suspense, lazy, useLayoutEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { isDemoUserEmail } from './lib/demoAccounts'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import LandingRoute from './components/landing/LandingRoute'
import RequireRole from './components/auth/RequireRole'
import RequireProPlan from './components/auth/RequireProPlan'
import RequirePermission from './components/auth/RequirePermission'
import DashboardAccessGate from './components/auth/DashboardAccessGate'
import AuthLoadingScreen from './components/auth/AuthLoadingScreen'
import PwaRegistrar from './components/PwaRegistrar'
import { CookieBanner } from './components/landing/CookieBanner'
import { ADMIN_NAV_ROLES, STAFF_MANAGE_ROLES } from './lib/rbac'

const PricingPage = lazy(() => import('./pages/PricingPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const CookiePage = lazy(() => import('./pages/CookiePage'))
const DPAPage = lazy(() => import('./pages/DPAPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const GuestPrivacyPage = lazy(() => import('./pages/GuestPrivacyPage'))
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TablesPage = lazy(() => import('./pages/TablesPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const MenuPage = lazy(() => import('./pages/MenuPage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))
const CrmPage = lazy(() => import('./pages/CrmPage'))
const StaffPage = lazy(() => import('./pages/StaffPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage'))
const MarketingPage = lazy(() => import('./pages/MarketingPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const ReportFiscal = lazy(() => import('./pages/ReportFiscal'))
const KitchenDisplayPage = lazy(() => import('./pages/KitchenDisplayPage'))
const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'))
const PublicReservationPage = lazy(() => import('./pages/PublicReservationPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'))
const PaymentDepositSuccessPage = lazy(() => import('./pages/PaymentDepositSuccessPage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const AIPredictivePage = lazy(() => import('./pages/AIPredictivePage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const CashDrawerPage = lazy(() => import('./pages/CashDrawerPage'))
const QRBuilderPage = lazy(() => import('./pages/QRBuilderPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const PlatformAdminPage = lazy(() => import('./pages/PlatformAdminPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <AuthLoadingScreen />
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const location = useLocation()

  useLayoutEffect(() => {
    if (user && isDemoUserEmail(user.email)) {
      logout()
    }
  }, [user, logout])

  if (isLoading) return <AuthLoadingScreen />
  if (user && !isDemoUserEmail(user.email)) {
    const from = (location.state as { from?: string } | null)?.from
    const target = from && from !== '/login' ? from : '/dashboard'
    return <Navigate to={target} replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/prezzi" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<Navigate to="/termini" replace />} />
      <Route path="/termini" element={<TermsPage />} />
      <Route path="/cookie" element={<CookiePage />} />
      <Route path="/dpa" element={<DPAPage />} />
      <Route path="/informativa-ospiti" element={<GuestPrivacyPage />} />
      <Route path="/contatti" element={<ContactPage />} />
      <Route path="/platform-admin" element={<PlatformAdminPage />} />
      {/* Pagine pubbliche senza auth */}
      <Route path="/menu/:slug" element={<PublicMenuPage />} />
      <Route path="/prenota/:slug" element={<PublicReservationPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
      <Route path="/payment/deposit-success" element={<PaymentDepositSuccessPage />} />
      {/* KDS  stesso sbarramento tier della dashboard */}
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
      <Route path="/it" element={<LandingRoute forceLang="it"><LandingPage /></LandingRoute>} />
      <Route path="/es" element={<LandingRoute forceLang="es"><LandingPage /></LandingRoute>} />
      <Route path="/es-cn" element={<LandingRoute forceLang="es-cn"><LandingPage /></LandingRoute>} />
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
        <Route path="cassa" element={<RequirePermission permissions={['orders.pay']}><CashDrawerPage /></RequirePermission>} />
        <Route path="menu" element={<RequirePermission permissions={['menu.read']}><MenuPage /></RequirePermission>} />
        <Route path="prenotazioni" element={<RequirePermission permissions={['reservations.read']}><ReservationsPage /></RequirePermission>} />
        <Route path="crm" element={<RequireProPlan><RequirePermission permissions={['customers.read']}><CrmPage /></RequirePermission></RequireProPlan>} />
        <Route path="clienti" element={<Navigate to="/crm" replace />} />
        <Route path="personale" element={<Navigate to="/dashboard/staff" replace />} />
        <Route path="dashboard/onboarding" element={<OnboardingPage />} />
        <Route path="dashboard/billing" element={<BillingPage />} />
        <Route path="dashboard/staff" element={<RequireRole roles={STAFF_MANAGE_ROLES}><StaffPage /></RequireRole>} />
        <Route path="magazzino" element={<RequirePermission permissions={['inventory.read']}><InventoryPage /></RequirePermission>} />
        <Route path="analytics" element={<RequireProPlan><RequirePermission permissions={['analytics.read']}><AnalyticsPage /></RequirePermission></RequireProPlan>} />
        <Route path="fedelta" element={<RequireProPlan><RequirePermission permissions={['loyalty.manage']}><LoyaltyPage /></RequirePermission></RequireProPlan>} />
        <Route path="marketing" element={<RequireProPlan><RequirePermission permissions={['marketing.manage']}><MarketingPage /></RequirePermission></RequireProPlan>} />
        <Route path="report" element={<Outlet />}>
          <Route index element={<RequirePermission permissions={['reports.read']}><ReportsPage /></RequirePermission>} />
          <Route path="fiscal" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><ReportFiscal /></RequireProPlan></RequireRole>} />
        </Route>
        <Route path="pagamenti" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><PaymentsPage /></RequireProPlan></RequireRole>} />
        <Route path="fatture" element={<RequireRole roles={ADMIN_NAV_ROLES}><RequireProPlan><InvoicesPage /></RequireProPlan></RequireRole>} />
        <Route path="dashboard/ai-predictive" element={<RequireProPlan><RequirePermission permissions={['analytics.read']}><AIPredictivePage /></RequirePermission></RequireProPlan>} />
        <Route path="dashboard/qr-builder" element={<RequirePermission permissions={['menu.manage']}><QRBuilderPage /></RequirePermission>} />
        <Route path="ai" element={<Navigate to="/dashboard/ai-predictive" replace />} />
        <Route path="impostazioni" element={<RequireRole roles={ADMIN_NAV_ROLES}><SettingsPage /></RequireRole>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PwaRegistrar />
        <CookieBanner />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
// Force Vercel Deploy
