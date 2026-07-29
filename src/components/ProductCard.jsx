// components/ProductCard.jsx

import React, { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useCurrency } from '../context/CurrencyContext'
import ImageCarousel from './ImageCarousel'
import { ShoppingBag } from 'lucide-react'
import CustomizerModal from './CustomizerModal'
import ProductDetailModal from './ProductDetailModal'

const ProductCard = ({
  id, name, description, category, stock, date_added, created_at,
  price, compare_price,
  price_bs, compare_price_bs,
  discount_percent,
  images,
  precio_por_tamano = false,
  hasModifiers = false,
  optionGroups = [],
  sku,
  barcode,
  codigo_barra,
}) => {
  const { addToCart } = useCart()
  const { isBS } = useCurrency()
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const isOutOfStock = (stock ?? 0) <= 0

  const isNew = () => {
    const date = date_added || created_at
    if (!date) return false
    const diffDays = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }

  const activePrice = isBS ? price_bs : parseFloat(price)
  const activeComparePrice = isBS ? compare_price_bs : parseFloat(compare_price)
  const symbol = isBS ? 'Bs' : '$'
  const discount = discount_percent > 0 ? discount_percent : null

  const formatPrice = (val) =>
    val != null
      ? val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null

  const mainImage = images?.find(img => img.is_main)?.image ?? images?.[0]?.image ?? null

  const productData = {
    id, name, description, category, stock, date_added, created_at,
    price: parseFloat(price),
    compare_price: compare_price ? parseFloat(compare_price) : null,
    price_bs,
    compare_price_bs,
    discount_percent,
    images,
    image: mainImage,
    precio_por_tamano,
    hasModifiers,
    optionGroups,
    sku: sku || null,
    barcode: barcode || codigo_barra || null,
    codigo_barra: codigo_barra || barcode || null,
  }

  const handleOpenDetail = (e) => {
    e.stopPropagation()
    setIsDetailOpen(true)
  }

  return (
    <>
      <div className={`group bg-white rounded-2xl overflow-hidden shadow-sm border border-primary-light transition-all duration-300 relative flex flex-col justify-between
        ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-md'}`}
      >
        {/* Badges */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
          {isNew() && !isOutOfStock && (
            <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide uppercase animate-pulse">
              ¡Nuevo!
            </span>
          )}
          {discount && !isOutOfStock && (
            <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide">
              -{discount}%
            </span>
          )}
        </div>

        {/* Carrusel / Imagen principal (hace click para abrir detalle) */}
        <div
          onClick={handleOpenDetail}
          className="aspect-square overflow-hidden bg-white relative cursor-pointer group-hover:opacity-95 transition-opacity"
          title="Ver detalle del producto"
        >
          <ImageCarousel images={images} name={name} isOutOfStock={isOutOfStock} />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-10">
              <span className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold tracking-widest uppercase shadow-lg">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2 text-center flex flex-col justify-between flex-1">
          <div>
            <span className="text-xs uppercase tracking-widest text-primary/80 font-semibold">{category}</span>
            <h3
              onClick={handleOpenDetail}
              className="text-sm lg:text-[16px]/5 font-medium text-slate-800 mt-1 cursor-pointer hover:text-primary transition-colors line-clamp-3"
              title="Ver detalle del producto"
            >
              {name}
            </h3>

            {description && (
              <p
                onClick={handleOpenDetail}
                className="text-[13px] text-slate-400 mt-1 line-clamp-2 px-1 leading-relaxed cursor-pointer hover:text-slate-600 transition-colors"
              >
                {description}
              </p>
            )}
          </div>

          <div>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <p className="text-primary font-semibold text-lg">
                {precio_por_tamano && 'Desde '} {formatPrice(activePrice)}{symbol}
              </p>
              {discount && activeComparePrice && (
                <p className="text-gray-400 text-sm line-through">
                  {precio_por_tamano && 'Desde '} {formatPrice(activeComparePrice)}{symbol}
                </p>
              )}
            </div>

            <button
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation()
                setIsDetailOpen(true)
              }}
              className={`mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 cursor-pointer
                ${isOutOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-primary hover:bg-primary-dark text-white shadow-sm shadow-primary-light'}`}
            >
              {isOutOfStock ? (
                'No disponible'
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Agregar al Carrito
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalle Completo del Producto */}
      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={productData}
      />

      {/* Modal de Personalización rápida */}
      <CustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        product={productData}
        onConfirm={(selectedOptions, comment) => {
          addToCart(productData, selectedOptions, comment)
        }}
      />
    </>
  )
}

export default ProductCard