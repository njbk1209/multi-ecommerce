import React, { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useCurrency } from '../context/CurrencyContext'
import CartDrawer from './CartDrawer'

const CurrencyToggle = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center bg-rose-50 border border-rose-100 rounded-full p-0.5 text-xs font-semibold uppercase tracking-wider">
      <button
        onClick={() => setCurrency('USD')}
        className={`px-3 py-1 rounded-full transition-all duration-200 ${currency === 'USD'
          ? 'bg-rose-400 text-white shadow-sm'
          : 'text-rose-300 hover:text-rose-400'
          }`}
      >
        Dólar
      </button>
      <button
        onClick={() => setCurrency('BS')}
        className={`px-3 py-1 rounded-full transition-all duration-200 ${currency === 'BS'
          ? 'bg-rose-400 text-white shadow-sm'
          : 'text-rose-300 hover:text-rose-400'
          }`}
      >
        Bolivares
      </button>
    </div>
  );
};

const Navbar = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cart } = useCart();
  const { exchangeRate, store } = useCurrency();

  return (
    <>
      {/* Barra de tasa del día */}
      {exchangeRate && (
        <div className="w-full bg-rose-500 text-white text-xs text-center py-1.5 tracking-wide font-medium">
          💱 Tasa del día: <span className="font-bold">1 $ = {exchangeRate.toLocaleString('es-VE')} Bs</span>
        </div>
      )}

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-rose-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-2xl font-serif font-semibold text-rose-500 tracking-tight cursor-pointer">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store?.comercial_name || 'Logo'} className="h-8 w-auto object-contain" />
            ) : (
              <>
                {store?.comercial_name || 'Postrecito'}<span className="text-rose-300">.</span>
              </>
            )}
          </div>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
            <a href="#" className="hover:text-rose-400 transition-colors">Inicio</a>
            <a href="#catalogo" className="hover:text-rose-400 transition-colors">Catálogo</a>
            <a href="#nosotros" className="hover:text-rose-400 transition-colors">Nosotros</a>
          </div>

          <div className="flex items-center gap-3">
            <CurrencyToggle />
            <button
              onClick={() => setIsCartOpen(true)}
              className="p-2 text-gray-500 hover:text-rose-400 transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cart.length > 0 && (
                <span className="absolute top-1 right-1 bg-rose-400 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center animate-bounce">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <CartDrawer isOpen={isCartOpen} setIsOpen={setIsCartOpen} />
    </>
  )
}

export default Navbar