import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Phone,
  Package,
  Truck,
  Building2,
  PackageCheck,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";
import ProductsManager from "./ProductsManager";
import CategoriesManager from "./CategoriesManager";
import OptionsManager from "./OptionsManager";
import SettingsManager from "./SettingsManager";
import BranchesManager from "./BranchesManager";
import BranchInventoryManager from "./BranchInventoryManager";
import PickingScannerModal from "./PickingScannerModal";

const normalizePhone = (phone) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "58" + cleaned.substring(1);
  }
  if (cleaned.length === 10) {
    cleaned = "58" + cleaned;
  }
  return cleaned;
};

const normalizeEstado = (estado) => {
  if (estado === "preparando") return "preparar";
  if (estado === "completado") return "finalizado";
  return estado;
};

const getStatusLabel = (estado) => {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "preparar":
      return "Preparando";
    case "en espera de retiro":
      return "En espera de retiro";
    case "en camino":
      return "En camino";
    case "finalizado":
      return "Finalizado con éxito";
    case "cancelado":
      return "Cancelado";
    default:
      return estado;
  }
};

const ALLOWED_TRANSITIONS = {
  pendiente: ["preparar", "cancelado"],
  preparar: ["en espera de retiro"],
  "en espera de retiro": ["en camino", "finalizado", "cancelado"],
  "en camino": ["finalizado"],
  finalizado: [],
  cancelado: [],
};

