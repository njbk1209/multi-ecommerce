// components/CartDrawer.jsx

import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  X,
  ShoppingBag,
  Trash2,
  MessageCircle,
  Store,
  Truck,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";

const buildWhatsAppMessage = ({
  nombre,
  whatsapp,
  cart,
  totalUSD,
  totalBS,
  deliveryMethod,
  direccion,
  gpsUrl,
}) => {
  const lineas = cart
    .map((item) => {
      let itemStr = `• ${item.qty}x ${item.name}`;
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        const opts = item.selectedOptions.map((o) => o.nombre).join(", ");
        itemStr += ` (${opts})`;
      }
      if (item.comment) {
        itemStr += ` [Nota: ${item.comment}]`;
      }
      return itemStr;
    })
    .join("%0A");

  const entrega =
    deliveryMethod === "shipping" ? "Envío a domicilio" : "Retiro en tienda";

  let mensaje =
    `*Nuevo Pedido` +
    `*Cliente:* ${nombre}%0A` +
    `*WhatsApp:* ${whatsapp}%0A` +
    `*Entrega:* ${entrega}%0A`;

  if (deliveryMethod === "shipping") {
    if (direccion) {
      mensaje += `*Dirección:* ${direccion}%0A`;
    }
    if (gpsUrl) {
      mensaje += `*Ubicación GPS:* ${gpsUrl}%0A`;
    }
  }

  mensaje +=
    `%0A*Productos:*%0A${lineas}%0A%0A` +
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
  const { currency, isBS, store } = useCurrency();
  const [form, setForm] = useState({ nombre: "", whatsapp: "" });
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [direccion, setDireccion] = useState("");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const total = getTotal(currency);
  const symbol = isBS ? "Bs" : "$";

  const unitPrice = (item) => (isBS ? item.price_bs : item.price);
  const subtotal = (item) => ((unitPrice(item) ?? 0) * item.qty).toFixed(2);

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
        setGpsLocation({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "es" } }, // Forzar respuesta en español si está disponible
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

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validar el carrito con Supabase antes de procesar
    const validation = await validateCartBeforeCheckout();
    if (!validation.valid) {
      validation.messages.forEach((msg) =>
        toast.error(msg, { duration: 5000 }),
      );
      setLoading(false);
      return;
    }

    const gpsUrl = gpsLocation
      ? `https://maps.google.com/?q=${gpsLocation.lat},${gpsLocation.lng}`
      : null;

    const mensaje = buildWhatsAppMessage({
      nombre: form.nombre,
      whatsapp: form.whatsapp,
      cart,
      totalUSD: getTotal("USD"),
      totalBS: getTotal("BS"),
      deliveryMethod,
      direccion,
      gpsUrl,
    });

    // Guardar el pedido en Supabase a través de una función RPC transaccional
    try {
      const { data: pedidoId, error: rpcError } = await supabase.rpc(
        "crear_pedido",
        {
          p_store_id: store.id,
          p_nombre_cliente: form.nombre,
          p_whatsapp_cliente: form.whatsapp,
          p_metodo_entrega: deliveryMethod,
          p_direccion_entrega: deliveryMethod === "shipping" ? direccion : null,
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

    // Formatear el número de whatsapp de la tienda
    const storeWhatsapp = store?.whatsapp || "584245305968";
    let formattedWhatsapp = storeWhatsapp.replace(/\D/g, ""); // Deja solo dígitos
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
      formattedWhatsapp = "584245305968"; // Fallback
    }

    toast.success("¡Generando pedido! Abriendo WhatsApp...", {
      duration: 4000,
      icon: "🍰",
    });

    setCart([]);
    setForm({ nombre: "", whatsapp: "" });
    setDireccion("");
    setGpsLocation(null);
    setDeliveryMethod("pickup");
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
          <div className="fixed inset-0 bg-rose-900/20 backdrop-blur-sm transition-opacity" />
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
                      <div className="flex items-start justify-between border-b border-rose-100 pb-4">
                        <Dialog.Title className="text-2xl font-serif text-rose-800 flex items-center gap-2">
                          <ShoppingBag className="w-6 h-6" /> Mi Carrito
                        </Dialog.Title>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="text-rose-400 hover:rotate-90 transition-all"
                        >
                          <X className="h-7 w-7" />
                        </button>
                      </div>

                      <div className="mt-8">
                        {cart.length === 0 ? (
                          <p className="text-center text-rose-400 font-light italic mt-20">
                            Tu carrito está vacío... por ahora
                          </p>
                        ) : (
                          <ul className="divide-y divide-rose-50">
                            {cart.map((product) => (
                              <li
                                key={product.cartItemId}
                                className="flex py-6 items-center gap-4"
                              >
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-rose-100">
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-rose-50" />
                                  )}
                                </div>

                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-800 text-sm">
                                    {product.name}
                                  </h4>

                                  {/* Modificadores Seleccionados */}
                                  {product.selectedOptions &&
                                    product.selectedOptions.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {product.selectedOptions.map((opt) => (
                                          <span
                                            key={opt.id}
                                            className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-medium border border-rose-100/50 flex items-center gap-0.5"
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

                                  <p className="text-xs text-rose-400 my-2 font-light">
                                    Unitario: {unitPrice(product)} {symbol}
                                  </p>

                                  <div className="flex items-center border border-rose-100 rounded-lg overflow-hidden w-fit">
                                    <button
                                      onClick={() =>
                                        updateQuantity(product.cartItemId, -1)
                                      }
                                      className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                    >
                                      -
                                    </button>
                                    <span className="px-3 py-1 text-sm font-medium text-gray-700">
                                      {product.qty}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateQuantity(product.cartItemId, 1)
                                      }
                                      disabled={product.qty >= product.stock}
                                      className={`px-2 py-1 bg-rose-50 text-rose-600 transition-colors
                                        ${product.qty >= product.stock ? "opacity-30 cursor-not-allowed" : "hover:bg-rose-100"}`}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  <p className="font-medium text-rose-600">
                                    {subtotal(product)} {symbol}
                                  </p>
                                  <button
                                    onClick={() =>
                                      removeFromCart(product.cartItemId)
                                    }
                                    className="text-rose-300 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Checkout */}
                    {cart.length > 0 && (
                      <div className="border-t border-rose-100 px-6 py-6 bg-rose-50/50">
                        <div className="flex justify-between text-xl font-serif text-rose-900 mb-5">
                          <p>Total Estimado</p>
                          <p>
                            {total.toFixed(2)} {symbol}
                          </p>
                        </div>

                        <form onSubmit={handleCheckout} className="space-y-3">
                          {/* Selector método de entrega */}
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {DELIVERY_OPTIONS.map(
                              ({ value, label, description, Icon }) => {
                                const active = deliveryMethod === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setDeliveryMethod(value)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200
                                    ${
                                      active
                                        ? "border-rose-400 bg-rose-50 text-rose-600"
                                        : "border-rose-100 bg-white text-gray-400 hover:border-rose-200"
                                    }`}
                                  >
                                    <Icon
                                      style={{ width: 24, height: 24 }}
                                      className={
                                        active
                                          ? "text-rose-500"
                                          : "text-gray-300"
                                      }
                                    />
                                    <span className="text-xs font-semibold leading-tight">
                                      {label}
                                    </span>
                                    <span className="text-[10px] leading-tight opacity-70">
                                      {description}
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>

                          <input
                            required
                            value={form.nombre}
                            placeholder="Tu Nombre"
                            className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-400 outline-none text-sm"
                            onChange={(e) =>
                              setForm({ ...form, nombre: e.target.value })
                            }
                          />
                          <input
                            required
                            value={form.whatsapp}
                            placeholder="WhatsApp (0412...)"
                            className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-400 outline-none text-sm"
                            onChange={(e) =>
                              setForm({ ...form, whatsapp: e.target.value })
                            }
                          />

                          {deliveryMethod === "shipping" && (
                            <div className="space-y-2.5 transition-all duration-300">
                              <textarea
                                required
                                value={direccion}
                                placeholder="Dirección de Entrega (calle, casa, puntos de referencia)"
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-400 outline-none text-sm resize-none"
                                onChange={(e) => setDireccion(e.target.value)}
                              />

                              {isMobile && (
                                <div className="bg-white rounded-xl p-3 border border-rose-100 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-semibold text-rose-800">
                                      📍 Ubicación GPS (Recomendado)
                                    </span>
                                    {gpsLocation && (
                                      <button
                                        type="button"
                                        onClick={() => setGpsLocation(null)}
                                        className="text-[10px] text-rose-400 hover:text-rose-600 hover:underline"
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
                                      className={`w-full py-2 px-3 rounded-lg border border-dashed border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors text-xs font-medium flex items-center justify-center gap-1.5
                                        ${geoLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                      {geoLoading ? (
                                        <>
                                          <span className="animate-spin text-rose-400">
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

                              <p className="text-xs text-rose-500 bg-rose-50/50 border border-rose-100/50 rounded-xl p-3 text-center font-medium leading-relaxed">
                                🛵 El costo de envío se coordinará y procesará
                                luego de enviarnos el pedido.
                              </p>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 shadow-lg
                              ${
                                loading
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
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
                                  width="24"
                                  height="24"
                                  fill="currentColor"
                                  className=""
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
