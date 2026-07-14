import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const Login = ({ onLogin, session }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Redirigir si ya tiene sesión
  React.useEffect(() => {
    if (session) {
      navigate('/admin')
    }
  }, [session, navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)

    // Simular retraso de red para dar experiencia realista
    setTimeout(() => {
      if (email.trim() === 'admin@postrecito.com' && password === 'admin123') {
        toast.success('¡Sesión iniciada correctamente!', {
          icon: '🔑',
          style: {
            background: '#18181b',
            color: '#fff',
            borderRadius: '12px'
          }
        })
        onLogin(email)
        navigate('/admin')
      } else {
        toast.error('Credenciales inválidas. Usa admin@postrecito.com / admin123', {
          style: {
            background: '#18181b',
            color: '#fff',
            borderRadius: '12px'
          }
        })
      }
      setLoading(false)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center px-4 font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* Botón Volver */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors font-semibold flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a la Tienda
      </Link>

      {/* Tarjeta de Login */}
      <div className="w-full max-w-[400px] bg-white rounded-3xl border border-zinc-200/80 shadow-sm p-8 md:p-10 space-y-8">
        
        {/* Encabezado */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-serif text-zinc-900 tracking-tight">
            Postrecito<span className="text-zinc-400">.</span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            Panel de Control
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <input 
              type="email" 
              required
              placeholder="nombre@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 outline-none text-sm transition-all bg-zinc-50/50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                Contraseña
              </label>
            </div>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 outline-none text-sm transition-all bg-zinc-50/50"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold tracking-wide shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:bg-zinc-400 disabled:scale-100 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>

        {/* Demo Creds */}
        <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4 text-[11px] text-zinc-500 leading-relaxed text-center font-medium">
          🔒 <span className="font-bold text-zinc-700">Acceso de prueba:</span><br />
          Email: <code className="bg-zinc-200/60 px-1 py-0.5 rounded font-mono text-zinc-800">admin@postrecito.com</code><br />
          Contraseña: <code className="bg-zinc-200/60 px-1 py-0.5 rounded font-mono text-zinc-800">admin123</code>
        </div>

      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">
          &copy; {new Date().getFullYear()} Postrecito Admin Panel
        </p>
      </div>

    </div>
  )
}

export default Login