const AdminDashboard = ({ onLogout, session }) => {
  const navigate = useNavigate();
  const { store, exchangeRate } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' | 'pendiente' | 'preparar' | 'en espera de retiro' | 'en camino' | 'finalizado' | 'cancelado'
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | '7days' | 'month'
  const [expandedOrders, setExpandedOrders] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shippingInputs, setShippingInputs] = useState({});
  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'products' | 'categories'
  const [pickedState, setPickedState] = useState({}); // { orderId: { itemId: count } }
  const [activePickingOrder, setActivePickingOrder] = useState(null);

  // Cargar pedidos de Supabase
  const fetchOrders = async (showToast = false) => {
    if (!store?.id) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("pedido")
        .select(
          `
          *,
          items:pedido_item (
            *
          )
        `,
        )
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalizedData = (data || []).map((order) => ({
        ...order,
        estado: normalizeEstado(order.estado),
      }));
      setOrders(normalizedData);

      // Auto-expandir el primer pedido si existe y no hay nada expandido
      if (
        normalizedData &&
        normalizedData.length > 0 &&
        Object.keys(expandedOrders).length === 0
      ) {
        setExpandedOrders({ [normalizedData[0].id]: true });
      }

      if (showToast) {
        toast.success("Pedidos sincronizados correctamente", {
          icon: "🔄",
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        });
      }
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
      toast.error("No se pudieron cargar los pedidos de la base de datos.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveShippingCost = async (orderId, costUsdVal, order) => {
    const parsedCostUsd = parseFloat(costUsdVal);
    if (isNaN(parsedCostUsd) || parsedCostUsd < 0) {
      toast.error("Ingresa un costo de envío válido.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      return;
    }

    const rate = exchangeRate || 1;
    const newCostUsd = parsedCostUsd;
    const newCostBs = newCostUsd * rate;

    const oldCostUsd = parseFloat(order.costo_envio_usd) || 0;
    const oldCostBs = parseFloat(order.costo_envio_bs) || 0;

    const subtotalUsd = order.total_usd - oldCostUsd;
    const subtotalBs = order.total_bs - oldCostBs;

    const newTotalUsd = subtotalUsd + newCostUsd;
    const newTotalBs = subtotalBs + newCostBs;

    try {
      const { error } = await supabase
        .from("pedido")
        .update({
          costo_envio_usd: newCostUsd,
          costo_envio_bs: newCostBs,
          total_usd: newTotalUsd,
          total_bs: newTotalBs,
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Costo de envío actualizado.", {
        icon: "🚚",
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
              ...o,
              costo_envio_usd: newCostUsd,
              costo_envio_bs: newCostBs,
              total_usd: newTotalUsd,
              total_bs: newTotalBs,
            }
            : o,
        ),
      );
    } catch (err) {
      console.error("Error al guardar costo de envío:", err);
      toast.error("No se pudo guardar el costo de envío.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    }
  };

  const handleSendPaymentDetails = async (order) => {
    try {
      // 1. Obtener datos de pago de la tienda
      const { data: paymentData, error } = await supabase
        .from("datos_pago")
        .select("*")
        .eq("store_id", store.id)
        .maybeSingle();

      if (error) throw error;

      // 2. Construir mensaje de WhatsApp
      const subtotal = order.total_usd - (order.costo_envio_usd || 0);
      const isBs = order.moneda_activa === "BS";
      const rate = exchangeRate || 1;

      // Formatear precios en la moneda activa del pedido
      const formatPrice = (usdVal) => {
        if (isBs) {
          const bsVal = usdVal * rate;
          return `${bsVal.toLocaleString("es-VE")} Bs`;
        }
        return `$${usdVal.toFixed(2)} USD`;
      };

      let mensaje =
        `Hola *${order.nombre_cliente}*! \n\n` +
        `Tu pedido *#${order.id}* ha sido procesado. Aquí tienes los detalles para realizar tu pago:\n\n`;

      mensaje += `*Resumen del Pedido:*\n`;
      (order.items || []).forEach((item) => {
        let itemStr = `• ${item.cantidad}x ${item.nombre_producto}`;
        if (item.opciones_seleccionadas && item.opciones_seleccionadas.length > 0) {
          const opts = item.opciones_seleccionadas.map((o) => o.nombre).join(", ");
          itemStr += ` (${opts})`;
        }
        mensaje += `${itemStr}\n`;
      });

      if (order.metodo_entrega === "shipping" && order.costo_envio_usd > 0) {
        const envBs = order.costo_envio_bs || (order.costo_envio_usd * rate);
        mensaje += `• Costo de envío (${order.costo_envio_usd.toFixed(2)} $ / ${envBs.toFixed(2)} Bs)\n`;
      }

      mensaje += `\n`;

      if (paymentData) {
        mensaje += `*Métodos de Pago Disponibles:*\n\n`;

        let hasPaymentMethod = false;

        if (paymentData.pago_movil_banco && paymentData.pago_movil_telefono) {
          hasPaymentMethod = true;
          const totalBs = order.total_usd * rate;
          mensaje +=
            `*Pago Móvil:*\n` +
            `- Banco: ${paymentData.pago_movil_banco}\n` +
            `- Teléfono: ${paymentData.pago_movil_telefono}\n` +
            `- Cédula: ${paymentData.pago_movil_cedula || "N/A"}\n` +
            `- Monto a pagar: ${totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs\n\n`;
        }

        if (paymentData.zelle_email) {
          hasPaymentMethod = true;
          mensaje +=
            `💵 *Zelle:*\n` +
            `- Correo: ${paymentData.zelle_email}\n` +
            `- Titular: ${paymentData.zelle_nombre || "N/A"}\n` +
            `- Monto a pagar: $${order.total_usd.toFixed(2)} USD\n\n`;
        }

        if (paymentData.binance_id || paymentData.binance_email) {
          hasPaymentMethod = true;
          mensaje +=
            `*Binance Pay:*\n` +
            `- ID: ${paymentData.binance_id || "N/A"}\n` +
            `- Correo: ${paymentData.binance_email || "N/A"}\n` +
            `- Monto a pagar: $${order.total_usd.toFixed(2)} USD\n\n`;
        }

        if (!hasPaymentMethod) {
          mensaje += `Contacta con nosotros por este medio para acordar la forma de pago.\n\n`;
        }
      } else {
        mensaje += `Contacta con nosotros por este medio para acordar la forma de pago.\n\n`;
      }

      mensaje += `Por favor, envíanos el capture o comprobante del pago por aquí. ¡Muchas gracias!`;

      const normalizedPhone = normalizePhone(order.whatsapp_cliente);
      const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(mensaje)}`;
      window.open(waUrl, "_blank");
    } catch (err) {
      console.error("Error al enviar detalles de pago:", err);
      toast.error(
        "No se pudieron obtener los datos de pago para construir el mensaje.",
        {
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        },
      );
    }
  };

  const handleSendReadyForPickupMessage = async (order) => {
    let mensaje =
      `¡Hola *${order.nombre_cliente}*!\n\n` +
      `Te escribimos para informarte que tu pedido *#${order.id}* ya está listo para ser retirado.\n\n`;

    try {
      const { data: sucursalData } = await supabase
        .from("sucursal")
        .select("*")
        .eq("store_id", store.id);

      const sucursalMap = new Map((sucursalData || []).map((s) => [s.id, s]));

      // Agrupar ítems por sucursal
      const grouped = {};
      (order.items || []).forEach((item) => {
        const sucId = item.sucursal_id || "principal";
        const sucName = item.sucursal_nombre || item.sucursal?.nombre || null;
        if (!grouped[sucId]) {
          grouped[sucId] = {
            sucId,
            sucName,
            items: [],
          };
        }
        grouped[sucId].items.push(item);
      });

      const groups = Object.values(grouped);

      mensaje += `*Sucursales a visitar para el retiro:*\n\n`;

      groups.forEach((group) => {
        const suc = sucursalMap.get(parseInt(group.sucId));
        let nombreSuc = group.sucName || (suc ? suc.nombre : "Sucursal Principal");
        const dir = suc?.direccion || suc?.ciudad || "";
        if (dir) {
          nombreSuc += ` (${dir})`;
        }

        mensaje += `📍 *${nombreSuc}*\n`;
        group.items.forEach((i) => {
          mensaje += `• ${i.cantidad}x ${i.nombre_producto}\n`;
        });
        mensaje += `\n`;
      });
    } catch (err) {
      mensaje += `Puedes pasar a buscarlo en nuestro punto de despacho.\n\n`;
    }

    mensaje += `¡Muchas gracias por tu compra!`;

    const normalizedPhone = normalizePhone(order.whatsapp_cliente);
    const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, "_blank");
  };

  const handleSendOnTheWayMessage = (order) => {
    let mensaje =
      `¡Hola *${order.nombre_cliente}*!\n\n` +
      `🛵 Tu pedido *#${order.id}* ya va en camino hacia tu dirección de entrega.\n\n`;

    if (order.direccion_entrega) {
      mensaje += `*Dirección de Entrega:* ${order.direccion_entrega}\n\n`;
    }

    mensaje += `Por favor mantente atento para recibirlo. ¡Muchas gracias por tu preferencia!`;

    const normalizedPhone = normalizePhone(order.whatsapp_cliente);
    const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, "_blank");
  };

  // Cargar al montar el componente o al cambiar de tienda
  useEffect(() => {
    fetchOrders();
  }, [store?.id]);

  const handleRefresh = () => {
    fetchOrders(true);
  };

  // Cambiar el estado de un pedido en la base de datos
  const handleUpdateStatus = async (orderId, newStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const allowed = ALLOWED_TRANSITIONS[order.estado] || [];
    if (!allowed.includes(newStatus)) {
      toast.error(
        `Transición de ${getStatusLabel(order.estado)} a ${getStatusLabel(newStatus)} no permitida.`,
        {
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        },
      );
      return;
    }

    // Si el pedido está en 'preparar' y se intenta avanzar estado, validar picking 100% obligatorio
    if (
      order.estado === "preparar" &&
      (newStatus === "en espera de retiro" || newStatus === "en camino")
    ) {
      const items = order.items || [];
      const currentPicking = pickedState[order.id] || {};
      const totalTargetQty = items.reduce((acc, i) => acc + (i.cantidad || 1), 0);
      const totalPickedQty = items.reduce(
        (acc, i) => acc + (currentPicking[i.id] ?? (i.cantidad_recolectada || 0)),
        0
      );
      const isPickingComplete =
        totalTargetQty > 0 && totalPickedQty >= totalTargetQty;

      if (!isPickingComplete) {
        toast.error(
          "⚠️ Debes completar el 100% del picking por código de barras antes de avanzar el pedido.",
          {
            duration: 5000,
            style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
          }
        );
        setActivePickingOrder(order);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("pedido")
        .update({ estado: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === orderId ? { ...o, estado: newStatus } : o,
        ),
      );
      toast.success(
        `Pedido #${orderId} cambiado a: ${getStatusLabel(newStatus)}`,
        {
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        },
      );

      // Si pasa a "en espera de retiro" y es retiro en tienda, ofrecer notificar
      if (
        newStatus === "en espera de retiro" &&
        order.metodo_entrega === "pickup"
      ) {
        setTimeout(() => {
          const confirmNotify = window.confirm(
            "¿Deseas enviar un mensaje por WhatsApp al cliente para notificarle que su pedido está listo para ser retirado?",
          );
          if (confirmNotify) {
            handleSendReadyForPickupMessage({ ...order, estado: newStatus });
          }
        }, 300);
      }

      // Si pasa a "en camino", ofrecer notificar por WhatsApp
      if (newStatus === "en camino") {
        setTimeout(() => {
          const confirmNotify = window.confirm(
            "¿Deseas enviar un mensaje por WhatsApp al cliente para notificarle que su pedido ya va en camino?",
          );
          if (confirmNotify) {
            handleSendOnTheWayMessage({ ...order, estado: newStatus });
          }
        }, 300);
      }
    } catch (err) {
      console.error("Error al actualizar estado:", err);
      toast.error("No se pudo actualizar el estado del pedido.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    }
  };

  // Toggle expansión de detalles
  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Helper para verificar si un pedido coincide con el filtro de fecha
  const matchesDateFilter = (createdAtIso, filterType) => {
    if (filterType === "all") return true;
    if (!createdAtIso) return true;

    const orderDate = new Date(createdAtIso);
    const now = new Date();

    if (filterType === "today") {
      return (
        orderDate.getDate() === now.getDate() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    if (filterType === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return orderDate >= sevenDaysAgo;
    }

    if (filterType === "month") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return orderDate >= thirtyDaysAgo;
    }

    return true;
  };

  // Pedidos filtrados por fecha para métricas
  const dateFilteredOrders = orders.filter((o) =>
    matchesDateFilter(o.created_at, dateFilter),
  );

  // Cálculos de métricas según el rango de fecha seleccionado
  const totalOrdersCount = dateFilteredOrders.length;
  const pendingCount = dateFilteredOrders.filter(
    (o) => o.estado === "pendiente",
  ).length;
  const prepararCount = dateFilteredOrders.filter(
    (o) => o.estado === "preparar",
  ).length;
  const esperaCount = dateFilteredOrders.filter(
    (o) => o.estado === "en espera de retiro",
  ).length;
  const enCaminoCount = dateFilteredOrders.filter(
    (o) => o.estado === "en camino",
  ).length;
  const finalizadoCount = dateFilteredOrders.filter(
    (o) => o.estado === "finalizado",
  ).length;
  const canceladoCount = dateFilteredOrders.filter(
    (o) => o.estado === "cancelado",
  ).length;

  // Calcular ingresos totales sumando los pedidos que no están cancelados
  const revenueUSD = dateFilteredOrders
    .filter((o) => o.estado !== "cancelado")
    .reduce((acc, o) => acc + o.total_usd, 0);

  const revenueBS = dateFilteredOrders
    .filter((o) => o.estado !== "cancelado")
    .reduce((acc, o) => acc + o.total_bs, 0);

  // Filtrado final de listado
  const filteredOrders = dateFilteredOrders.filter((order) => {
    if (filter === "all") return true;
    return order.estado === filter;
  });

  // Helper para formato de fecha simple
  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Barra de navegación superior */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-serif text-zinc-950 font-semibold tracking-tight">
              Admin
            </h1>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Conectado
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-medium text-zinc-500">
              {session?.user?.email}
            </span>
            <button
              onClick={() => {
                onLogout();
                navigate("/");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl transition-all hover:shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Pestañas de Navegación del Panel (Scroll horizontal fluido en móvil) */}
        <div className="flex border-b border-zinc-200 gap-3 sm:gap-6 mb-2 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap px-1 pb-1 shrink-0">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "orders"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            📋 Pedidos
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "products"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            🍰 Productos
          </button>
          <button
            onClick={() => setActiveTab("branches")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "branches"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            🏢 Sucursales
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "inventory"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            📦 Inventario
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "categories"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            📁 Categorías
          </button>
          <button
            onClick={() => setActiveTab("options")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "options"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            ⚙️ Modificadores
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 active:scale-95 px-1
              ${activeTab === "settings"
                ? "border-zinc-900 text-zinc-950 font-bold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
          >
            💳 Datos de Pago
          </button>
        </div>

        {activeTab === "orders" && (
          <>
            {/* Panel de Métricas (Paleta Neutra) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Pedidos Totales
                  </span>
                  <p className="text-3xl font-serif font-semibold text-zinc-900">
                    {totalOrdersCount}
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Ingresos USD
                  </span>
                  <p className="text-3xl font-serif font-semibold text-zinc-900">
                    ${revenueUSD.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Ingresos BS
                  </span>
                  <p className="text-xl font-mono font-bold text-zinc-900">
                    {revenueBS.toLocaleString("es-VE")} Bs
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Pendientes
                  </span>
                  <p className="text-3xl font-serif font-semibold text-zinc-900">
                    {pendingCount}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${pendingCount > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-zinc-50 text-zinc-600 border-zinc-100"}`}
                >
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
              </div>
            </section>
            {/* Filtros por Rango de Fecha */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Filtrar por Período:
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {[
                  { id: "all", label: "🗓️ Todos" },
                  { id: "today", label: "⚡ Hoy" },
                  { id: "7days", label: "📅 Últimos 7 días" },
                  { id: "month", label: "📆 Último mes" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setDateFilter(btn.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                      dateFilter === btn.id
                        ? "bg-zinc-950 border-zinc-950 text-white shadow-xs"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-white hover:border-zinc-300"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Encabezado del listado y filtros */}
            <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-serif font-semibold text-zinc-950">
                  Historial de Pedidos
                </h2>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`p-1.5 text-zinc-400 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-xl shadow-sm transition-all ${isRefreshing ? "animate-spin" : ""}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Selector de filtros */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Todos" },
                  { id: "pendiente", label: `Pendientes (${pendingCount})` },
                  { id: "preparar", label: `Preparar (${prepararCount})` },
                  {
                    id: "en espera de retiro",
                    label: `Espera Retiro (${esperaCount})`,
                  },
                  { id: "en camino", label: `En Camino (${enCaminoCount})` },
                  {
                    id: "finalizado",
                    label: `Finalizados (${finalizadoCount})`,
                  },
                  { id: "cancelado", label: `Cancelados (${canceladoCount})` },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setFilter(btn.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all
                  ${filter === btn.id
                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
                      }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Listado de pedidos */}
            <section className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-white border border-zinc-200/85 rounded-3xl p-16 text-center space-y-3">
                  <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
                  <p className="text-sm font-medium text-zinc-500">
                    No hay pedidos con el estado seleccionado en este momento.
                  </p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = !!expandedOrders[order.id];

                  // Estado Badge Styles
                  let statusBg = "bg-zinc-100 text-zinc-700 border-zinc-200";
                  if (order.estado === "pendiente")
                    statusBg = "bg-amber-50 text-amber-700 border-amber-100";
                  if (order.estado === "preparar")
                    statusBg = "bg-blue-50 text-blue-700 border-blue-100";
                  if (order.estado === "en espera de retiro")
                    statusBg = "bg-indigo-50 text-indigo-700 border-indigo-100";
                  if (order.estado === "en camino")
                    statusBg = "bg-purple-50 text-purple-700 border-purple-100";
                  if (order.estado === "finalizado")
                    statusBg =
                      "bg-emerald-50 text-emerald-700 border-emerald-100";
                  if (order.estado === "cancelado")
                    statusBg = "bg-rose-50 text-rose-700 border-rose-100";

                  return (
                    <div
                      key={order.id}
                      className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow transition-all"
                    >
                      {/* Fila principal del pedido */}
                      <div
                        onClick={() => toggleExpand(order.id)}
                        className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                      >
                        {/* ID y fecha */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-900 text-sm md:text-base">
                              #{order.id}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${statusBg}`}
                            >
                              {getStatusLabel(order.estado)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-medium">
                            {formatDate(order.created_at)}
                          </p>
                        </div>

                        {/* Cliente */}
                        <div className="space-y-0.5 max-w-[220px]">
                          <p className="text-sm font-bold text-zinc-800">
                            {order.nombre_cliente}
                          </p>
                          <a
                            href={`https://wa.me/${order.whatsapp_cliente}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1 font-medium"
                          >
                            <Phone className="w-3 h-3 text-zinc-400" />+
                            {order.whatsapp_cliente}
                          </a>
                          {order.direccion_entrega && (
                            <p
                              className="text-xs italic text-zinc-400 font-normal leading-tight mt-0.5"
                              title={order.direccion_entrega}
                            >
                              {order.direccion_entrega}
                            </p>
                          )}
                        </div>

                        {/* Entrega */}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Entrega
                          </p>
                          <p className="text-xs font-bold text-zinc-700">
                            {order.metodo_entrega === "shipping"
                              ? "🚚 Domicilio"
                              : "🛍️ Retiro"}
                          </p>
                        </div>

                        {/* Monto Total (USD destacado + Bs gris claro debajo) */}
                        <div className="space-y-0.5 text-left md:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            Monto Total
                          </p>
                          <p className="text-base font-bold text-zinc-950 font-serif leading-tight">
                            ${order.total_usd?.toFixed(2)} USD
                          </p>
                          <p className="text-[11px] font-medium text-zinc-400 font-mono leading-tight">
                            ≈{" "}
                            {order.total_bs
                              ? order.total_bs.toLocaleString("es-VE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : (
                                  order.total_usd * (exchangeRate || 1)
                                ).toLocaleString("es-VE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                            Bs
                          </p>
                        </div>

                        {/* Botón despliegue */}
                        <button className="self-end md:self-auto p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-900 transition-all">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Sección expandida: Detalles */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50/30 p-6 space-y-6">
                          {/* Grid de dirección y acciones */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Ubicación */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Detalles de Entrega
                              </h4>
                              {order.metodo_entrega === "shipping" ? (
                                <div className="bg-white border border-zinc-200/60 rounded-xl p-3.5 space-y-3">
                                  <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                                    <span className="font-semibold text-zinc-800">
                                      Dirección:
                                    </span>{" "}
                                    {order.direccion_entrega}
                                  </p>
                                  {order.gps_url && (
                                    <a
                                      href={order.gps_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-zinc-550 hover:text-zinc-900 hover:underline flex items-center gap-1 font-semibold font-mono"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                                      Ver coordenadas GPS{" "}
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}

                                  {order.estado === "pendiente" ? (
                                    <div className="border-t border-zinc-100 pt-3 space-y-2">
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                                        Asignar Costo de Envío
                                      </label>
                                      <div className="flex gap-2">
                                        <div className="relative flex-1">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                                            $
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={
                                              shippingInputs[order.id] !==
                                                undefined
                                                ? shippingInputs[order.id]
                                                : order.costo_envio_usd || ""
                                            }
                                            onChange={(e) =>
                                              setShippingInputs({
                                                ...shippingInputs,
                                                [order.id]: e.target.value,
                                              })
                                            }
                                            className="w-full pl-6 pr-3 py-2 rounded-lg border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSaveShippingCost(
                                              order.id,
                                              shippingInputs[order.id] !==
                                                undefined
                                                ? shippingInputs[order.id]
                                                : order.costo_envio_usd || "0",
                                              order,
                                            )
                                          }
                                          className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-semibold rounded-lg transition-all active:scale-95 shadow-sm shrink-0"
                                        >
                                          Aplicar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    order.costo_envio_usd > 0 && (
                                      <div className="border-t border-zinc-100 pt-2.5">
                                        <p className="text-[10px] font-semibold text-zinc-500 flex items-center justify-between">
                                          <span>
                                            🚚 Costo de envío aplicado:
                                          </span>
                                          <span className="font-bold text-zinc-900 font-mono">
                                            ${order.costo_envio_usd.toFixed(2)}{" "}
                                            USD /{" "}
                                            {order.costo_envio_bs.toFixed(2)} Bs
                                          </span>
                                        </p>
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                <div className="bg-white border border-zinc-200/60 rounded-xl p-3.5 space-y-2">
                                  <p className="text-xs text-zinc-600 font-semibold flex items-center gap-1.5">
                                    🛍️ El cliente retirará personalmente en la tienda.
                                  </p>
                                  {order.lugar_pago && (
                                    <div className="text-xs text-zinc-700 border-t border-zinc-100 pt-2 flex items-center justify-between">
                                      <span className="font-semibold text-zinc-500">
                                        💳 Modalidad de Pago:
                                      </span>
                                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
                                        {order.lugar_pago}
                                      </span>
                                    </div>
                                  )}
                                  {order.direccion_entrega && (
                                    <p className="text-xs italic text-zinc-400 font-normal leading-relaxed border-t border-zinc-100 pt-1.5">
                                      <span className="font-semibold text-zinc-500 not-italic">
                                        Dirección del cliente:
                                      </span>{" "}
                                      {order.direccion_entrega}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Cambiar Estado (Acciones en Paleta Neutra) */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Acciones del Pedido
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {(() => {
                                  const allowed =
                                    ALLOWED_TRANSITIONS[order.estado] || [];
                                  if (allowed.length === 0) {
                                    return (
                                      <p className="text-xs font-medium text-zinc-400 italic">
                                        Este pedido está en un estado final y no
                                        admite más cambios.
                                      </p>
                                    );
                                  }
                                  return (
                                    <>
                                      {order.estado === "pendiente" && (
                                        <button
                                          onClick={() =>
                                            handleSendPaymentDetails(order)
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow"
                                        >
                                          💬 Enviar Cobro (WhatsApp)
                                        </button>
                                      )}
                                      {order.estado === "preparar" && (() => {
                                        const items = order.items || [];
                                        const currentPicking = pickedState[order.id] || {};
                                        const totalTargetQty = items.reduce((acc, i) => acc + (i.cantidad || 1), 0);
                                        const totalPickedQty = items.reduce(
                                          (acc, i) => acc + (currentPicking[i.id] ?? (i.cantidad_recolectada || 0)),
                                          0
                                        );
                                        const isPickingComplete = totalTargetQty > 0 && totalPickedQty >= totalTargetQty;

                                        return (
                                          <button
                                            onClick={() => setActivePickingOrder(order)}
                                            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ${
                                              isPickingComplete
                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                : "bg-amber-500 hover:bg-amber-600 text-white"
                                            }`}
                                          >
                                            <PackageCheck className="w-4 h-4" />
                                            <span>
                                              {isPickingComplete
                                                ? "✓ Picking 100% Validado"
                                                : `📦 Escanear / Picking (${totalPickedQty}/${totalTargetQty})`}
                                            </span>
                                          </button>
                                        );
                                      })()}
                                      {order.estado === "en espera de retiro" &&
                                        order.metodo_entrega === "pickup" && (
                                          <button
                                            onClick={() =>
                                              handleSendReadyForPickupMessage(
                                                order,
                                              )
                                            }
                                            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow"
                                          >
                                            💬 Notificar Retiro (WhatsApp)
                                          </button>
                                        )}
                                      {order.estado === "en camino" && (
                                        <button
                                          onClick={() =>
                                            handleSendOnTheWayMessage(order)
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow"
                                        >
                                          💬 Notificar En Camino (WhatsApp)
                                        </button>
                                      )}
                                      {allowed.includes("pendiente") && (
                                        <button
                                          onClick={() =>
                                            handleUpdateStatus(
                                              order.id,
                                              "pendiente",
                                            )
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                          <Clock className="w-3.5 h-3.5" />{" "}
                                          Pendiente
                                        </button>
                                      )}
                                      {allowed.includes("preparar") && (
                                        <button
                                          onClick={() =>
                                            handleUpdateStatus(
                                              order.id,
                                              "preparar",
                                            )
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                          🍳 Preparar
                                        </button>
                                      )}
                                      {allowed.includes(
                                        "en espera de retiro",
                                      ) && (
                                          <button
                                            onClick={() =>
                                              handleUpdateStatus(
                                                order.id,
                                                "en espera de retiro",
                                              )
                                            }
                                            className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                                          >
                                            <Package className="w-3.5 h-3.5" />{" "}
                                            Espera Retiro
                                          </button>
                                        )}
                                      {allowed.includes("en camino") && (
                                        <button
                                          onClick={() =>
                                            handleUpdateStatus(
                                              order.id,
                                              "en camino",
                                            )
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                          <Truck className="w-3.5 h-3.5" /> En
                                          Camino
                                        </button>
                                      )}
                                      {allowed.includes("finalizado") && (
                                        <button
                                          onClick={() =>
                                            handleUpdateStatus(
                                              order.id,
                                              "finalizado",
                                            )
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />{" "}
                                          Finalizar
                                        </button>
                                      )}
                                      {allowed.includes("cancelado") && (
                                        <button
                                          onClick={() =>
                                            handleUpdateStatus(
                                              order.id,
                                              "cancelado",
                                            )
                                          }
                                          className="px-3.5 py-2 text-xs font-semibold border border-rose-200 hover:border-rose-400 bg-rose-50/50 hover:bg-rose-50 text-rose-600 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />{" "}
                                          Cancelar
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Productos Comprados (Clasificados por Sucursal / Almacén) */}
                            <div className="space-y-3">

                              {(() => {
                                // Agrupar items por sucursal
                                const itemsGrouped = {};
                                (order.items || []).forEach((item) => {
                                  const sucName =
                                    item.sucursal_nombre ||
                                    item.sucursal?.nombre ||
                                    "Sucursal Principal";
                                  if (!itemsGrouped[sucName]) itemsGrouped[sucName] = [];
                                  itemsGrouped[sucName].push(item);
                                });

                                return (
                                  <div className="space-y-3">
                                    {Object.entries(itemsGrouped).map(([sucName, items]) => (
                                      <div
                                        key={sucName}
                                        className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-xs"
                                      >
                                        <div className="bg-zinc-100/80 border-b border-zinc-200/80 px-4 py-2 flex items-center justify-between">
                                          <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-zinc-600" />
                                            {sucName}
                                          </span>
                                          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-200/60 px-2 py-0.5 rounded">
                                            {items.length} {items.length === 1 ? "artículo" : "artículos"}
                                          </span>
                                        </div>

                                        <div className="divide-y divide-zinc-100">
                                          {items.map((item) => (
                                            <div
                                              key={item.id}
                                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                                            >
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="font-bold text-zinc-800">
                                                    {item.cantidad}x {item.nombre_producto}
                                                  </span>

                                                  {/* Modificadores */}
                                                  {item.opciones_seleccionadas?.length > 0 && (
                                                    <div className="flex gap-1.5 flex-wrap">
                                                      {item.opciones_seleccionadas.map((opt, i) => (
                                                        <span
                                                          key={i}
                                                          className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded font-medium"
                                                        >
                                                          {opt.nombre}
                                                          {opt.price_modifier > 0 &&
                                                            ` (+$${opt.price_modifier.toFixed(2)})`}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* SKU y Código de Barra */}
                                                {(item.sku || item.codigo_barra || item.barcode) && (
                                                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-400">
                                                    {item.sku && (
                                                      <span className="bg-zinc-100 text-zinc-600 border border-zinc-200/80 px-1.5 py-0.5 rounded font-medium">
                                                        SKU: {item.sku}
                                                      </span>
                                                    )}
                                                    {(item.codigo_barra || item.barcode) && (
                                                      <span className="bg-zinc-100 text-zinc-600 border border-zinc-200/80 px-1.5 py-0.5 rounded font-medium">
                                                        Barra: {item.codigo_barra || item.barcode}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}

                                                {item.comentario && (
                                                  <p className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100 w-fit">
                                                    📝 Nota: {item.comentario}
                                                  </p>
                                                )}
                                              </div>

                                              <span className="font-semibold text-zinc-700 self-start sm:self-auto text-xs shrink-0">
                                                Unitario: ${item.precio_unitario?.toFixed(2) || "0.00"}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Desglose de Totales */}
                          <div className="flex flex-col items-end text-xs space-y-1.5 px-1.5 pt-1">
                            <div className="flex justify-between w-full sm:w-64 text-zinc-500 font-medium">
                              <span>Subtotal Productos:</span>
                              <span className="font-mono font-medium">
                                $
                                {(
                                  order.total_usd -
                                  (order.costo_envio_usd || 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                            {order.metodo_entrega === "shipping" && (
                              <div className="flex justify-between w-full sm:w-64 text-zinc-500 font-medium">
                                <span>Costo de Envío:</span>
                                <span className="font-mono font-medium">
                                  {order.costo_envio_usd > 0
                                    ? `+$${order.costo_envio_usd.toFixed(2)}`
                                    : "Pendiente de cotización"}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between w-full sm:w-64 border-t border-zinc-200 pt-1.5 font-bold text-zinc-900 text-sm">
                              <span>Total del Pedido:</span>
                              <span className="font-mono text-zinc-950">
                                {order.moneda_activa === "USD"
                                  ? `$${order.total_usd.toFixed(2)}`
                                  : `${order.total_bs.toLocaleString("es-VE")} Bs`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {activeTab === "products" && <ProductsManager />}
        {activeTab === "branches" && <BranchesManager />}
        {activeTab === "inventory" && <BranchInventoryManager />}
        {activeTab === "categories" && <CategoriesManager />}
        {activeTab === "options" && <OptionsManager />}
        {activeTab === "settings" && <SettingsManager />}
      </main>

      {/* Modal de Picking por Código de Barras */}
      {activePickingOrder && (
        <PickingScannerModal
          isOpen={!!activePickingOrder}
          onClose={() => setActivePickingOrder(null)}
          order={activePickingOrder}
          pickedState={pickedState}
          setPickedState={setPickedState}
          onRefreshOrders={fetchOrders}
          onCompletePicking={(orderToComplete) => {
            const targetState =
              orderToComplete.metodo_entrega === "pickup"
                ? "en espera de retiro"
                : "en camino";
            setActivePickingOrder(null);
            handleUpdateStatus(orderToComplete.id, targetState);
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
