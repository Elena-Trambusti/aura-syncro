/**
 * Restaurant of the Future — Software Gestionale per Ristoranti
 * Copyright (c) 2026 Elena Trambusti. Tutti i diritti riservati.
 * Contatto: elenatrambusti2024@gmail.com
 * Software proprietario e riservato. Vedere LICENSE per i dettagli.
 * CONFIDENZIALE — NON DISTRIBUIRE
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import TablesPage from './pages/TablesPage'
import OrdersPage from './pages/OrdersPage'
import MenuPage from './pages/MenuPage'
import ReservationsPage from './pages/ReservationsPage'
import CustomersPage from './pages/CustomersPage'
import StaffPage from './pages/StaffPage'
import InventoryPage from './pages/InventoryPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import LoyaltyPage from './pages/LoyaltyPage'
import MarketingPage from './pages/MarketingPage'
import ReportsPage from './pages/ReportsPage'
import KitchenDisplayPage from './pages/KitchenDisplayPage'
import PublicMenuPage from './pages/PublicMenuPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import PaymentsPage from './pages/PaymentsPage'
import AIPage from './pages/AIPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Caricamento...</p>
        </div>
      </div>
    )
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      {/* Pagine pubbliche senza auth */}
      <Route path="/menu/:slug" element={<PublicMenuPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
      {/* KDS - Kitchen Display (auth richiesta) */}
      <Route path="/cucina" element={<ProtectedRoute><KitchenDisplayPage /></ProtectedRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tavoli" element={<TablesPage />} />
        <Route path="ordini" element={<OrdersPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="prenotazioni" element={<ReservationsPage />} />
        <Route path="clienti" element={<CustomersPage />} />
        <Route path="personale" element={<StaffPage />} />
        <Route path="magazzino" element={<InventoryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="fedelta" element={<LoyaltyPage />} />
        <Route path="marketing" element={<MarketingPage />} />
        <Route path="report" element={<ReportsPage />} />
        <Route path="pagamenti" element={<PaymentsPage />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="impostazioni" element={<SettingsPage />} />
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
