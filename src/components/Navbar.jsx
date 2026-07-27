import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import CartDrawer from "./CartDrawer";

const CurrencyToggle = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center bg-primary-light border border-primary-light rounded-full p-0.5 text-xs font-semibold uppercase tracking-wider">
      <button
        onClick={() => setCurrency("USD")}
        className={`px-3 py-1 rounded-full transition-all duration-200 ${currency === "USD"
          ? "bg-primary text-white shadow-sm"
          : "text-primary-dark hover:text-primary"
          }`}
      >
        Dólar
      </button>
      <button
        onClick={() => setCurrency("BS")}
        className={`px-3 py-1 rounded-full transition-all duration-200 ${currency === "BS"
          ? "bg-primary text-white shadow-sm"
          : "text-primary-dark hover:text-primary"
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
        <div className="w-full bg-primary text-white text-xs text-center py-1.5 px-6 tracking-wide font-medium">
          💱 Tasa del día:{" "}
          <span className="font-bold">
            1 $ = {exchangeRate.toLocaleString("es-VE")} Bs
          </span>
        </div>
      )}

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-primary-light px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <a
            href="#inicio"
            className="flex items-center gap-2 text-2xl font-serif font-semibold text-primary tracking-tight"
          >
            {store?.logo_url ? (
              <img
                src={store.logo_url}
                alt={store?.comercial_name || "Logo"}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <>
                {store?.comercial_name}
                <span className="text-rose-300">.</span>
              </>
            )}
          </a>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
            <a href="#inicio" className="hover:text-primary transition-colors">
              Inicio
            </a>
            <a
              href="#catalogo"
              className="hover:text-primary transition-colors"
            >
              Catálogo
            </a>
            <a
              href="#nosotros"
              className="hover:text-primary transition-colors"
            >
              Nosotros
            </a>
          </div>

          <div className="flex items-center gap-3">
            <CurrencyToggle />
            <button
              onClick={() => setIsCartOpen(true)}
              className="p-2 text-gray-500 hover:text-primary transition-colors relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cart.length > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center animate-bounce">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <CartDrawer isOpen={isCartOpen} setIsOpen={setIsCartOpen} />
    </>
  );
};

export default Navbar;
