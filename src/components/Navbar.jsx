import React, { useState, Fragment } from "react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import CartDrawer from "./CartDrawer";
import { Menu, X, Home, Compass, Info, ShoppingBag } from "lucide-react";
import { Transition, Dialog } from "@headlessui/react";

const CurrencyToggle = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center bg-primary-light border border-primary-light rounded-full p-0.5 text-xs font-semibold uppercase tracking-wider">
      <button
        onClick={() => setCurrency("USD")}
        className={`px-2.5 sm:px-3 py-1 rounded-full transition-all duration-200 ${currency === "USD"
          ? "bg-primary text-white shadow-sm"
          : "text-primary-dark hover:text-primary"
          }`}
      >
        Dólar
      </button>
      <button
        onClick={() => setCurrency("BS")}
        className={`px-2.5 sm:px-3 py-1 rounded-full transition-all duration-200 ${currency === "BS"
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-primary-light px-4 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {/* Fila Superior (Middlebar): Logo Centrado */}
          <div className="flex justify-center items-center py-1">
            <a
              href="#inicio"
              className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-serif font-bold text-primary tracking-tight text-center"
            >
              {store?.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store?.comercial_name || "Logo"}
                  className="h-9 sm:h-11 w-auto object-contain"
                />
              ) : (
                <span>{store?.comercial_name}</span>
              )}
            </a>
          </div>

          {/* Fila Inferior: Izquierda (3-bars en móvil / Enlaces en desktop) | Derecha (Tasa + Carrito) */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            {/* Izquierda: Botón Hamburguesa 3 barras (móvil) / Enlaces (desktop) */}
            <div className="flex items-center">
              {/* Botón 3 barras Móvil */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-slate-700 hover:text-primary transition-colors rounded-lg hover:bg-primary-light/50 active:scale-95"
                title="Abrir menú"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Enlaces de Navegación (Desktop) */}
              <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-700 uppercase tracking-widest">
                <a
                  href="#inicio"
                  className="hover:text-primary transition-colors py-1"
                >
                  Inicio
                </a>
                <a
                  href="#catalogo"
                  className="hover:text-primary transition-colors py-1"
                >
                  Catálogo
                </a>
                <a
                  href="#nosotros"
                  className="hover:text-primary transition-colors py-1"
                >
                  Nosotros
                </a>
              </div>
            </div>

            {/* Derecha: Selector de Moneda + Botón Carrito */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              <CurrencyToggle />
              <button
                onClick={() => setIsCartOpen(true)}
                className="p-2 text-slate-600 hover:text-primary transition-colors relative active:scale-95"
                title="Ver carrito"
              >
                <ShoppingBag className="h-6 w-6" />
                {cart.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-bounce shadow-xs">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menú Desplegable Móvil (Drawer Lateral) */}
      <Transition.Root show={isMobileMenuOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50 md:hidden"
          onClose={setIsMobileMenuOpen}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="-translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-xs bg-white shadow-2xl flex flex-col justify-between">
                    <div>
                      {/* Header del Menú Móvil */}
                      <div className="flex items-center justify-between p-5 border-b border-primary-light bg-primary-light/20">
                        <span className="text-sm font-bold font-serif text-primary-dark uppercase tracking-wider">
                          Menú
                        </span>
                        <button
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-primary-dark hover:bg-primary-light/50 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Enlaces del Menú Móvil */}
                      <div className="p-4 space-y-1">
                        <a
                          href="#inicio"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-primary-light/40 hover:text-primary transition-all"
                        >
                          <Home className="w-4 h-4 text-primary" />
                          Inicio
                        </a>
                        <a
                          href="#catalogo"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-primary-light/40 hover:text-primary transition-all"
                        >
                          <Compass className="w-4 h-4 text-primary" />
                          Catálogo
                        </a>
                        <a
                          href="#nosotros"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-primary-light/40 hover:text-primary transition-all"
                        >
                          <Info className="w-4 h-4 text-primary" />
                          Nosotros
                        </a>
                      </div>
                    </div>

                    {/* Footer del Menú Móvil */}
                    <div className="p-5 border-t border-slate-100 bg-slate-50 text-center">
                      <p className="text-xs text-slate-400 font-medium">
                        {store?.comercial_name}
                      </p>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <CartDrawer isOpen={isCartOpen} setIsOpen={setIsCartOpen} />
    </>
  );
};

export default Navbar;
