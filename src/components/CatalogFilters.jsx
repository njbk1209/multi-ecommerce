import React, { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Tag, Percent, DollarSign, PackageCheck, SlidersHorizontal, RotateCcw, Sparkles } from 'lucide-react'
import HierarchicalVehicleTree from './HierarchicalVehicleTree'

const CatalogFilters = ({
  isOpen,
  onClose,
  categoryTree = [],
  promotions = [],
  filters,
  onFiltersChange,
  onApply,
  onClear,
}) => {
  // Local state mirrors parent filters until "Aplicar" is pressed
  const [local, setLocal] = useState({ ...filters })

  // Sync local state when filters prop changes or drawer opens
  useEffect(() => {
    if (filters) {
      setLocal({ ...filters })
    }
  }, [filters, isOpen])

  const toggleCategory = (catName) => {
    setLocal(prev => {
      const currentCats = prev.categories || []
      const cats = currentCats.includes(catName)
        ? currentCats.filter(c => c !== catName)
        : [...currentCats, catName]
      return { ...prev, categories: cats }
    })
  }

  const handleApply = () => {
    onFiltersChange(local)
    if (onApply) onApply()
    if (onClose) onClose()
  }

  const handleClear = () => {
    const cleared = {
      categories: [],
      hasDiscount: false,
      selectedPromoId: '',
      priceMin: '',
      priceMax: '',
      inStockOnly: false,
      vehicle: { marcaId: '', modeloId: '', generacionId: '' },
    }
    setLocal(cleared)
    onFiltersChange(cleared)
    if (onClear) onClear()
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop con desenfoque */}
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-primary-light/10 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-2xl">
                    {/* Header del Drawer */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-primary-light">
                      <Dialog.Title className="text-xl font-serif font-semibold text-primary-dark flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-primary" />
                        Filtros de Búsqueda
                      </Dialog.Title>
                      <button
                        onClick={onClose}
                        className="text-primary hover:text-primary-dark hover:rotate-90 transition-all p-1 rounded-lg"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Cuerpo del Drawer (Scrollable) */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                      
                      {/* 🚗 FILTRO DE VEHÍCULO JERÁRQUICO (DE PRIMERO) */}
                      <div>
                        <HierarchicalVehicleTree
                          vehicleFilter={local.vehicle || { marcaId: '', modeloId: '', generacionId: '' }}
                          onChange={(newVeh) => setLocal(prev => ({ ...prev, vehicle: newVeh }))}
                          onClear={() => setLocal(prev => ({ ...prev, vehicle: { marcaId: '', modeloId: '', generacionId: '' } }))}
                        />
                      </div>
                      <div>
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-dark mb-3.5">
                          <Tag className="w-4 h-4 text-primary" />
                          Categorías
                        </h4>
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {categoryTree.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Sin categorías</p>
                          ) : (
                            categoryTree.map((cat) => (
                              <label
                                key={cat.id}
                                className="flex items-center gap-2.5 cursor-pointer group py-1"
                                style={{ paddingLeft: `${cat.depth * 14}px` }}
                              >
                                <input
                                  type="checkbox"
                                  checked={(local.categories || []).includes(cat.name)}
                                  onChange={() => toggleCategory(cat.name)}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary-dark transition-colors"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-primary-dark transition-colors">
                                  {cat.depth > 0 && <span className="text-gray-300 mr-1 font-mono">↳</span>}
                                  {cat.name}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Descuentos y Promociones Dinámicas */}
                      <div className="pt-2 border-t border-gray-100 space-y-3">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-dark">
                          <Percent className="w-4 h-4 text-primary" />
                          Ofertas & Promociones
                        </h4>
                        <label className="flex items-center gap-3 cursor-pointer group transition-all">
                          <input
                            type="checkbox"
                            checked={local.hasDiscount || false}
                            onChange={(e) => setLocal(prev => ({ ...prev, hasDiscount: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary-dark transition-colors"
                          />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-primary-dark transition-colors">
                            Solo productos en oferta o con promoción
                          </span>
                        </label>

                        {/* Lista de Promociones Creadas en el Admin */}
                        {promotions && promotions.length > 0 && (
                          <div className="pt-2 space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              Promociones Específicas:
                            </label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                              <button
                                type="button"
                                onClick={() => setLocal(prev => ({ ...prev, selectedPromoId: '' }))}
                                className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                  !local.selectedPromoId
                                    ? 'bg-primary-light text-primary-dark font-bold border border-primary'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                              >
                                Todas las promociones
                              </button>
                              {promotions.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setLocal(prev => ({ ...prev, selectedPromoId: p.id }))}
                                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                                    String(local.selectedPromoId) === String(p.id)
                                      ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  }`}
                                >
                                  <span className="truncate">{p.nombre}</span>
                                  <span className="text-[9px] bg-amber-200/60 px-1.5 py-0.5 rounded font-mono shrink-0">
                                    {p.tipo === 'campana' ? '🎉 Evento' : '📦 Volumen'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rango de Precios */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-dark mb-3.5">
                          <DollarSign className="w-4 h-4 text-primary" />
                          Rango de Precio (USD)
                        </h4>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[11px] text-gray-400 mb-1 block">Precio mínimo</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={local.priceMin || ''}
                              onChange={(e) => setLocal(prev => ({ ...prev, priceMin: e.target.value }))}
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>
                          <span className="text-gray-400 text-sm shrink-0 mt-5">—</span>
                          <div className="flex-1">
                            <label className="text-[11px] text-gray-400 mb-1 block">Precio máximo</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Sin límite"
                              value={local.priceMax || ''}
                              onChange={(e) => setLocal(prev => ({ ...prev, priceMax: e.target.value }))}
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Disponibilidad */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-dark mb-3.5">
                          <PackageCheck className="w-4 h-4 text-primary" />
                          Disponibilidad
                        </h4>
                        <label className="flex items-center gap-3 cursor-pointer transition-all">
                          <input
                            type="checkbox"
                            checked={local.inStockOnly || false}
                            onChange={(e) => setLocal(prev => ({ ...prev, inStockOnly: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary-dark transition-colors"
                          />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-primary-dark transition-colors">
                            Solo productos disponibles en stock
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Footer / Botones de acción */}
                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 flex items-center justify-between gap-3">
                      <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-200/50 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Limpiar
                      </button>
                      <button
                        onClick={handleApply}
                        className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-xl transition-all duration-200 active:scale-95 shadow-md shadow-primary-light text-center"
                      >
                        Aplicar Filtros
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default CatalogFilters
