// components/CartDrawer.jsx

import React, { Fragment, useState, useEffect, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  X,
  ShoppingBag,
  Trash2,
  Store,
  Truck,
  FileText,
  User,
  Phone,
  MapPin,
  IdCard,
  ArrowRight,
  ArrowLeft,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import toast from "react-hot-toast";
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
    `%0A%0A💳 *Pago:* El pago total del pedido se realizará a nuestra cuenta bancaria/pago móvil centralizada.%0A` +
    `*Total a pagar:* ${totalUSD.toFixed(2)} $ / ${totalBS.toFixed(2)} Bs.%0A%0A` +
    `_Enviado desde la web_`;

  return mensaje;
};

const DELIVERY_OPTIONS = [
  {
    value: "pickup",
    label: "Retiro en tienda",
    description: "Recoge tu pedido en nuestro punto de despacho",
    Icon: Store,
  },
  {
    value: "shipping",
    label: "Envío a domicilio",
    description: "El costo será dado al crear el pedido basado en la distancia",
    Icon: Truck,
  },
];

export default function CartDrawer({ isOpen, setIsOpen }) {
  const {
    cart,
    getTotal,
    removeFromCart,
    updateQuantity,
    setCart,
    validateCartBeforeCheckout,
  } = useCart();
  const { currency, isBS, exchangeRate, store } = useCurrency();

  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState("");
  const [isGeoSorted, setIsGeoSorted] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cedulaTipo: "V",
    cedulaNumero: "",
    whatsapp: "",
  });
  const [direccion, setDireccion] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Cargar sucursales activas de la tienda
  useEffect(() => {
    if (!store?.id) return;
    const fetchSucursales = async () => {
      try {
        const { data, error } = await supabase
          .from("sucursal")
          .select("*")
          .eq("store_id", store.id)
          .eq("is_active", true)
          .order("es_principal", { ascending: false })
          .order("created_at", { ascending: true });

        if (!error && data) {
          setSucursales(data);
          if (data.length > 0 && !selectedSucursalId) {
            setSelectedSucursalId(data[0].id.toString());
          }
        }
      } catch (err) {
        console.error("Error al cargar sucursales en CartDrawer:", err);
      }
    };
    fetchSucursales();
  }, [store?.id]);

  // Resetear vista al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setShowCheckoutForm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileUA =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          ua.toLowerCase(),
        );
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const rate = exchangeRate || 1;

  // Sucursales presentes en los ítems del carrito
  const branchesInCart = useMemo(() => {
    const branchSet = new Set();
    cart.forEach((item) => {
      if (item.sucursal_id) branchSet.add(item.sucursal_id);
      else if (item.sucursal?.id) branchSet.add(item.sucursal.id);
    });
    return Array.from(branchSet);
  }, [cart]);

  // Ítems del carrito ordenados por sucursal
  const sortedCart = useMemo(() => {
    return [...cart].sort((a, b) => {
      const nameA = a.sucursal?.nombre || a.sucursal_nombre || "Principal";
      const nameB = b.sucursal?.nombre || b.sucursal_nombre || "Principal";
      return nameA.localeCompare(nameB);
    });
  }, [cart]);

  const isMultiBranchCart = branchesInCart.length > 1;

  const handleSortBranchesByProximity = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsLocation(coords);
        const sorted = sortBranchesByProximity(sucursales, coords);
        setSucursales(sorted);
        if (sorted.length > 0) {
          setSelectedSucursalId(sorted[0].id.toString());
        }
        setIsGeoSorted(true);
        setGeoLoading(false);
        toast.success("📍 Sucursales ordenadas por cercanía a tu ubicación.");
      },
      (err) => {
        console.error(err);
        setGeoLoading(false);
        toast.error("No se pudo obtener ubicación GPS para ordenar sucursales.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleGeolocate = () => {
    setGeoLoading(true);
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.");
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };
        setGpsLocation(coords);

        if (sucursales.length > 1 && !isGeoSorted) {
          const sorted = sortBranchesByProximity(sucursales, coords);
          setSucursales(sorted);
          if (sorted.length > 0) {
            setSelectedSucursalId(sorted[0].id.toString());
          }
          setIsGeoSorted(true);
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "es" } },
          );
          const data = await response.json();
          if (data && data.display_name) {
            setDireccion(data.display_name);
          }
        } catch (err) {
          console.error("Error al obtener dirección desde coordenadas:", err);
        } finally {
          setGeoLoading(false);
          toast.success("📍 Ubicación obtenida y dirección autocompletada.");
        }
      },
      (error) => {
        console.error(error);
        setGeoLoading(false);
        let msg = "No se pudo obtener la ubicación GPS.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Permiso de ubicación denegado. Actívalo en tu navegador.";
        }
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const selectedSucursalObj = useMemo(() => {
    return sucursales.find((s) => s.id.toString() === selectedSucursalId) || sucursales[0] || null;
  }, [sucursales, selectedSucursalId]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);

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
      sucursal: selectedSucursalObj,
    });

    try {
      const { data: pedidoId, error: rpcError } = await supabase.rpc(
        "crear_pedido",
        {
          p_store_id: store.id,
          p_nombre_cliente: `${form.nombre} (${cedulaCompleta})`,
          p_whatsapp_cliente: form.whatsapp,
          p_metodo_entrega: deliveryMethod,
          p_direccion_entrega: direccion,
          p_gps_url: gpsUrl,
          p_total_usd: getTotal("USD"),
          p_total_bs: getTotal("BS"),
          p_moneda_activa: currency,
          p_items: cart.map((item) => ({
            producto_id: item.id,
            nombre_producto: item.name,
            cantidad: item.qty,
            precio_unitario: item.price,
            comentario: item.comment || null,
            opciones_seleccionadas: item.selectedOptions || null,
            sucursal_id: item.sucursal_id || item.sucursal?.id || null,
            sucursal_nombre: item.sucursal?.nombre || item.sucursal_nombre || null,
            sku: item.sku || null,
            codigo_barra: item.barcode || item.codigo_barra || null,
          })),
        },
      );

      if (rpcError) throw rpcError;
      console.log("Pedido guardado exitosamente con ID:", pedidoId);
    } catch (dbErr) {
      console.error("Error al guardar el pedido en Supabase:", dbErr);
      toast.error(
        "Ocurrió un inconveniente al registrar la orden, procediendo con WhatsApp...",
        {
          duration: 5000,
        },
      );
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

    toast.success("¡Generando pedido! Abriendo WhatsApp...", {
      duration: 4000,
      icon: "🍰",
    });

    setCart([]);
    setForm({ nombre: "", cedulaTipo: "V", cedulaNumero: "", whatsapp: "" });
    setDireccion("");
    setGpsLocation(null);
    setDeliveryMethod("pickup");
    setShowCheckoutForm(false);
    setIsOpen(false);

    window.open(`https://wa.me/${formattedWhatsapp}?text=${mensaje}`, "_blank");
    setLoading(false);
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
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-2xl">
                    {/* Lista de productos */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="flex items-start justify-between border-b border-primary-light pb-4">
                        <Dialog.Title className="text-2xl font-serif text-primary-dark flex items-center gap-2">
                          <ShoppingBag className="w-6 h-6 text-primary" /> Mi Carrito
                        </Dialog.Title>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="text-primary hover:text-primary-dark hover:rotate-90 transition-all p-1 rounded-lg"
                        >
                          <X className="h-7 w-7" />
                        </button>
                      </div>

                      <div className="mt-6">
                        {cart.length === 0 ? (
                          <p className="text-center text-primary font-light italic mt-20">
                            Tu carrito está vacío... por ahora
                          </p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {sortedCart.map((product) => {
                              const itemPriceUSD = product.price ?? 0;
                              const itemPriceBS = product.price_bs ?? (itemPriceUSD * rate);
                              const subtotalUSD = itemPriceUSD * product.qty;
                              const subtotalBS = itemPriceBS * product.qty;
                              const sucursalNombre = product.sucursal?.nombre || product.sucursal_nombre;

                              return (
                                <li
                                  key={product.cartItemId}
                                  className="flex py-5 items-center gap-4"
                                >
                                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-primary-light">
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-primary-light/50" />
                                    )}
                                  </div>

                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-800 text-sm">
                                      {product.name}
                                    </h4>

                                    {/* Sucursal de Pertenencia (Sutil) */}
                                    {sucursalNombre && (
                                      <p className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 mt-0.5 tracking-tight">
                                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>{sucursalNombre}</span>
                                      </p>
                                    )}

                                    {/* Modificadores Seleccionados */}
                                    {product.selectedOptions &&
                                      product.selectedOptions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {product.selectedOptions.map((opt) => (
                                            <span
                                              key={opt.id}
                                              className="text-[10px] bg-primary-light text-primary-dark px-1.5 py-0.5 rounded font-medium border border-primary-light flex items-center gap-0.5"
                                            >
                                              {opt.nombre}
                                              {opt.price_modifier > 0 && (
                                                <span className="opacity-80">
                                                  (+$
                                                  {opt.price_modifier.toFixed(2)})
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                    {/* Nota especial */}
                                    {product.comment && (
                                      <p className="text-[10px] text-slate-500 italic mt-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        Nota: "{product.comment}"
                                      </p>
                                    )}

                                    {/* Precio Unitario (USD + Bs) */}
                                    <p className="text-xs text-gray-500 my-1 font-light flex items-center gap-1.5 flex-wrap">
                                      <span>Unitario: {itemPriceUSD.toFixed(2)} $</span>
                                      {exchangeRate && (
                                        <span className="text-[11px] text-gray-400 font-medium">
                                          (≈ {itemPriceBS.toFixed(2)} Bs)
                                        </span>
                                      )}
                                    </p>

                                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit">
                                      <button
                                        onClick={() =>
                                          updateQuantity(product.cartItemId, -1)
                                        }
                                        className="px-2 py-0.5 bg-primary-light text-primary-dark hover:bg-primary/20 transition-colors"
                                      >
                                        -
                                      </button>
                                      <span className="px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                        {product.qty}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateQuantity(product.cartItemId, 1)
                                        }
                                        disabled={product.qty >= product.stock}
                                        className={`px-2 py-0.5 bg-primary-light text-primary-dark transition-colors
                                          ${product.qty >= product.stock ? "opacity-30 cursor-not-allowed" : "hover:bg-primary/20"}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Subtotal (USD + Bs sutil) */}
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <p className="font-semibold text-primary text-sm">
                                      {subtotalUSD.toFixed(2)} $
                                    </p>
                                    {exchangeRate && (
                                      <p className="text-[11px] text-gray-500 font-medium opacity-85">
                                        ≈ {subtotalBS.toFixed(2)} Bs
                                      </p>
                                    )}
                                    <button
                                      onClick={() =>
                                        removeFromCart(product.cartItemId)
                                      }
                                      className="text-gray-400 hover:text-red-600 transition-colors mt-1"
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
                    </div>

                    {/* PASO 1: RESUMEN Y BOTÓN FINALIZAR COMPRA */}
                    {cart.length > 0 && !showCheckoutForm && (
                      <div className="border-t border-primary-light px-6 py-5 bg-primary-light/20">
                        <div className="flex justify-between items-center mb-4">
                          <p className="text-lg font-serif text-primary-dark font-semibold">
                            Total Estimado
                          </p>
                          <div className="text-right">
                            <p className="text-xl font-bold font-serif text-primary-dark">
                              {getTotal("USD").toFixed(2)} $
                            </p>
                            {exchangeRate && (
                              <p className="text-xs font-medium text-gray-500 opacity-85">
                                ≈ {getTotal("BS").toFixed(2)} Bs
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCheckoutForm(true)}
                          className="w-full py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary-light cursor-pointer text-base active:scale-95"
                        >
                          <span>Finalizar Compra</span>
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    {/* PASO 2: FORMULARIO DE FACTURACIÓN Y BOTÓN PEDIR POR WHATSAPP */}
                    {cart.length > 0 && showCheckoutForm && (
                      <div className="border-t border-primary-light px-6 py-5 bg-primary-light/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={() => setShowCheckoutForm(false)}
                            className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Volver a lista
                          </button>
                        </div>

                        <form onSubmit={handleCheckout} className="space-y-3.5">
                          {/* Selector método de entrega */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-primary-dark mb-1.5 block">
                              Elige el Método de Entrega
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {DELIVERY_OPTIONS.map(
                                ({ value, label, description, Icon }) => {
                                  const active = deliveryMethod === value;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setDeliveryMethod(value)}
                                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all duration-200 ${
                                        active
                                          ? "border-primary bg-primary-light text-primary-dark font-semibold shadow-xs"
                                          : "border-gray-200 bg-white text-gray-400 hover:border-primary-light"
                                      }`}
                                    >
                                      <Icon
                                        style={{ width: 20, height: 20 }}
                                        className={
                                          active
                                            ? "text-primary"
                                            : "text-gray-300"
                                        }
                                      />
                                      <span className="text-xs leading-tight">
                                        {label}
                                      </span>
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>

                          {/* Sección Datos de Facturación */}
                          <div className="pt-2 border-t border-primary-light/60 space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary-dark flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-primary" />
                              Datos de Cliente & Facturación
                            </p>

                            {/* Nombre Completo */}
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

                            {/* Identificación Venezolana (Tipo + Número) */}
                            <div>
                              <label className="text-[11px] font-semibold text-gray-600 mb-1 block">
                                Identificación (C.I. / RIF) *
                              </label>
                              <div className="flex gap-2">
                                <div className="relative shrink-0">
                                  <select
                                    value={form.cedulaTipo}
                                    onChange={(e) =>
                                      setForm({ ...form, cedulaTipo: e.target.value })
                                    }
                                    className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-primary outline-none"
                                  >
                                    <option value="V">V-</option>
                                    <option value="E">E-</option>
                                    <option value="J">J-</option>
                                    <option value="G">G-</option>
                                    <option value="P">P-</option>
                                  </select>
                                </div>
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
                                        cedulaNumero: e.target.value.replace(/\D/g, ""),
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            {/* WhatsApp */}
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

                            {/* Dirección */}
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

                            {/* Ubicación GPS opcional para Envío a Domicilio */}
                            {deliveryMethod === "shipping" && (
                              <div className="space-y-2 pt-1 transition-all duration-300">
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
                                        className={`w-full py-2 px-3 rounded-lg border border-dashed border-primary-light text-primary hover:bg-primary-light transition-colors text-xs font-medium flex items-center justify-center gap-1.5 ${geoLoading ? "opacity-50 cursor-not-allowed" : ""}`}
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
                                          height="130"
                                          frameBorder="0"
                                          scrolling="no"
                                          marginHeight="0"
                                          marginWidth="0"
                                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsLocation.lng - 0.002}%2C${gpsLocation.lat - 0.001}%2C${gpsLocation.lng + 0.002}%2C${gpsLocation.lat + 0.001}&layer=mapnik&marker=${gpsLocation.lat}%2C${gpsLocation.lng}`}
                                          className="rounded-lg border border-slate-100 shadow-inner"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* AVISO RECARGO ENVÍO MULTI-ALMACÉN */}
                                {(isMultiBranchCart || sucursales.length > 1) && (
                                  <p className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-left font-medium leading-relaxed flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span>
                                      <strong>Aviso de Envío Multi-Almacén:</strong> Tu pedido incluye artículos distribuidos en sedes de la ciudad. Se coordinará un recargo de envío adicional por logística.
                                    </span>
                                  </p>
                                )}

                                <p className="text-xs text-primary bg-primary-light/50 border border-primary-light rounded-xl p-2.5 text-center font-medium leading-relaxed">
                                  🛵 El costo de envío se coordinará y procesará luego de enviarnos el pedido.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* BLOQUE TOTAL A PAGAR ($ + BS SUTIL) ENTRE FORMULARIO Y BOTÓN DE WHATSAPP */}
                          <div className="pt-3 pb-1 border-t border-primary-light/60 flex items-center justify-between">
                            <span className="text-sm font-semibold text-primary-dark font-serif">
                              Total a pagar
                            </span>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary-dark leading-tight">
                                {getTotal("USD").toFixed(2)} $
                              </p>
                              {exchangeRate && (
                                <p className="text-xs text-gray-500 font-medium opacity-85">
                                  ≈ {getTotal("BS").toFixed(2)} Bs
                                </p>
                              )}
                            </div>
                          </div>

                          {/* BOTÓN PEDIR POR WHATSAPP */}
                          <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-2
                              ${loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-primary-dark text-white shadow-primary-light"
                              }`}
                          >
                            {loading ? (
                              <>
                                <span className="animate-spin mr-2">⏳</span>
                                Procesando pedido...
                              </>
                            ) : (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="22"
                                  height="22"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
                                </svg>
                                Pedir por WhatsApp
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
