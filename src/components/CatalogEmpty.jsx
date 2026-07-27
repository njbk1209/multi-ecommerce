import React from 'react'
import { PackageX, AlertTriangle, SearchX, RefreshCw } from 'lucide-react'

const VARIANTS = {
  empty: {
    icon: PackageX,
    title: 'No hay productos disponibles',
    subtitle: 'Aún no se han agregado productos a esta tienda.',
    iconColor: 'text-rose-300',
  },
  noResults: {
    icon: SearchX,
    title: 'Sin resultados',
    subtitle: 'No encontramos productos que coincidan con tu búsqueda o filtros.',
    iconColor: 'text-amber-400',
  },
  error: {
    icon: AlertTriangle,
    title: 'Algo salió mal',
    subtitle: 'Ocurrió un error al cargar los productos. Por favor, intenta de nuevo.',
    iconColor: 'text-rose-500',
  },
}

const CatalogEmpty = ({
  variant = 'empty',
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const config = VARIANTS[variant] || VARIANTS.empty
  const Icon = config.icon
  const displayTitle = title || config.title
  const displaySubtitle = subtitle || config.subtitle

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-rose-100/60 blur-2xl scale-150" />
        <div className="relative w-20 h-20 rounded-2xl bg-white border border-rose-100 shadow-sm flex items-center justify-center">
          <Icon className={`w-9 h-9 ${config.iconColor}`} strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-1.5">
        {displayTitle}
      </h3>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
        {displaySubtitle}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-rose-200 text-rose-500 text-sm font-medium hover:bg-rose-50 transition-all duration-200 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default CatalogEmpty
