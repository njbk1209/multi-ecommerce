import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Hero from './sections/Hero'
import ProductList from './sections/ProductList'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import About from './sections/About'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'

// Componente para proteger las rutas administrativas de forma declarativa
const ProtectedRoute = ({ children, session }) => {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}

const ShopLayout = () => (
  <div>
    <Navbar />
    <Hero />
    <ProductList />
    <About />
    <Footer />
  </div>
)

const App = () => {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('postrecito_admin_session')
    return saved ? JSON.parse(saved) : null
  })

  const handleLogin = (email) => {
    const mockSession = { user: { email } }
    localStorage.setItem('postrecito_admin_session', JSON.stringify(mockSession))
    setSession(mockSession)
  }

  const handleLogout = () => {
    localStorage.removeItem('postrecito_admin_session')
    setSession(null)
  }

  return (
    <Routes>
      <Route path="/" element={<ShopLayout />} />
      <Route 
        path="/login" 
        element={<Login onLogin={handleLogin} session={session} />} 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute session={session}>
            <AdminDashboard onLogout={handleLogout} session={session} />
          </ProtectedRoute>
        } 
      />
      {/* Redirección por defecto para cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App