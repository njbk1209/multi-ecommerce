import React from 'react'
import { Truck, ShieldCheck, Headphones, CreditCard } from 'lucide-react'

const FEATURES = [
  {
    id: 1,
    icon: Truck,
    title: 'Envíos a Domicilio',
    description: 'Despacho rápido o retiro en tienda',
  },
  {
    id: 2,
    icon: ShieldCheck,
    title: 'Garantía de Calidad',
    description: 'Productos 100% certificados',
  },
  {
    id: 3,
    icon: Headphones,
    title: 'Atención Directa',
    description: 'Asesoría vía WhatsApp',
  },
  {
    id: 4,
    icon: CreditCard,
    title: 'Pagos Flexibles',
    description: 'Dólares y Bolívares al cambio',
  },
]

const StoreFeatures = () => {
  return (
    <section className="w-full py-4 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {FEATURES.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.id}
                className="bg-white/80 backdrop-blur-sm border border-primary-light/80 p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col items-center text-center gap-3 group"
              >
                <div className="p-3 rounded-2xl bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.75} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 font-serif tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default StoreFeatures
