import React, { Fragment, useState, useEffect, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, ShoppingBag, Check, AlertCircle, Tag, ShieldCheck, Truck, Plus, Minus, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCart } from '../context/CartContext'
import { useCurrency } from '../context/CurrencyContext'
import { supabase } from '../utils/supabase'
import { sortBranchesByProximity } from '../utils/geo'

const ProductDetailModal = ({ isOpen, onClose, product }) => {
  const { addToCart } = useCart()
  const { isBS, currency, exchangeRate, store } = useCurrency()

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState({}) // Key: group_id, Value: Array of option objects
  const [comment, setComment] = useState('')

  const [sucursales, setSucursales] = useState([])
  const [selectedSucursalId, setSelectedSucursalId] = useState('')
  const [branchStockList, setBranchStockList] = useState([])
  const [geoLoading, setGeoLoading] = useState(false)

  // Cargar sucursales activas de esta tienda estrictamente por store.id
  useEffect(() => {
    if (!isOpen || !store?.id) return
    const fetchSucursales = async () => {
      try {
        const { data, error } = await supabase
          .from('sucursal')
          .select('*')
          .eq('store_id', store.id)
          .eq('is_active', true)
          .order('es_principal', { ascending: false })
          .order('nombre', { ascending: true })

        if (!error && data) {
          setSucursales(data)
          // Si hay 1 sola sucursal, asignarla directamente; si hay más de 1, requerir selección si no se ha geolocalizado
          if (data.length === 1) {
            setSelectedSucursalId(data[0].id.toString())
          } else {
            setSelectedSucursalId('')
          }
        }
      } catch (err) {
        console.error('Error al cargar sucursales en ProductDetailModal:', err)
      }
    }
    fetchSucursales()
  }, [isOpen, store?.id])

  // Cargar disponibilidad de stock por sucursal para este producto
  useEffect(() => {
    if (!isOpen || !product?.id || !store?.id) return
    const fetchStockByBranch = async () => {
      try {
        const { data, error } = await supabase
          .from('producto_stock_sucursal')
          .select('*, sucursal(*)')
          .eq('producto_id', product.id)

        if (!error && data) {
          setBranchStockList(data)
        }
      } catch (err) {
        console.error('Error al cargar stock por sucursal:', err)
      }
    }
    fetchStockByBranch()
  }, [isOpen, product?.id, store?.id])

  useEffect(() => {
    if (!isOpen || !product) return
    setSelectedImageIndex(0)
    setQuantity(1)
    setSelectedOptions({})
    setComment('')
  }, [isOpen, product])

  // Geolocalizar y asignar la sucursal más cercana
  const handleGeolocateBranch = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const sorted = sortBranchesByProximity(sucursales, coords)
        setSucursales(sorted)
        if (sorted.length > 0) {
          setSelectedSucursalId(sorted[0].id.toString())
          toast.success(`📍 Asignada la sucursal más cercana: ${sorted[0].nombre}`)
        }
        setGeoLoading(false)
      },
      (err) => {
        console.error(err)
        setGeoLoading(false)
        toast.error('No se pudo obtener la ubicación GPS.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Todos los Hooks deben ejecutarse antes de cualquier early return
  if (!isOpen || !product) return null

  const selectedSucursalObj = sucursales.find((s) => s.id.toString() === selectedSucursalId) || null

  const isOutOfStock = (product.stock ?? 0) <= 0
  const images = product.images?.length ? product.images : []
  const currentImage = images[selectedImageIndex]?.image || product.image || null

  const isNew = () => {
    if (!product.date_added && !product.created_at) return false
    const date = product.date_added || product.created_at
    const diffDays = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }

  const optionGroups = product.optionGroups || []
  const hasModifiers = product.hasModifiers || optionGroups.length > 0
  const precioPorTamano = product.precio_por_tamano

  // Agrupar sucursales y su stock por Ciudad (ordenados por sucursal)
  const sortedSucursales = [...sucursales].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '')
  )

  const stockByCity = sortedSucursales.reduce((acc, suc) => {
    const city = suc.ciudad?.trim() || 'Ciudad Principal'
    if (!acc[city]) acc[city] = []

    const stockItem = branchStockList.find((b) => b.sucursal_id === suc.id)
    const stockQty = stockItem ? stockItem.stock : (product?.stock ?? 0)
    const isAvailable = stockItem ? stockItem.stock_status : (stockQty > 0)

    acc[city].push({
      id: suc.id,
      nombre: suc.nombre,
      direccion: suc.direccion,
      stock: stockQty,
      isAvailable,
    })

    return acc
  }, {})

  // Selector de opciones
  const handleOptionSelect = (group, value) => {
    setSelectedOptions((prev) => {
      const currentSelection = prev[group.id] || []
      const price_modifier = parseFloat(value.modificador_precio) || 0
      const price_compare_modifier = value.modificador_precio_comparacion
        ? parseFloat(value.modificador_precio_comparacion)
        : null

      if (group.es_multiple) {
        const exists = currentSelection.some((item) => item.id === value.id)
        const updated = exists
          ? currentSelection.filter((item) => item.id !== value.id)
          : [
            ...currentSelection,
            {
              value_id: value.id,
              id: value.id,
              nombre: value.nombre,
              grupo: group.nombre,
              price_modifier,
              price_compare_modifier,
            },
          ]
        return { ...prev, [group.id]: updated }
      } else {
        return {
          ...prev,
          [group.id]: [
            {
              value_id: value.id,
              id: value.id,
              nombre: value.nombre,
              grupo: group.nombre,
              price_modifier,
              price_compare_modifier,
            },
          ],
        }
      }
    })
  }

  // Comprobar opciones obligatorias
  const isMissingRequiredSelections = () => {
    for (const group of optionGroups) {
      if (group.es_obligatorio) {
        const selection = selectedOptions[group.id] || []
        if (selection.length === 0) return true
      }
    }
    return false
  }

  // Cálculo de precio
  const basePrice = precioPorTamano ? 0 : parseFloat(product.price) || 0
  const baseComparePrice = precioPorTamano ? 0 : parseFloat(product.compare_price) || 0
  const selectedOptionsFlat = Object.values(selectedOptions).flat()

  const modifiersTotal = selectedOptionsFlat.reduce(
    (sum, opt) => sum + (parseFloat(opt.price_modifier) || 0),
    0
  )
  const unitPriceUSD = basePrice + modifiersTotal

  const modifiersCompareTotal = selectedOptionsFlat.reduce((sum, opt) => {
    const compVal = opt.price_compare_modifier !== null && opt.price_compare_modifier !== undefined
      ? opt.price_compare_modifier
      : opt.price_modifier
    return sum + (parseFloat(compVal) || 0)
  }, 0)

  const unitComparePriceUSD = (baseComparePrice > 0 || selectedOptionsFlat.some(o => o.price_compare_modifier !== null))
    ? (baseComparePrice || basePrice) + modifiersCompareTotal
    : null

  const exchange = exchangeRate || 1
  const unitPriceBS = unitPriceUSD * exchange
  const unitComparePriceBS = unitComparePriceUSD ? unitComparePriceUSD * exchange : null

  const activeUnitPrice = isBS ? unitPriceBS : unitPriceUSD
  const activeComparePrice = isBS ? unitComparePriceBS : unitComparePriceUSD
  const symbol = isBS ? 'Bs' : '$'

  const formatPrice = (val) =>
    val != null
      ? val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00'

  const handleAddToCart = () => {
    if (isMissingRequiredSelections() || isOutOfStock) return

    if (sucursales.length > 1 && !selectedSucursalId) {
      toast.error('Por favor selecciona una sucursal para tu producto.')
      return
    }

    const productData = {
      id: product.id,
      name: product.name,
      stock: product.stock,
      price: unitPriceUSD,
      compare_price: unitComparePriceUSD,
      price_bs: unitPriceBS,
      compare_price_bs: unitComparePriceBS,
      image: currentImage,
      precio_por_tamano: product.precio_por_tamano,
      optionGroups: product.optionGroups,
      ciudad: selectedSucursalObj?.ciudad || product.ciudad,
      sucursal_id: selectedSucursalObj?.id,
      sucursal: selectedSucursalObj,
      sku: product.sku || null,
      barcode: product.barcode || product.codigo_barra || null,
      codigo_barra: product.codigo_barra || product.barcode || null,
    }
    const success = addToCart(productData, selectedOptionsFlat, comment, quantity)
    if (success !== false) {
      onClose()
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Overlay Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-0 md:p-6 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel className="relative w-full min-h-screen md:min-h-0 md:h-auto max-w-4xl transform overflow-hidden rounded-none md:rounded-3xl bg-white text-left shadow-2xl transition-all border-0 md:border border-primary-light my-0 md:my-8 flex flex-col justify-between">
                {/* Botón de Cierre */}
                <button
                  onClick={onClose}
                  className="fixed md:absolute top-4 right-4 z-40 p-2 rounded-full bg-white/90 hover:bg-white text-gray-600 hover:text-primary-dark backdrop-blur-md shadow-md transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 flex-1">
                  {/* COLUMNA IZQUIERDA: GALERÍA DE IMÁGENES Y BADGES */}
                  <div className="bg-gray-50 p-4 md:p-6 flex flex-col justify-between relative border-b md:border-b-0 md:border-r border-gray-100">
                    {/* Badges superiores */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 items-start">
                      {isNew() && !isOutOfStock && (
                        <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md tracking-wider uppercase">
                          ¡Nuevo!
                        </span>
                      )}
                      {product.discount_percent > 0 && !isOutOfStock && (
                        <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md tracking-wider">
                          -{product.discount_percent}% OFF
                        </span>
                      )}
                    </div>

                    {/* Visor de Imagen Principal */}
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white shadow-inner flex items-center justify-center">
                      {currentImage ? (
                        <img
                          src={currentImage}
                          alt={product.name}
                          className="w-full h-full object-cover transition-all duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-300 gap-2">
                          <Tag className="w-12 h-12 stroke-1" />
                          <span className="text-xs">Sin imagen</span>
                        </div>
                      )}

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                          <span className="bg-red-500 text-white px-5 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase shadow-lg">
                            Agotado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selector de Miniaturas */}
                    {images.length > 1 && (
                      <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 custom-scrollbar justify-center">
                        {images.map((img, idx) => (
                          <button
                            key={img.id || idx}
                            onClick={() => setSelectedImageIndex(idx)}
                            className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${selectedImageIndex === idx
                              ? 'border-primary ring-2 ring-primary/20 scale-105'
                              : 'border-gray-200 opacity-70 hover:opacity-100'
                              }`}
                          >
                            <img src={img.image} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* COLUMNA DERECHA: INFORMACIÓN DEL PRODUCTO Y OPCIONES */}
                  <div className="p-6 md:p-8 flex flex-col justify-between max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                      {/* Categoría y SKU */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-widest text-primary font-semibold bg-primary-light px-3 py-1 rounded-full">
                          {product.category || 'Varios'}
                        </span>
                        {product.sku && (
                          <span className="text-xs text-gray-400 font-mono">
                            Ref: {product.sku}
                          </span>
                        )}
                      </div>

                      {/* Título */}
                      <h2 className="text-2xl sm:text-xl font-bold text-gray-800 font-serif leading-tight">
                        {product.name}
                      </h2>

                      {/* Descripción */}
                      {product.description && (
                        <div>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {product.description}
                          </p>
                        </div>
                      )}

                      {/* Precio y Moneda */}
                      <div className="flex items-baseline gap-3 py-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                          {precioPorTamano && 'Desde '}
                          {formatPrice(activeUnitPrice)} {symbol}
                        </span>

                        {activeComparePrice && activeComparePrice > activeUnitPrice && (
                          <span className="text-base text-gray-400 line-through">
                            {formatPrice(activeComparePrice)} {symbol}
                          </span>
                        )}

                        {!isBS && exchangeRate && (
                          <span className="text-xs text-gray-400 ml-auto bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                            ≈ {(unitPriceUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                          </span>
                        )}
                      </div>



                      {/* BLOQUE DE ACCIÓN: SELECTOR DE SUCURSAL, CANTIDAD Y BOTÓN AGREGAR AL CARRITO */}
                      <div className="pt-3 border-t border-gray-100 space-y-3.5">
                        {/* Selector de Sucursal */}
                        {sucursales.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-primary" />
                                Elige la sucursal
                              </label>
                              {sucursales.length > 1 && (
                                <button
                                  type="button"
                                  onClick={handleGeolocateBranch}
                                  disabled={geoLoading}
                                  className="text-[10px] text-primary hover:text-primary-dark font-semibold hover:underline flex items-center gap-0.5"
                                >
                                  {geoLoading ? '⌛ Obteniendo...' : '📍 Asignar más cercana'}
                                </button>
                              )}
                            </div>

                            {sucursales.length > 1 ? (
                              <div className={`relative rounded-xl transition-all ${!selectedSucursalId
                                ? 'border-2 border-amber-400 bg-amber-50/80 text-amber-900 animate-pulse-border-amber'
                                : 'border border-gray-200 bg-white text-gray-800'
                                }`}>
                                <select
                                  value={selectedSucursalId}
                                  onChange={(e) => {
                                    setSelectedSucursalId(e.target.value)
                                    e.target.blur()
                                  }}
                                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold outline-none bg-transparent cursor-pointer focus:ring-2 focus:ring-primary"
                                >
                                  <option value="" className="bg-white text-gray-800">-- Selecciona una Sucursal --</option>
                                  {sucursales.map((suc) => (
                                    <option key={suc.id} value={suc.id} className="bg-white text-gray-800">
                                      {suc.nombre} ({suc.direccion || suc.ciudad || 'Sede'})
                                      {suc.distanceKm != null ? ` - a ${suc.distanceKm.toFixed(1)} km` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="bg-primary-light/40 border border-primary-light rounded-xl p-2.5 text-xs text-primary-dark font-medium flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary shrink-0" />
                                <span>
                                  <strong>{sucursales[0].nombre}</strong>
                                  {sucursales[0].direccion ? ` - ${sucursales[0].direccion}` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Control de Cantidad */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            Cantidad
                          </span>
                          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                            <button
                              type="button"
                              disabled={quantity <= 1}
                              onClick={() => setQuantity(q => Math.max(1, q - 1))}
                              className="p-2 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="px-4 py-1.5 text-sm font-semibold text-gray-800">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              disabled={quantity >= (product.stock || 99)}
                              onClick={() => setQuantity(q => q + 1)}
                              className="p-2 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Botón Agregar al Carrito */}
                        <button
                          type="button"
                          disabled={isOutOfStock || isMissingRequiredSelections() || (sucursales.length > 1 && !selectedSucursalId)}
                          onClick={handleAddToCart}
                          className={`w-full py-3.5 rounded-full font-bold text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 active:scale-95 ${isOutOfStock || isMissingRequiredSelections() || (sucursales.length > 1 && !selectedSucursalId)
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-primary hover:bg-primary-dark text-white shadow-primary-light'
                            }`}
                        >
                          <ShoppingBag className="w-5 h-5" />
                          {isOutOfStock
                            ? 'Producto Agotado'
                            : isMissingRequiredSelections()
                              ? 'Selecciona opciones requeridas'
                              : (sucursales.length > 1 && !selectedSucursalId)
                                ? 'Selecciona una Sucursal'
                                : `Agregar al Carrito • ${formatPrice(activeUnitPrice * quantity)} ${symbol}`}
                        </button>
                      </div>

                      {/* Opciones de Personalización (si aplica) */}
                      {hasModifiers && (
                        <div className="pt-3 border-t border-gray-100 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary-dark">
                            Opciones de Personalización
                          </h4>

                          {optionGroups.map((group) => {
                            const hasSelection = (selectedOptions[group.id] || []).length > 0
                            const isMissing = group.es_obligatorio && !hasSelection

                            return (
                              <div key={group.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">
                                    {group.nombre}
                                    {!group.es_obligatorio && (
                                      <span className="text-xs font-normal text-gray-400 ml-1">
                                        (Opcional)
                                      </span>
                                    )}
                                  </span>
                                  {group.es_obligatorio && (
                                    isMissing ? (
                                      <span className="text-[10px] uppercase font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
                                        Obligatorio
                                      </span>
                                    ) : (
                                      <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                        ✓ Seleccionado
                                      </span>
                                    )
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  {group.producto_opciones_valor?.map((val) => {
                                    const isSelected = (selectedOptions[group.id] || []).some(
                                      (item) => item.id === val.id
                                    )
                                    const extraPrice = parseFloat(val.modificador_precio) || 0

                                    return (
                                      <button
                                        type="button"
                                        key={val.id}
                                        onClick={() => handleOptionSelect(group, val)}
                                        className={`p-2.5 text-left rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${isSelected
                                          ? 'bg-primary-light border-primary text-primary-dark font-semibold shadow-xs'
                                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                          }`}
                                      >
                                        <span>{val.nombre}</span>
                                        {extraPrice > 0 && (
                                          <span className={isSelected ? 'text-primary font-bold' : 'text-gray-500'}>
                                            +{formatPrice(isBS ? extraPrice * exchange : extraPrice)} {symbol}
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}



                      {/* DISPONIBILIDAD POR SUCURSAL Y CIUDAD (AL FINAL DE TODO) */}
                      {Object.keys(stockByCity).length > 0 && (
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary" />
                            Disponibilidad por Sucursal y Ciudad
                          </h4>

                          <div className="md:max-h-44 md:overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {Object.entries(stockByCity).map(([city, branchList]) => (
                              <div key={city} className="space-y-1.5 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                                  📍 {city}
                                </span>
                                <div className="space-y-1 pl-2">
                                  {branchList.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between text-xs py-0.5">
                                      <span className="text-slate-600 font-medium truncate max-w-[210px]" title={b.direccion}>
                                        {b.nombre} {b.direccion ? `(${b.direccion})` : ''}
                                      </span>
                                      {b.isAvailable && b.stock > 0 ? (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                                          {b.stock} disp.
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shrink-0">
                                          Agotado
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default ProductDetailModal
