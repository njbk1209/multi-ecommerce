import { Fragment, useState, useEffect, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  X,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Truck,
  Store,
  User,
  Phone,
  MapPin,
  FileText,
  IdCard,
  Building2,
  AlertTriangle,
  Tag,
  Sparkles,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { supabase } from "../utils/supabase";
import { sortBranchesByProximity } from "../utils/geo";
import { evaluarPromocionProducto } from "../utils/promotionEngine";

const buildWhatsAppMessage = ({
  nombre,
  cedula,
  whatsapp,
  cart,
  promotions = [],
  deliveryMethod,
  pickupPaymentMethod,
  direccion,
  gpsUrl,
}) => {
  const entrega =
    deliveryMethod === "shipping" ? "Envío a domicilio" : "Retiro en tienda";

  const metodoPago =
    deliveryMethod === "pickup"
      ? (pickupPaymentMethod === "tienda" ? "Pago en tienda al retirar" : "Pago por WhatsApp")
      : "Pago por WhatsApp";

  let mensaje =
    `*Nuevo Pedido*%0A` +
    `*Cliente:* ${nombre}%0A` +
    `*C.I. / RIF:* ${cedula}%0A` +
    `*WhatsApp:* ${whatsapp}%0A` +
    `*Dirección:* ${direccion}%0A` +
    `*Método de Entrega:* ${entrega}%0A` +
    `*Método de Pago:* ${metodoPago}%0A`;

  if (deliveryMethod === "shipping" && gpsUrl) {
    mensaje += `*Ubicación GPS:* ${gpsUrl}%0A`;
  }

  const itemsByBranch = {};
  cart.forEach((item) => {
    const sucNombre =
      item.sucursal?.nombre || item.sucursal_nombre || "Sucursal Principal";
    if (!itemsByBranch[sucNombre]) {
      itemsByBranch[sucNombre] = [];
    }

    const promoEval = evaluarPromocionProducto(item, item.qty, promotions);
    const unitPrice = promoEval.tienePromocion ? promoEval.precioFinal : (item.price || 0);

    let itemStr = `* ${item.qty}x ${item.name} ($${unitPrice.toFixed(2)} c/u)`;

    if (item.selectedOptions && item.selectedOptions.length > 0) {
      const opts = item.selectedOptions.map((o) => o.nombre).join(", ");
      itemStr += ` (${opts})`;
    }
    if (item.comment) {
      itemStr += ` [Nota: ${item.comment}]`;
    }
    itemsByBranch[sucNombre].push(itemStr);
  });

  const branchKeys = Object.keys(itemsByBranch);

  mensaje += `%0A*Productos:*%0A`;
  branchKeys.forEach((sucName, index) => {
    if (index > 0) {
      mensaje += `%0A`;
    }
    mensaje += `${sucName}%0A` + itemsByBranch[sucName].join("%0A") + `%0A`;
  });

  mensaje += `%0A_Enviado desde la web por el cliente_`;

  return mensaje;
};

const DELIVERY_OPTIONS = [
  {
    value: "pickup",
    label: "Retiro en tienda",
    description: "Retira gratis en nuestra sucursal",
    Icon: Store,
  },
  {
    value: "shipping",
    label: "Envío a domicilio",
    description: "Entrega directa en tu dirección",
    Icon: Truck,
  },
];

export default function CartDrawer({ isOpen, setIsOpen }) {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    getTotal,
    setCart,
    validateCartBeforeCheckout,
  } = useCart();
  const { currency, exchangeRate, store, promotions } = useCurrency();
  const rate = exchangeRate || 1;

  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    cedulaTipo: "V",
    cedulaNumero: "",
    whatsapp: "",
  });
  const [direccion, setDireccion] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState("tienda");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [sucursales, setSucursales] = useState([]);
  useEffect(() => {
    if (!store?.id) return;
    const fetchSucursales = async () => {
      try {
        const { data, error } = await supabase
          .from("sucursal")
          .select("*")
          .eq("store_id", store.id)
          .eq("is_active", true);

        if (error) throw error;
        setSucursales(data || []);
      } catch (err) {
        console.error("Error al cargar sucursales en CartDrawer:", err);
      }
    };
    fetchSucursales();
  }, [store?.id]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ),
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const cartFinancials = useMemo(() => {
    let subtotalSinDescuentoUSD = 0;
    let totalDescuentoUSD = 0;
    let totalPagarUSD = 0;

    cart.forEach((item) => {
      const itemForEval = {
        ...item,
        price: parseFloat(item.price) || 0,
        sku: item.sku || item.codigo_barra || item.barcode || null,
        category_id: item.category_id || item.category || null,
      };

      const promoEval = evaluarPromocionProducto(itemForEval, item.qty, promotions);
      const originalUnit = promoEval.precioOriginal || (item.price ?? 0);
      const finalUnit = promoEval.tienePromocion ? promoEval.precioFinal : (item.price ?? 0);
      const discountUnit = promoEval.tienePromocion ? promoEval.montoDescuentoUnitario : 0;

      subtotalSinDescuentoUSD += originalUnit * item.qty;
      totalDescuentoUSD += discountUnit * item.qty;
      totalPagarUSD += finalUnit * item.qty;
    });

    const currentRate = exchangeRate || 1;
    return {
      subtotalSinDescuentoUSD,
      totalDescuentoUSD,
      totalPagarUSD,
      subtotalSinDescuentoBS: subtotalSinDescuentoUSD * currentRate,
      totalDescuentoBS: totalDescuentoUSD * currentRate,
      totalPagarBS: totalPagarUSD * currentRate,
    };
  }, [cart, promotions, exchangeRate]);

  const uniqueBranchesInCart = new Set(
    cart
      .map(
        (item) =>
          item.sucursal_id || item.sucursal?.id || item.sucursal_nombre,
      )
      .filter(Boolean),
  );
  const isMultiBranchCart = uniqueBranchesInCart.size > 1;

  const sortedCart = [...cart].sort((a, b) => {
    const nameA = a.sucursal?.nombre || a.sucursal_nombre || "";
    const nameB = b.sucursal?.nombre || b.sucursal_nombre || "";
    return nameA.localeCompare(nameB);
  });

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error("La geolocalización no es soportada por tu navegador.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsLocation({ lat: latitude, lng: longitude });

        if (sucursales.length > 0) {
          const sorted = sortBranchesByProximity(
            latitude,
            longitude,
            sucursales,
          );
          setSucursales(sorted);
        }

        setGeoLoading(false);
        toast.success("📍 Ubicación GPS obtenida exitosamente");
      },
      (error) => {
        console.error("Error al obtener ubicación:", error);
        setGeoLoading(false);
        toast.error(
          "No se pudo obtener la ubicación. Verifica los permisos de tu navegador.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("Por favor ingresa tu nombre y apellido");
      return;
    }
    if (!form.cedulaNumero.trim()) {
      toast.error("Por favor ingresa tu número de C.I. o RIF");
      return;
    }
    if (!form.whatsapp.trim()) {
      toast.error("Por favor ingresa tu número de WhatsApp");
      return;
    }

    if (deliveryMethod === "shipping" && !direccion.trim()) {
      toast.error("Por favor ingresa la dirección exacta para el envío");
      return;
    }

    setLoading(true);

    const validation = await validateCartBeforeCheckout();
    if (!validation.valid) {
      validation.messages.forEach((msg) => toast.error(msg, { duration: 5000 }));
      setLoading(false);
      return;
    }

    const gpsUrl = gpsLocation
      ? `https://maps.google.com/?q=${gpsLocation.lat},${gpsLocation.lng}`
      : null;

    const lugarPago =
      deliveryMethod === "pickup"
        ? pickupPaymentMethod === "tienda"
          ? "Pago en tienda al retirar"
          : "Pago previo online"
        : null;

    const fullCedula = `${form.cedulaTipo}-${form.cedulaNumero.trim()}`;

    const mensaje = buildWhatsAppMessage({
      nombre: form.nombre.trim(),
      cedula: fullCedula,
      whatsapp: form.whatsapp.trim(),
      cart,
      promotions,
      deliveryMethod,
      pickupPaymentMethod,
      direccion:
        deliveryMethod === "shipping"
          ? direccion.trim()
          : "Retiro en Sucursal",
      gpsUrl,
    });

    try {
      const { data: pedidoId, error: rpcError } = await supabase.rpc(
        "crear_pedido",
        {
          p_store_id: store.id,
          p_nombre_cliente: form.nombre.trim(),
          p_whatsapp_cliente: `${fullCedula} | ${form.whatsapp.trim()}`,
          p_metodo_entrega: deliveryMethod,
          p_direccion_entrega: direccion.trim() || null,
          p_gps_url: gpsUrl,
          p_total_usd: cartFinancials.totalPagarUSD,
          p_total_bs: cartFinancials.totalPagarBS,
          p_moneda_activa: currency,
          p_items: cart.map((item) => {
            const promoEval = evaluarPromocionProducto(item, item.qty, promotions);
            const unitFinalPrice = promoEval.tienePromocion ? promoEval.precioFinal : item.price;
            return {
              producto_id: item.id ? Number(item.id) : null,
              nombre_producto: item.name,
              cantidad: Number(item.qty),
              precio_unitario: unitFinalPrice,
              comentario: item.comment || null,
              opciones_seleccionadas: item.selectedOptions || null,
              sucursal_id:
                item.sucursal_id || item.sucursal?.id
                  ? Number(item.sucursal_id || item.sucursal?.id)
                  : null,
              sucursal_nombre:
                item.sucursal?.nombre || item.sucursal_nombre || null,
              sku: item.sku || null,
              codigo_barra: item.barcode || item.codigo_barra || null,
            };
          }),
        },
      );

      if (rpcError) {
        console.error("Error devuelto por Supabase al crear pedido:", rpcError);
        toast.error(
          `❌ No se pudo guardar el pedido en la base de datos: ${rpcError.message || "Error desconocido"}. Intenta nuevamente.`,
          { duration: 6000 },
        );
        setLoading(false);
        return;
      }

      toast.success("¡Pedido registrado exitosamente!");
    } catch (dbErr) {
      console.error("Excepción al intentar crear pedido en Supabase:", dbErr);
      toast.error(
        "❌ Ocurrió un error al procesar el registro de la orden. Por favor intenta de nuevo.",
        { duration: 6000 },
      );
      setLoading(false);
      return;
    }

    const storeWhatsapp = store?.whatsapp || "584245305968";
    let formattedWhatsapp = storeWhatsapp.replace(/\D/g, "");
    if (formattedWhatsapp.startsWith("0")) formattedWhatsapp = "58" + formattedWhatsapp.substring(1);

    const waUrl = `https://wa.me/${formattedWhatsapp}?text=${mensaje}`;

    setCart([]);
    setForm({ nombre: "", cedulaTipo: "V", cedulaNumero: "", whatsapp: "" });
    setDireccion("");
    setGpsLocation(null);
    setShowCheckoutForm(false);
    setIsOpen(false);
    setLoading(false);

    if (isMobile) {
      window.location.href = waUrl;
    } else {
      window.open(waUrl, "_blank");
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-100" onClose={setIsOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-primary-dark/20 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md h-full h-[100dvh] flex flex-col bg-white shadow-2xl overflow-hidden">
                  {/* HEADER FIJO SUPERIOR */}
                  <div className="px-5 py-3.5 border-b border-primary-light flex items-center justify-between shrink-0 bg-white z-10 shadow-xs">
                    {!showCheckoutForm ? (
                      <Dialog.Title className="text-xl font-serif text-primary-dark flex items-center gap-2 font-bold">
                        <ShoppingBag className="w-5 h-5 text-primary" /> Mi Carrito
                        {cart.length > 0 && (
                          <span className="text-xs font-sans bg-primary-light text-primary-dark font-bold px-2 py-0.5 rounded-full">
                            {cart.reduce((sum, item) => sum + item.qty, 0)}
                          </span>
                        )}
                      </Dialog.Title>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCheckoutForm(false)}
                        className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1.5 transition-colors cursor-pointer bg-primary-light/50 px-2.5 py-1.5 rounded-lg"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Volver al carrito</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-primary-dark hover:rotate-90 transition-all p-1 rounded-lg cursor-pointer"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  {/* CUERPO CENTRAL CON SCROLL FLUIDO */}
                  <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
                    {!showCheckoutForm ? (
                      /* PASO 1: LISTA DE PRODUCTOS */
                      <div>
                        {cart.length === 0 ? (
                          <div className="text-center py-20">
                            <ShoppingBag className="w-12 h-12 text-primary/30 mx-auto mb-3" />
                            <p className="text-primary font-medium italic text-sm">
                              Tu carrito está vacío... por ahora
                            </p>
                          </div>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {sortedCart.map((product) => {
                              const itemForEval = {
                                ...product,
                                price: parseFloat(product.price) || 0,
                                sku: product.sku || product.codigo_barra || product.barcode || null,
                                category_id: product.category_id || product.category || null,
                              };
                              const promoEval = evaluarPromocionProducto(itemForEval, product.qty, promotions);
                              const originalUnitPrice = promoEval.precioOriginal || (product.price ?? 0);
                              const effectiveUnitPrice = promoEval.tienePromocion ? promoEval.precioFinal : (product.price ?? 0);

                              const itemPriceBS = effectiveUnitPrice * rate;
                              const subtotalUSD = effectiveUnitPrice * product.qty;
                              const sucursalNombre =
                                product.sucursal?.nombre ||
                                product.sucursal_nombre;

                              return (
                                <li
                                  key={product.cartItemId}
                                  className="flex py-4 items-center gap-3.5"
                                >
                                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-primary-light bg-gray-50 relative">
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-primary-light/50 flex items-center justify-center text-primary font-serif font-bold text-xs">
                                        Tienda
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-semibold text-gray-800 text-sm truncate">
                                        {product.name}
                                      </h4>
                                      {promoEval.tienePromocion && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5 shrink-0">
                                          <Tag className="w-2.5 h-2.5" />
                                          {promoEval.badgeText}
                                        </span>
                                      )}
                                    </div>

                                    {sucursalNombre && (
                                      <p className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 mt-0.5 tracking-tight">
                                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">
                                          {sucursalNombre}
                                        </span>
                                      </p>
                                    )}

                                    {product.selectedOptions &&
                                      product.selectedOptions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {product.selectedOptions.map(
                                            (opt) => (
                                              <span
                                                key={opt.id}
                                                className="text-[10px] bg-primary-light text-primary-dark px-1.5 py-0.5 rounded font-medium border border-primary-light flex items-center gap-0.5"
                                              >
                                                {opt.nombre}
                                              </span>
                                            ),
                                          )}
                                        </div>
                                      )}

                                    {product.comment && (
                                      <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                        Nota: "{product.comment}"
                                      </p>
                                    )}

                                    <div className="text-xs text-gray-500 my-1 font-light flex items-center gap-1.5 flex-wrap">
                                      <span>Unitario:</span>
                                      <span className="font-semibold text-primary">
                                        ${effectiveUnitPrice.toFixed(2)}
                                      </span>
                                      {promoEval.tienePromocion && (
                                        <span className="line-through text-gray-400 text-[11px] decoration-red-400">
                                          ${originalUnitPrice.toFixed(2)}
                                        </span>
                                      )}
                                      {exchangeRate && (
                                        <span className="text-[10px] text-gray-400 font-medium">
                                          (≈ {itemPriceBS.toFixed(2)} Bs)
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateQuantity(product.cartItemId, -1)
                                          }
                                          className="px-2.5 py-1 bg-primary-light text-primary-dark hover:bg-primary/20 transition-colors font-bold text-xs"
                                        >
                                          -
                                        </button>
                                        <span className="px-3 py-1 text-xs font-semibold text-gray-700">
                                          {product.qty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateQuantity(product.cartItemId, 1)
                                          }
                                          disabled={product.qty >= product.stock}
                                          className={`px-2.5 py-1 bg-primary-light text-primary-dark transition-colors font-bold text-xs ${product.qty >= product.stock
                                              ? "opacity-30 cursor-not-allowed"
                                              : "hover:bg-primary/20"
                                            }`}
                                        >
                                          +
                                        </button>
                                      </div>

                                      {/* Sugerencia de próximo escalón de volumen */}
                                      {promoEval.proximoEscalon && (
                                        <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                          <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                          +{promoEval.proximoEscalon.cantidadFaltante} más ➔ {promoEval.proximoEscalon.tipoDescuento === 'porcentaje' ? `${promoEval.proximoEscalon.valorDescuento}%` : `$${promoEval.proximoEscalon.valorDescuento}`} off
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <p className="font-bold text-primary-dark text-sm">
                                      ${subtotalUSD.toFixed(2)}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeFromCart(product.cartItemId)
                                      }
                                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                      title="Eliminar producto"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      /* PASO 2: FORMULARIO DE CHECKOUT */
                      <form
                        id="checkout-form"
                        onSubmit={handleCheckoutSubmit}
                        className="space-y-4"
                      >
                        <div className="border border-primary-light p-3.5 rounded-2xl">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5 mb-2">
                            <User className="w-3.5 h-3.5 text-primary" /> Datos del
                            Cliente
                          </h4>
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                Nombre y Apellido *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Ej: Juan Pérez"
                                value={form.nombre}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    nombre: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary bg-white"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                  Tipo *
                                </label>
                                <select
                                  value={form.cedulaTipo}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      cedulaTipo: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary bg-white"
                                >
                                  <option value="V">V-</option>
                                  <option value="J">J-</option>
                                  <option value="E">E-</option>
                                  <option value="G">G-</option>
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                  C.I. / RIF *
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: 12345678"
                                  value={form.cedulaNumero}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      cedulaNumero: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary bg-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                WhatsApp de Contacto *
                              </label>
                              <input
                                type="tel"
                                required
                                placeholder="Ej: 04141234567"
                                value={form.whatsapp}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    whatsapp: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        {/* MÉTODO DE ENTREGA */}
                        <div className="bg-white border border-gray-200 p-3.5 rounded-2xl">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5 mb-2.5">
                            <Truck className="w-3.5 h-3.5 text-primary" /> Método de Entrega
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {DELIVERY_OPTIONS.map((opt) => {
                              const SelectedIcon = opt.Icon;
                              const isSelected = deliveryMethod === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setDeliveryMethod(opt.value)}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                                      ? "border-primary bg-primary-light/50 text-primary-dark font-bold shadow-xs"
                                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                    }`}
                                >
                                  <SelectedIcon className="w-4 h-4 text-primary mb-1" />
                                  <p className="text-xs font-semibold">
                                    {opt.label}
                                  </p>
                                  <p className="text-[10px] opacity-75 font-normal line-clamp-1">
                                    {opt.description}
                                  </p>
                                </button>
                              );
                            })}
                          </div>

                          {deliveryMethod === "shipping" && (
                            <div className="space-y-2 pt-3 mt-3 border-t border-gray-100">
                              <div>
                                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                  Dirección de Entrega Completa *
                                </label>
                                <textarea
                                  required
                                  rows={2}
                                  placeholder="Ej: Calle Principal, Res. El Sol, Apt 4B, Barquisimeto"
                                  value={direccion}
                                  onChange={(e) => setDireccion(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary bg-white"
                                />
                              </div>

                              {!gpsLocation ? (
                                <button
                                  type="button"
                                  disabled={geoLoading}
                                  onClick={handleGeolocate}
                                  className={`w-full py-2 px-3 rounded-lg border border-dashed border-primary-light text-primary hover:bg-primary-light transition-colors text-xs font-medium flex items-center justify-center gap-1.5 ${geoLoading
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                    }`}
                                >
                                  {geoLoading ? (
                                    <>
                                      <span className="animate-spin text-primary">
                                        ⏳
                                      </span>
                                      Obteniendo ubicación...
                                    </>
                                  ) : (
                                    <>
                                      <span>📍</span>
                                      Obtener mi ubicación GPS
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-[10px] text-emerald-600 bg-emerald-50 py-0.5 px-2 rounded w-fit font-medium flex items-center gap-1">
                                    <span>✓</span> Ubicación GPS guardada
                                  </div>
                                  <iframe
                                    title="Ubicación de entrega"
                                    width="100%"
                                    height="120"
                                    frameBorder="0"
                                    scrolling="no"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsLocation.lng - 0.002}%2C${gpsLocation.lat - 0.001}%2C${gpsLocation.lng + 0.002}%2C${gpsLocation.lat + 0.001}&layer=mapnik&marker=${gpsLocation.lat}%2C${gpsLocation.lng}`}
                                    className="rounded-lg border border-slate-100 shadow-inner"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {isMultiBranchCart && (
                            <p className="mt-2 text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-left font-medium leading-relaxed flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Aviso de Envío Multi-Almacén:</strong>{" "}
                                Tu pedido incluye artículos en distintas
                                sedes.
                              </span>
                            </p>
                          )}
                        </div>

                        {/* RECUADRO INDEPENDIENTE: FORMA DE PAGO */}
                        <div className="bg-white border border-gray-200 p-3.5 rounded-2xl">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5 mb-2.5">
                            <CreditCard className="w-3.5 h-3.5 text-primary" /> Forma de Pago
                          </h4>

                          {deliveryMethod === "pickup" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setPickupPaymentMethod("tienda")}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  pickupPaymentMethod === "tienda"
                                    ? "border-primary bg-primary-light/50 text-primary-dark font-bold shadow-xs"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                }`}
                              >
                                <Building2 className="w-4 h-4 text-primary mb-1" />
                                <p className="text-xs font-semibold">
                                  Pago en Tienda
                                </p>
                                <p className="text-[10px] opacity-75 font-normal line-clamp-1">
                                  Al momento de retirar
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPickupPaymentMethod("online")}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  pickupPaymentMethod === "online"
                                    ? "border-primary bg-primary-light/50 text-primary-dark font-bold shadow-xs"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                }`}
                              >
                                <MessageCircle className="w-4 h-4 text-primary mb-1" />
                                <p className="text-xs font-semibold">
                                  Pago por WhatsApp
                                </p>
                                <p className="text-[10px] opacity-75 font-normal line-clamp-1">
                                  PagoMóvil / Zelle previo
                                </p>
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2 p-2.5 rounded-xl border border-primary bg-primary-light/50 text-primary-dark text-left shadow-xs">
                                <MessageCircle className="w-4 h-4 text-primary mb-1" />
                                <p className="text-xs font-bold">
                                  Pago previo por WhatsApp
                                </p>
                                <p className="text-[10px] opacity-80 font-normal leading-relaxed">
                                  Te enviaremos los datos de PagoMóvil / Zelle / Transferencia al confirmar tu pedido.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </form>
                    )}
                  </div>

                  {/* FOOTER FIJO INAMOVIBLE EN LA PARTE INFERIOR DE LA PANTALLA */}
                  {cart.length > 0 && (
                    <div className="shrink-0 border-t border-primary-light px-5 py-4 bg-white shadow-lg z-10">
                      {!showCheckoutForm ? (
                        /* FOOTER PASO 1: FINALIZAR COMPRA */
                        <div>
                          <div className="space-y-1.5 mb-3">
                            {cartFinancials.totalDescuentoUSD > 0 && (
                              <>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                  <span>Subtotal (precio regular)</span>
                                  <span>${cartFinancials.subtotalSinDescuentoUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                                    Descuento por Promoción
                                  </span>
                                  <span>-${cartFinancials.totalDescuentoUSD.toFixed(2)} USD</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-semibold text-primary-dark font-serif">
                                Total Estimado
                              </p>
                              <div className="text-right">
                                <p className="text-lg font-bold font-serif text-primary-dark leading-none">
                                  ${cartFinancials.totalPagarUSD.toFixed(2)} USD
                                </p>
                                {exchangeRate && (
                                  <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                                    ≈ {cartFinancials.totalPagarBS.toFixed(2)} Bs
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowCheckoutForm(true)}
                            className="w-full py-3.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary-light cursor-pointer text-sm active:scale-95"
                          >
                            <span>Finalizar Compra</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        /* FOOTER PASO 2: PEDIR POR WHATSAPP */
                        <div>
                          <div className="space-y-1.5 mb-3">
                            {cartFinancials.totalDescuentoUSD > 0 && (
                              <>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                  <span>Subtotal (precio regular)</span>
                                  <span>${cartFinancials.subtotalSinDescuentoUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                                    Descuento por Promoción
                                  </span>
                                  <span>-${cartFinancials.totalDescuentoUSD.toFixed(2)} USD</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-semibold text-primary-dark font-serif">
                                Total a Pagar
                              </p>
                              <div className="text-right">
                                <p className="text-lg font-bold font-serif text-primary-dark leading-none">
                                  ${cartFinancials.totalPagarUSD.toFixed(2)} USD
                                </p>
                                {exchangeRate && (
                                  <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                                    ≈ {cartFinancials.totalPagarBS.toFixed(2)} Bs
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            form="checkout-form"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 text-white shadow-md cursor-pointer text-sm active:scale-95 ${loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-primary-dark shadow-primary-light"
                              }`}
                          >
                            {loading ? (
                              <>
                                <span className="animate-spin text-sm">⏳</span>
                                <span>Procesando...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
                                </svg>
                                <span>Pedir por WhatsApp</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
