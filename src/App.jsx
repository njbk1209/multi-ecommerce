import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HeroCarousel from './sections/HeroCarousel'
import ProductList from './sections/ProductList'
import StoreFeatures from './components/StoreFeatures'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import About from './sections/About'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import { supabase } from './utils/supabase'
import { useCurrency } from './context/CurrencyContext'
import toast from 'react-hot-toast'

import ProductDetailPage from './pages/ProductDetailPage'

// Componente para proteger las rutas administrativas de forma declarativa
const ProtectedRoute = ({ children, session }) => {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}

const ShopLayout = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [hash]);

  return (
    <div>
      <Navbar />
      <section id="inicio">
        <HeroCarousel />
        <StoreFeatures />
      </section>
      <section id="catalogo">
        <ProductList />
      </section>
      <section id="nosotros">
        <About />
      </section>
      <Footer />
    </div>
  );
};

const App = () => {
  const [session, setSession] = useState(null)
  const { store } = useCurrency()

  const validateStoreAdmin = async (userId) => {
    if (!store?.id) return false
    try {
      const { data, error } = await supabase
        .from('store_user')
        .select('store_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !data) return false
      return data.store_id === store.id
    } catch (err) {
      return false
    }
  }

  useEffect(() => {
    const checkSession = async (currentSession) => {
      if (!store) return // Esperar a que la tienda esté cargada en el contexto antes de validar
      if (currentSession) {
        const isValid = await validateStoreAdmin(currentSession.user.id)
        if (isValid) {
          setSession(currentSession)
        } else {
          await supabase.auth.signOut()
          setSession(null)
          toast.error('Sesión cerrada: no tienes permisos para esta tienda.', {
            style: { background: '#18181b', color: '#fff', borderRadius: '12px' }
          })
        }
      } else {
        setSession(null)
      }
    }

    // 1. Obtener la sesión activa al cargar
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      checkSession(currentSession)
    })

    // 2. Escuchar cambios en la autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      checkSession(currentSession)
    })

    return () => subscription.unsubscribe()
  }, [store])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <Routes>
      <Route path="/" element={<ShopLayout />} />
      <Route path="/producto/:slug" element={<ProductDetailPage />} />
      <Route 
        path="/login" 
        element={<Login session={session} />} 
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