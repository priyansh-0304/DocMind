import { Navigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export default function ProtectedRoute({ children }) {
  const token = useStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}