import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useCurrency } from '../context/CurrencyContext'
import ImageCarousel from './ImageCarousel'
import { ShoppingBag, Tag, Sparkles, Eye } from 'lucide-react'
import CustomizerModal from './CustomizerModal'
import ProductDetailModal from './ProductDetailModal'
import { evaluarPromocionProducto } from '../utils/promotionEngine'
import { slugify } from '../pages/ProductDetailPage'

const ProductCard = ({
  id, name, slug, description, category, stock, date_added, created_at,
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
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { isBS, exchangeRate, promotions } = useCurrency()
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const isOutOfStock = (stock ?? 0) <= 0
  const productSlug = slug || slugify(name) || id

  const isNew = () => {
    const date = date_added || created_at
    if (!date) return false
    const diffDays = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }

  const mainImage = images?.find(img => img.is_main)?.image ?? images?.[0]?.image ?? null

  const productData = {
    id, name, slug: productSlug, description, category, stock, date_added, created_at,
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

  // Evaluar promociones dinámicas por SKU / volumen / campaña
  const promoInfo = evaluarPromocionProducto(productData, 1, promotions)

  // Precios dinámicos (USD y Bs)
  const basePriceUSD = parseFloat(price) || 0
  const effectivePriceUSD = promoInfo.tienePromocion ? promoInfo.precioFinal : basePriceUSD
  const effectiveCompareUSD = promoInfo.tienePromocion
    ? basePriceUSD
    : (compare_price ? parseFloat(compare_price) : null)

  const exchange = exchangeRate || 1
  const activePrice = isBS ? effectivePriceUSD * exchange : effectivePriceUSD
  const activeComparePrice = effectiveCompareUSD ? (isBS ? effectiveCompareUSD * exchange : effectiveCompareUSD) : null
  const symbol = isBS ? 'Bs' : '$'
  const activeBadgeText = promoInfo.tienePromocion
    ? promoInfo.badgeText
    : (discount_percent > 0 ? `-${discount_percent}%` : null)

  const formatPrice = (val) =>
    val != null
      ? val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null

  const handleNavigateToDetail = (e) => {
    e?.stopPropagation()
    navigate(`/producto/${productSlug}`)
  }

  const handleOpenQuickView = (e) => {
    e?.stopPropagation()
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
          {activeBadgeText && !isOutOfStock && (
            <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide flex items-center gap-1 animate-bounce">
              <Tag className="w-3 h-3" />
              {activeBadgeText}
            </span>
          )}
        </div>

        {/* Botón de Vista Rápida (Ojito circular con tooltip flotante en hover) */}
        <div className="absolute top-3 left-3 z-20 group/quickview">
          <button
            type="button"
            onClick={handleOpenQuickView}
            className="w-9 h-9 bg-white/95 hover:bg-primary hover:text-white text-primary rounded-full shadow-md backdrop-blur-xs transition-all duration-200 active:scale-90 flex items-center justify-center border border-slate-200/80 cursor-pointer"
            aria-label="Vista Rápida"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>

          {/* Tooltip Flotante */}
          <div className="absolute left-0 top-full mt-1.5 opacity-0 group-hover/quickview:opacity-100 scale-95 group-hover/quickview:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-30">
            <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-xl backdrop-blur-xs block tracking-wide border border-slate-800">
              Vista Rápida
            </span>
          </div>
        </div>

        {/* Carrusel / Imagen principal con navegación a la página del producto */}
        <div
          onClick={handleNavigateToDetail}
          className="aspect-square overflow-hidden bg-white relative cursor-pointer group-hover:opacity-95 transition-opacity"
          title="Ver detalle completo del producto"
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
        <div className="p-3 text-center flex flex-col justify-between flex-1">
          <div>
            <span className="text-xs uppercase tracking-widest text-primary/80 font-semibold">{category}</span>
            <h3
              onClick={handleNavigateToDetail}
              className="text-sm lg:text-[16px]/5 font-medium text-slate-800 mt-1 cursor-pointer hover:text-primary transition-colors line-clamp-3"
              title="Ver detalle del producto"
            >
              {name}
            </h3>

            {description && (
              <p
                onClick={handleNavigateToDetail}
                className="text-[13px] text-slate-400 mt-1 line-clamp-2 px-1 leading-relaxed cursor-pointer hover:text-slate-600 transition-colors"
              >
                {description}
              </p>
            )}
          </div>

          <div>
            {/* Precios con Descuento de Promoción */}
            <div className="mt-2.5 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2">
                <p className="text-primary font-bold text-lg">
                  {precio_por_tamano && 'Desde '} {formatPrice(activePrice)}{symbol}
                </p>
                {activeComparePrice && activeComparePrice > activePrice && (
                  <p className="text-gray-400 text-xs sm:text-sm line-through decoration-red-400">
                    {precio_por_tamano && 'Desde '} {formatPrice(activeComparePrice)}{symbol}
                  </p>
                )}
              </div>
              
              {/* Sugerencia de próximo escalón de volumen o Máximo Descuento */}
              {promoInfo.proximoEscalon && !isOutOfStock ? (
                <div className="mt-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>
                    ¡Comprando {promoInfo.proximoEscalon.cantidadMinima}+ obtienes {promoInfo.proximoEscalon.tipoDescuento === 'porcentaje' ? `${promoInfo.proximoEscalon.valorDescuento}%` : `$${promoInfo.proximoEscalon.valorDescuento}`} off!
                  </span>
                </div>
              ) : promoInfo.esMaximoDescuento && !isOutOfStock ? (
                <div className="mt-1 bg-emerald-100 border border-emerald-300 text-emerald-950 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>
                    🎉 ¡Máximo descuento (-{promoInfo.porcentajeDescuento}% OFF)!
                  </span>
                </div>
              ) : null}
            </div>

            <button
              disabled={isOutOfStock}
              onClick={handleNavigateToDetail}
              className={`mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 cursor-pointer
                ${isOutOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-primary hover:bg-primary-dark text-white shadow-sm shadow-primary-light'}`}
            >
              {isOutOfStock ? (
                'No disponible'
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Ver Detalles
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