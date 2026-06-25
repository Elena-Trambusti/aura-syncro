import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthLoadingScreen from '../auth/AuthLoadingScreen'

export default function LandingRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <AuthLoadingScreen />
  return <>{children}</>
}
