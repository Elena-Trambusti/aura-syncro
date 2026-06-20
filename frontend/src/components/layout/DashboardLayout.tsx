import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { BRAND } from '../../lib/brand'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: BRAND.dark }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
