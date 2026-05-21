import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AuthPage from './pages/AuthPage'
import AppPage from './pages/AppPage'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import ProtectedRoute from './components/ui/ProtectedRoute'
import { useStore } from './store/useStore'

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const location = useLocation()

  useEffect(() => {
    if (theme === 'light') document.body.classList.add('light')
    else document.body.classList.remove('light')
  }, [theme])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><AuthPage /></PageWrapper>} />
        <Route path="/app" element={<ProtectedRoute><PageWrapper><AppPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageWrapper><DashboardPage /></PageWrapper></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}