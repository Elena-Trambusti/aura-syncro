import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#181614]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-[#181614] via-[#1c1a17] to-[#1a1816]">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
