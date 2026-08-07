import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  AlertCircle,
  Tag,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  Building2,
  Sparkles,
  ChevronRight,
  Eye,
  MapPin,
  Car,
  Layers,
  FileSpreadsheet,
  Share2,
  ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { supabase } from '../utils/supabase';
import { sortBranchesByProximity } from '../utils/geo';
import { evaluarPromocionProducto } from '../utils/promotionEngine';

export const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const ProductDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, setIsOpen: setIsCartOpen } = useCart();
  const { isBS, currency, exchangeRate, store, promotions } = useCurrency();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Customization & quantity
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [comment, setComment] = useState('');

  // Auxiliary data
  const [sucursales, setSucursales] = useState([]);
  const [branchStockList, setBranchStockList] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [compatibilities, setCompatibilities] = useState([]);
  const [crossReferences, setCrossReferences] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);

  // Active tab in details section: 'sucursales' | 'compatibilidad' | 'referencias'
  const [activeTab, setActiveTab] = useState('sucursales');

  // Quick view modal for related products
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // 1. Fetch product by slug (or ID)
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("producto")
          .select(
            "*, category:category!producto_category_fkey(name, slug), ProductImagen(*), producto_grupo_relacion(orden, producto_opciones_grupo(id,nombre,es_obligatorio,es_multiple,producto_opciones_valor(id,nombre,modificador_precio,modificador_precio_comparacion)))"
          )
          .eq("is_active", true);

        if (/^\d+$/.test(slug)) {
          query = query.eq("id", parseInt(slug, 10));
        } else {
          query = query.eq("slug", slug);
        }

        const { data, error: prodErr } = await query.maybeSingle();

        if (prodErr) throw prodErr;

        if (!data) {
          setError("El producto solicitado no fue encontrado o no está disponible.");
          setLoading(false);
          return;
        }

        setProduct(data);
        setSelectedImageIndex(0);

        // Update document title for SEO
        document.title = `${data.name} | ${store?.comercial_name || store?.nombre || "Tienda"}`;

        // 2. Fetch inventory by branch (usando la tabla correcta producto_stock_sucursal)
        const { data: invData } = await supabase
          .from("producto_stock_sucursal")
          .select("*, sucursal(*)")
          .eq("producto_id", data.id);

        setBranchStockList(invData || []);

        // 3. Fetch active branches for store
        const storeIdToUse = data.store || store?.id;
        if (storeIdToUse) {
          const { data: sucData } = await supabase
            .from("sucursal")
            .select("*")
            .eq("store_id", storeIdToUse)
            .eq("is_active", true)
            .order("nombre", { ascending: true });

          setSucursales(sucData || []);
        }

        // 4. Fetch vehicle compatibility
        const { data: compData } = await supabase
          .from("producto_compatibilidad")
          .select("*, vehiculo_generacion(*, vehiculo_modelo(*, vehiculo_marca(*)))")
          .eq("producto_id", data.id);

        setCompatibilities(compData || []);

        // 5. Fetch cross references
        const { data: refData } = await supabase
          .from("producto_referencia_cruzada")
          .select("*")
          .eq("producto_id", data.id);

        setCrossReferences(refData || []);

        // 6. Fetch related products from same category
        if (data.category_id && storeIdToUse) {
          const { data: relData } = await supabase
            .from("producto")
            .select("*, category:category!producto_category_fkey(name), ProductImagen(*)")
            .eq("store", storeIdToUse)
            .eq("is_active", true)
            .eq("category_id", data.category_id)
            .neq("id", data.id)
            .limit(4);

          setRelatedProducts(relData || []);
        }
      } catch (err) {
        console.error("Error al cargar detalle del producto:", err);
        setError("Ocurrió un error al cargar la información del producto.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [slug, store]);

  // Helper para obtener URL limpia de imágenes (soporta propiedades 'url', 'image', etc.)
  const getImageUrl = (item) => {
    if (!item) return null;
    if (typeof item === "string") return item;
    return item.url || item.image || item.image_url || item.imagen_url || null;
  };

  // Gallery images array
  const galleryImages = useMemo(() => {
    if (!product) return [];
    let list = [];
    if (Array.isArray(product.ProductImagen) && product.ProductImagen.length > 0) {
      list = [...product.ProductImagen].sort(
        (a, b) => ((b.is_main || b.is_primary) ? 1 : 0) - ((a.is_main || a.is_primary) ? 1 : 0)
      );
    } else if (Array.isArray(product.images) && product.images.length > 0) {
      list = product.images;
    } else if (product.image || product.url) {
      list = [{ image: product.image || product.url, is_main: true }];
    }
    return list
      .map((item) => ({
        image: getImageUrl(item),
        is_main: !!(item?.is_main || item?.is_primary),
      }))
      .filter((img) => !!img.image);
  }, [product]);

  const currentMainImageUrl = galleryImages[selectedImageIndex]?.image || product?.image || null;

  // Helper para formatear montos numéricos de forma segura
  const formatPriceNumber = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  // Base prices
  const basePriceUSD = parseFloat(product?.price || 0);
  const baseComparePriceUSD = product?.compare_price ? parseFloat(product.compare_price) : null;

  // Evaluate promotions
  const promoEval = useMemo(() => {
    if (!product) return { tienePromocion: false, precioOriginal: basePriceUSD, precioFinal: basePriceUSD };
    try {
      return evaluarPromocionProducto(product, quantity, promotions);
    } catch (e) {
      return { tienePromocion: false, precioOriginal: basePriceUSD, precioFinal: basePriceUSD };
    }
  }, [product, quantity, promotions, basePriceUSD]);

  // Modifiers & option calculations
  const optionGroups = useMemo(() => {
    if (!product?.producto_grupo_relacion) return [];
    return product.producto_grupo_relacion
      .map((rel) => rel.producto_opciones_grupo)
      .filter(Boolean);
  }, [product]);

  const handleOptionSelect = (group, value) => {
    setSelectedOptions((prev) => {
      const currentSelection = prev[group.id] || [];
      const price_modifier = parseFloat(value.modificador_precio) || 0;
      const price_compare_modifier = value.modificador_precio_comparacion
        ? parseFloat(value.modificador_precio_comparacion)
        : null;

      if (group.es_multiple) {
        const exists = currentSelection.some((item) => item.id === value.id);
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
          ];
        return { ...prev, [group.id]: updated };
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
        };
      }
    });
  };

  const isMissingRequiredSelections = () => {
    for (const group of optionGroups) {
      if (group.es_obligatorio) {
        const selection = selectedOptions[group.id] || [];
        if (selection.length === 0) return true;
      }
    }
    return false;
  };

  const activeUnitPriceUSD = promoEval.tienePromocion
    ? (promoEval.precioFinal ?? basePriceUSD)
    : basePriceUSD;
  const activeOriginalUnitPriceUSD = promoEval.tienePromocion
    ? (promoEval.precioOriginal ?? basePriceUSD)
    : (baseComparePriceUSD || basePriceUSD);

  const selectedOptionsFlat = Object.values(selectedOptions).flat();
  const modifiersTotalUSD = selectedOptionsFlat.reduce(
    (sum, opt) => sum + (parseFloat(opt.price_modifier) || 0),
    0
  );

  const effectiveUnitPriceUSD = (parseFloat(activeUnitPriceUSD) || 0) + modifiersTotalUSD;
  const originalUnitPriceUSD = (parseFloat(activeOriginalUnitPriceUSD) || 0) + modifiersTotalUSD;

  const totalLinePriceUSD = effectiveUnitPriceUSD * quantity;

  // Rate conversor
  const rate = parseFloat(exchangeRate) || 1;
  const totalLinePriceBS = totalLinePriceUSD * rate;

  const handleAddToCart = () => {
    if (isMissingRequiredSelections()) {
      toast.error('Por favor selecciona las opciones obligatorias antes de agregar al carrito.');
      return;
    }

    const mainImageToUse = currentMainImageUrl || galleryImages[0]?.image || product?.image || product?.url || null;

    addToCart(
      {
        ...product,
        image: mainImageToUse,
        price: effectiveUnitPriceUSD,
        originalPrice: originalUnitPriceUSD,
      },
      selectedOptionsFlat,
      comment,
      quantity
    );

    if (typeof setIsCartOpen === 'function') {
      setIsCartOpen(true);
    }
  };

  const handleGeolocateBranch = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const sorted = sortBranchesByProximity(sucursales, coords);
        setSucursales(sorted);
        setGeoLoading(false);
        toast.success('📍 Sucursales ordenadas por distancia GPS');
      },
      () => {
        setGeoLoading(false);
        toast.error('No se pudo obtener la ubicación GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-600">Cargando detalles del producto...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Producto No Encontrado</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'El producto no existe.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Catálogo
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
            Inicio
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <Link to="/" className="hover:text-primary transition-colors font-medium">
            Catálogo
          </Link>
          {product.category?.name && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-600 font-semibold">{product.category.name}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-primary-dark font-bold truncate max-w-[200px] sm:max-w-none">
            {product.name}
          </span>
        </nav>

        {/* Bloque Principal del Producto */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Columna Izquierda: Galería de Imágenes */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full rounded-2xl border border-slate-200/80 overflow-hidden flex items-center justify-center group shadow-inner">
              {currentMainImageUrl ? (
                <img
                  src={currentMainImageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-slate-300 font-bold text-sm">Sin imagen disponible</div>
              )}

              {/* Insignia de Promoción si aplica */}
              {promoEval.tienePromocion && (
                <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  {promoEval.badgeText}
                </span>
              )}
            </div>

            {/* Selector de Miniaturas */}
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-slate-50 shrink-0 transition-all ${selectedImageIndex === idx
                        ? 'border-primary ring-2 ring-primary/20 scale-95'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                  >
                    <img src={img.image} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Información, Precio y Compra */}
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Categoría y Códigos */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {product.category?.name && (
                  <span className="bg-primary-light/50 text-primary-dark text-xs font-bold px-3 py-1 rounded-full border border-primary-light">
                    {product.category.name}
                  </span>
                )}
                {product.sku && (
                  <span className="text-xs font-mono font-medium text-slate-400">
                    SKU: <strong>{product.sku}</strong>
                  </span>
                )}
              </div>

              {/* Título Principal */}
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 leading-tight">
                {product.name}
              </h1>

              {/* Estado de Stock e Inventario */}
              <div className="flex items-center gap-2">
                {(product.stock ?? 0) > 0 ? (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Disponible ({product.stock} unidades en stock)</span>
                  </span>
                ) : (
                  <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Agotado</span>
                  </span>
                )}
              </div>

              {/* Códigos Técnicos Adicionales */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-mono">
                {(product.barcode || product.codigo_barra) && (
                  <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Código Barra: <strong>{product.barcode || product.codigo_barra}</strong>
                  </span>
                )}
                {product.oem_number && (
                  <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    OEM: <strong>{product.oem_number}</strong>
                  </span>
                )}
                {product.part_number_fabricante && (
                  <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    N° Parte: <strong>{product.part_number_fabricante}</strong>
                  </span>
                )}
              </div>

              {/* Descripción */}
              {product.description && (
                <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {product.description}
                </p>
              )}

              {/* Cuadro de Precio Dinámico */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Precio del Producto
                </span>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-serif font-bold text-primary-dark">
                    ${formatPriceNumber(effectiveUnitPriceUSD)} USD
                  </span>
                  {promoEval.tienePromocion && originalUnitPriceUSD > effectiveUnitPriceUSD && (
                    <span className="text-sm text-slate-400 line-through font-medium">
                      ${formatPriceNumber(originalUnitPriceUSD)}
                    </span>
                  )}
                  {rate > 0 && (
                    <span className="text-sm font-bold text-slate-600 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs font-mono">
                      ≈ {formatPriceNumber(totalLinePriceBS)} Bs
                    </span>
                  )}
                </div>

                {/* Sugerencia de Promoción por Volumen o Máximo Descuento Alcanzado */}
                {promoEval.proximoEscalon ? (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded-xl font-medium flex items-center gap-1.5 mt-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      ¡Agrega <strong>{promoEval.proximoEscalon.cantidadFaltante}</strong> más para obtener un{' '}
                      <strong>
                        {promoEval.proximoEscalon.tipoDescuento === 'porcentaje'
                          ? `${promoEval.proximoEscalon.valorDescuento}%`
                          : `$${promoEval.proximoEscalon.valorDescuento}`}
                      </strong>{' '}
                      de descuento extra!
                    </span>
                  </p>
                ) : promoEval.esMaximoDescuento ? (
                  <p className="text-xs text-emerald-950 bg-emerald-100/90 border border-emerald-300 p-2.5 rounded-xl font-bold flex items-center gap-2 mt-2 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-bounce" />
                    <span>
                      🎉 ¡Felicidades! Has alcanzado el máximo descuento disponible (<strong>-{promoEval.porcentajeDescuento}% OFF</strong>).
                    </span>
                  </p>
                ) : null}
              </div>

              {/* Grupos de Modificadores u Opciones */}
              {optionGroups.length > 0 && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Opciones y Personalización
                  </h4>
                  {optionGroups.map((group) => {
                    const hasSelection = (selectedOptions[group.id] || []).length > 0;
                    const isMissing = group.es_obligatorio && !hasSelection;

                    return (
                      <div key={group.id} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {group.nombre} {!group.es_obligatorio && <span className="text-slate-400 font-normal">(opcional)</span>}
                          </span>
                          {group.es_obligatorio && isMissing && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded">
                              Requerido
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {group.producto_opciones_valor?.map((val) => {
                            const isSelected = (selectedOptions[group.id] || []).some(
                              (item) => item.id === val.id
                            );
                            const extra = parseFloat(val.modificador_precio) || 0;

                            return (
                              <button
                                key={val.id}
                                type="button"
                                onClick={() => handleOptionSelect(group, val)}
                                className={`p-2.5 text-left rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${isSelected
                                    ? 'bg-primary-light border-primary text-primary-dark font-bold'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                              >
                                <span>{val.nombre}</span>
                                {extra > 0 && <span className="text-slate-500 font-mono">+${formatPriceNumber(extra)}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selector de Cantidad y Botón de Agregar al Carrito */}
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-3 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-5 py-2 text-sm font-bold text-slate-800 font-mono">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-3 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isMissingRequiredSelections()}
                  className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer ${isMissingRequiredSelections()
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-primary hover:bg-primary-dark shadow-primary-light'
                    }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Agregar al Carrito (${formatPriceNumber(totalLinePriceUSD)})</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Pestañas Técnicas e Inventario */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm mb-12 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('sucursales')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'sucursales'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Stock por Almacenes ({sucursales.length})</span>
            </button>

            {compatibilities.length > 0 && (
              <button
                onClick={() => setActiveTab('compatibilidad')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'compatibilidad'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <Car className="w-4 h-4" />
                <span>Vehículos Compatibles ({compatibilities.length})</span>
              </button>
            )}

            {crossReferences.length > 0 && (
              <button
                onClick={() => setActiveTab('referencias')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'referencias'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <Layers className="w-4 h-4" />
                <span>Referencias Cruzadas ({crossReferences.length})</span>
              </button>
            )}
          </div>

          {/* Contenido Pestaña 1: Sucursales */}
          {activeTab === 'sucursales' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Disponibilidad en tiempo real en nuestras sedes físicas:
                </p>
                <button
                  onClick={handleGeolocateBranch}
                  disabled={geoLoading}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{geoLoading ? 'Obteniendo GPS...' : 'Ordenar por Cercanía GPS'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sucursales.map((suc) => {
                  const match = branchStockList.find(
                    (b) =>
                      b.sucursal_id?.toString() === suc.id?.toString() ||
                      b.sucursal?.id?.toString() === suc.id?.toString()
                  );

                  let st = 0;
                  let isAvail = false;

                  if (match) {
                    st = match.stock ?? 0;
                    isAvail = (match.stock_status ?? true) && st > 0;
                  } else if (branchStockList.length === 0) {
                    st = product.stock ?? 0;
                    isAvail = st > 0;
                  }

                  return (
                    <div
                      key={suc.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${isAvail
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                    >
                      <div>
                        <strong className="text-xs font-bold block">{suc.nombre}</strong>
                        <span className="text-[11px] text-slate-500 italic block">{suc.ciudad || suc.direccion}</span>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs ${isAvail ? 'bg-emerald-600 text-white' : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                      >
                        {isAvail ? `${st} disponibles` : 'Agotado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contenido Pestaña 2: Compatibilidad de Vehículos */}
          {activeTab === 'compatibilidad' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {compatibilities.map((comp) => {
                const gen = comp.vehiculo_generacion;
                const mod = gen?.vehiculo_modelo;
                const mar = mod?.vehiculo_marca;

                return (
                  <div key={comp.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <strong className="text-xs font-bold text-slate-900 block">
                      {mar?.nombre} {mod?.nombre}
                    </strong>
                    <span className="text-xs text-slate-600 block">{gen?.nombre}</span>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      Años: {gen?.anio_inicio} - {gen?.anio_fin === 2099 ? 'Presente' : gen?.anio_fin} {gen?.motor ? `| Motor: ${gen.motor}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contenido Pestaña 3: Referencias Cruzadas */}
          {activeTab === 'referencias' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {crossReferences.map((ref) => (
                <div key={ref.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 font-mono">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    {ref.marca_referencia || 'Referencia'}
                  </span>
                  <strong className="text-xs font-bold text-slate-900 block">
                    {ref.codigo_referencia}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección de Productos Relacionados */}
        {relatedProducts.length > 0 && (
          <div className="space-y-6 mb-12">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xl font-serif font-bold text-slate-900">
                También te puede interesar
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((relProd) => (
                <ProductCard key={relProd.id} {...relProd} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Modal de Vista Rápida en caso de ser invocado desde la sugerencia */}
      {quickViewProduct && (
        <ProductDetailModal
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          product={quickViewProduct}
        />
      )}
    </div>
  );
};

export default ProductDetailPage;
