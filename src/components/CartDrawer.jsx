import { Fragment, useState, useEffect } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { supabase } from "../utils/supabase";
import { sortBranchesByProximity } from "../utils/geo";

const buildWhatsAppMessage = ({
  nombre,
  cedula,
  whatsapp,
  cart,
  totalUSD,
  totalBS,
  deliveryMethod,
  direccion,
  gpsUrl,
  lugarPago,
}) => {
  const entrega =
    deliveryMethod === "shipping" ? "Envío a domicilio" : "Retiro en tienda";

  let mensaje =
    `*Nuevo Pedido*%0A` +
    `*Cliente:* ${nombre}%0A` +
    `*C.I. / RIF:* ${cedula}%0A` +
    `*WhatsApp:* ${whatsapp}%0A` +
    `*Dirección:* ${direccion}%0A` +
    `*Método de Entrega:* ${entrega}%0A`;

  if (deliveryMethod === "pickup" && lugarPago) {
    mensaje += `*Lugar de Pago:* ${lugarPago}%0A`;
  }

  if (deliveryMethod === "shipping" && gpsUrl) {
    mensaje += `*Ubicación GPS:* ${gpsUrl}%0A`;
  }

  // Agrupar ítems automáticamente según la sucursal de pertenencia
  const itemsByBranch = {};
  cart.forEach((item) => {
    const sucNombre =
      item.sucursal?.nombre || item.sucursal_nombre || "Sucursal Principal";
    if (!itemsByBranch[sucNombre]) {
      itemsByBranch[sucNombre] = [];
    }
    let itemStr = `• ${item.qty}x ${item.name}`;
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

  mensaje +=
    `%0A*Total a pagar:* ${totalUSD.toFixed(2)} $ / ${totalBS.toFixed(2)} Bs.%0A%0A` +
    `_Enviado desde la web por el cliente_`;

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
  const { currency, exchangeRate, store } = useCurrency();
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

  // Cargar sucursales activas de la tienda
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

  // Determinar si hay productos pertenecientes a múltiples sucursales distintas
  const uniqueBranchesInCart = new Set(
    cart.map(
      (item) =>
        item.sucursal_id ||
        item.sucursal?.id ||
        item.sucursal_nombre ||
        "principal",
    ),
  );
  const isMultiBranchCart = uniqueBranchesInCart.size > 1;

  // Ordenar carrito agrupadamente por sucursal
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
          if (sorted && sorted.length > 0) {
            const nearest = sorted[0];
            const distKm = nearest.distanceKm
              ? nearest.distanceKm.toFixed(1)
              : null;
            toast.success(
              `📍 Ubicación obtenida. Sucursal más cercana: ${nearest.nombre}${distKm ? ` (${distKm} km)` : ""}`,
              { duration: 5000 },
            );
          } else {
            toast.success("Ubicación GPS registrada correctamente.");
          }
        } else {
          toast.success("Ubicación GPS registrada correctamente.");
        }

        setGeoLoading(false);
      },
      (error) => {
        console.error("Error obteniendo geolocalización:", error);
        toast.error(
          "No se pudo obtener la ubicación GPS. Verifica los permisos de tu navegador.",
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (
      !form.nombre ||
      !form.cedulaNumero ||
      !form.whatsapp ||
      !direccion.trim()
    ) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }

    setLoading(true);

    // Validar existencias y precios en tiempo real antes de finalizar
    const validation = await validateCartBeforeCheckout();
    if (!validation.valid) {
      validation.messages.forEach((msg) =>
        toast.error(msg, { duration: 5000 }),
      );
      setLoading(false);
      return;
    }

    const cedulaCompleta = `${form.cedulaTipo}-${form.cedulaNumero.trim()}`;
    const gpsUrl = gpsLocation
      ? `https://maps.google.com/?q=${gpsLocation.lat},${gpsLocation.lng}`
      : null;

    const lugarPago =
      deliveryMethod === "pickup"
        ? pickupPaymentMethod === "tienda"
          ? "Pagar en tienda"
          : "Pagar por WhatsApp"
        : null;

    const mensaje = buildWhatsAppMessage({
      nombre: form.nombre,
      cedula: cedulaCompleta,
      whatsapp: form.whatsapp,
      cart,
      totalUSD: getTotal("USD"),
      totalBS: getTotal("BS"),
      deliveryMethod,
      direccion,
      gpsUrl,
      lugarPago,
    });

    try {
      const { data: pedidoId, error: rpcError } = await supabase.rpc(
        "crear_pedido",
        {
          p_store_id: Number(store.id),
          p_nombre_cliente: `${form.nombre} (${cedulaCompleta})`,
          p_whatsapp_cliente: form.whatsapp,
          p_metodo_entrega: deliveryMethod,
          p_direccion_entrega: direccion,
          p_gps_url: gpsUrl,
          p_total_usd: getTotal("USD"),
          p_total_bs: getTotal("BS"),
          p_moneda_activa: currency,
          p_lugar_pago: lugarPago,
          p_items: cart.map((item) => ({
            producto_id: item.id ? Number(item.id) : null,
            nombre_producto: item.name,
            cantidad: item.qty,
            precio_unitario: item.price,
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
          })),
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

      console.log("Pedido guardado exitosamente con ID:", pedidoId);
      toast.success("¡Pedido registrado exitosamente en sistema!");
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
    if (formattedWhatsapp.length > 0) {
      if (formattedWhatsapp.startsWith("0")) {
        formattedWhatsapp = "58" + formattedWhatsapp.substring(1);
      } else if (
        formattedWhatsapp.length === 10 &&
        !formattedWhatsapp.startsWith("58")
      ) {
        formattedWhatsapp = "58" + formattedWhatsapp;
      }
    } else {
      formattedWhatsapp = "584245305968";
    }

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
                              const itemPriceUSD = product.price ?? 0;
                              const itemPriceBS =
                                product.price_bs ?? itemPriceUSD * rate;
                              const subtotalUSD = itemPriceUSD * product.qty;
                              const subtotalBS = itemPriceBS * product.qty;
                              const sucursalNombre =
                                product.sucursal?.nombre ||
                                product.sucursal_nombre;

                              return (
                                <li
                                  key={product.cartItemId}
                                  className="flex py-4 items-center gap-3.5"
                                >
                                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-primary-light bg-gray-50">
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-primary-light/50 flex items-center justify-center text-primary font-serif font-bold text-xs">
                                        Farma
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-800 text-sm truncate">
                                      {product.name}
                                    </h4>

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
                                                {opt.price_modifier > 0 && (
                                                  <span className="opacity-80">
                                                    (+$
                                                    {opt.price_modifier.toFixed(
                                                      2,
                                                    )}
                                                    )
                                                  </span>
                                                )}
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

                                    <p className="text-xs text-gray-500 my-1 font-light flex items-center gap-1.5 flex-wrap">
                                      <span>
                                        Unitario: ${itemPriceUSD.toFixed(2)}
                                      </span>
                                      {exchangeRate && (
                                        <span className="text-[11px] text-gray-400 font-medium">
                                          (≈ {itemPriceBS.toFixed(2)} Bs)
                                        </span>
                                      )}
                                    </p>

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
                                        className={`px-2.5 py-1 bg-primary-light text-primary-dark transition-colors font-bold text-xs ${
                                          product.qty >= product.stock
                                            ? "opacity-30 cursor-not-allowed"
                                            : "hover:bg-primary/20"
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <p className="font-bold text-primary-dark text-sm">
                                      ${subtotalUSD.toFixed(2)}
                                    </p>
                                    {exchangeRate && (
                                      <p className="text-[11px] text-gray-500 font-medium opacity-85">
                                        ≈ {subtotalBS.toFixed(2)} Bs
                                      </p>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeFromCart(product.cartItemId)
                                      }
                                      className="text-gray-400 hover:text-rose-600 transition-colors p-1 rounded-lg"
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
                      /* PASO 2: FORMULARIO DE CHECKOUT SCROLLEABLE */
                      <form
                        id="checkout-form"
                        onSubmit={handleCheckout}
                        className="space-y-4 animate-in fade-in duration-200"
                      >
                        {/* Resumen Compacto */}
                        <div className="bg-primary-light/40 border border-primary-light/80 rounded-xl p-3 space-y-1">
                          <p className="text-[11px] font-bold text-primary-dark uppercase tracking-wider flex items-center justify-between">
                            <span>
                              Resumen ({cart.reduce((a, c) => a + c.qty, 0)}{" "}
                              productos)
                            </span>
                            <span className="font-mono text-xs">
                              ${getTotal("USD").toFixed(2)} USD
                            </span>
                          </p>
                          <p className="text-[11px] text-gray-600 truncate">
                            {cart.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                          </p>
                        </div>

                        {/* Selector método de entrega */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-primary-dark mb-1.5 block">
                            Elige el Método de Entrega *
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {DELIVERY_OPTIONS.map(({ value, label, Icon }) => {
                              const active = deliveryMethod === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setDeliveryMethod(value)}
                                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                                    active
                                      ? "border-primary bg-primary-light text-primary-dark font-semibold shadow-xs"
                                      : "border-gray-200 bg-white text-gray-500 hover:border-primary-light"
                                  }`}
                                >
                                  <Icon
                                    className={`w-5 h-5 ${active ? "text-primary" : "text-gray-400"}`}
                                  />
                                  <span className="text-xs leading-tight">
                                    {label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Datos de Cliente & Facturación */}
                        <div className="pt-2 border-t border-primary-light/60 space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-primary" />
                            Datos de Cliente & Facturación
                          </p>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                              Nombre Completo *
                            </label>
                            <div className="relative">
                              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                required
                                type="text"
                                value={form.nombre}
                                placeholder="Ej. María Pérez"
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                                onChange={(e) =>
                                  setForm({ ...form, nombre: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                              Identificación (C.I. / RIF) *
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={form.cedulaTipo}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    cedulaTipo: e.target.value,
                                  })
                                }
                                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-primary outline-none"
                              >
                                <option value="V">V-</option>
                                <option value="E">E-</option>
                                <option value="J">J-</option>
                                <option value="G">G-</option>
                                <option value="P">P-</option>
                              </select>
                              <div className="relative flex-1">
                                <IdCard className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  required
                                  type="text"
                                  value={form.cedulaNumero}
                                  placeholder="12345678"
                                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      cedulaNumero: e.target.value.replace(
                                        /\D/g,
                                        "",
                                      ),
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                              Número de WhatsApp *
                            </label>
                            <div className="relative">
                              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                required
                                type="tel"
                                value={form.whatsapp}
                                placeholder="04121234567"
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                                onChange={(e) =>
                                  setForm({ ...form, whatsapp: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                              Dirección de Facturación / Habitación *
                            </label>
                            <div className="relative">
                              <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                              <textarea
                                required
                                value={direccion}
                                placeholder="Calle, avenida, casa/apto y punto de referencia..."
                                rows={2}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm resize-none"
                                onChange={(e) => setDireccion(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Opciones de Lugar de Pago para Retiro en Tienda */}
                          {deliveryMethod === "pickup" && (
                            <div className="pt-1 space-y-1.5 animate-in fade-in duration-200">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-primary-dark block">
                                ¿Dónde realizarás el pago? *
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickupPaymentMethod("tienda")
                                  }
                                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    pickupPaymentMethod === "tienda"
                                      ? "border-primary bg-primary-light text-primary-dark shadow-xs"
                                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                  }`}
                                >
                                  <span>🏪 Pagar en tienda</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickupPaymentMethod("whatsapp")
                                  }
                                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    pickupPaymentMethod === "whatsapp"
                                      ? "border-primary bg-primary-light text-primary-dark shadow-xs"
                                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                  }`}
                                >
                                  <span>💬 Pagar por WhatsApp</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* GPS & Avisos para Envío */}
                          {deliveryMethod === "shipping" && (
                            <div className="space-y-2 pt-1">
                              {isMobile && (
                                <div className="bg-white rounded-xl p-3 border border-primary-light space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-semibold text-primary-dark">
                                      📍 Ubicación GPS (Recomendado)
                                    </span>
                                    {gpsLocation && (
                                      <button
                                        type="button"
                                        onClick={() => setGpsLocation(null)}
                                        className="text-[10px] text-primary hover:text-primary-dark hover:underline"
                                      >
                                        Quitar
                                      </button>
                                    )}
                                  </div>

                                  {!gpsLocation ? (
                                    <button
                                      type="button"
                                      disabled={geoLoading}
                                      onClick={handleGeolocate}
                                      className={`w-full py-2 px-3 rounded-lg border border-dashed border-primary-light text-primary hover:bg-primary-light transition-colors text-xs font-medium flex items-center justify-center gap-1.5 ${
                                        geoLoading
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

                              {(isMultiBranchCart || sucursales.length > 1) && (
                                <p className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-left font-medium leading-relaxed flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Aviso de Envío Multi-Almacén:</strong>{" "}
                                    Tu pedido incluye artículos en distintas
                                    sedes. Se coordinará recargo adicional por
                                    logística.
                                  </span>
                                </p>
                              )}

                              <p className="text-xs text-primary bg-primary-light/50 border border-primary-light rounded-xl p-2.5 text-center font-medium leading-relaxed">
                                🛵 El costo de envío se coordinará tras enviar
                                el pedido.
                              </p>
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
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-primary-dark font-serif">
                              Total Estimado
                            </p>
                            <div className="text-right">
                              <p className="text-lg font-bold font-serif text-primary-dark leading-none">
                                ${getTotal("USD").toFixed(2)} USD
                              </p>
                              {exchangeRate && (
                                <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                                  ≈ {getTotal("BS").toFixed(2)} Bs
                                </p>
                              )}
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
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-primary-dark font-serif">
                              Total a Pagar
                            </p>
                            <div className="text-right">
                              <p className="text-lg font-bold font-serif text-primary-dark leading-none">
                                ${getTotal("USD").toFixed(2)} USD
                              </p>
                              {exchangeRate && (
                                <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                                  ≈ {getTotal("BS").toFixed(2)} Bs
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="submit"
                            form="checkout-form"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 text-white shadow-md cursor-pointer text-sm active:scale-95 ${
                              loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-primary-dark shadow-primary-light"
                            }`}
                          >
                            {loading ? (
                              <>
                                <span className="animate-spin text-sm">⏳</span>
                                <span>Procesando pedido...</span>
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
