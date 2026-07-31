import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  PackageCheck,
  Building2,
  Phone,
  User,
  Search,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";

const ShippingCompaniesManager = () => {
  const { store, exchangeRate } = useCurrency();
  const [subTab, setSubTab] = useState("consolidation"); // 'companies' | 'consolidation'

  // Estado para gestión de compañías
  const [companies, setCompanies] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
  });

  // Estado para consolidados y viajes
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | '7days' | 'month'
  const [companyFilter, setCompanyFilter] = useState("all"); // 'all' | companyId
  const [searchQuery, setSearchQuery] = useState("");

  // Cargar empresas de envío
  const fetchCompanies = async () => {
    if (!store?.id) return;
    setIsLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from("compania_envio")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error("Error cargando compañías de envío:", err);
      toast.error("No se pudieron cargar las compañías de envío.");
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  // Cargar pedidos para el consolidado
  const fetchOrders = async () => {
    if (!store?.id) return;
    setIsLoadingOrders(true);
    try {
      // Filtrar solo pedidos con método de entrega 'shipping' (envío)
      const { data, error } = await supabase
        .from("pedido")
        .select("*")
        .eq("store_id", store.id)
        .eq("metodo_entrega", "shipping")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error cargando pedidos para consolidado:", err);
      toast.error("No se pudieron cargar los pedidos de envío.");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchOrders();
  }, [store?.id]);

  // Guardar / Editar compañía
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("Ingresa el nombre de la compañía.");
      return;
    }

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from("compania_envio")
          .update({
            nombre: formData.nombre.trim(),
            contacto: formData.contacto.trim(),
            telefono: formData.telefono.trim(),
          })
          .eq("id", editingCompany.id);

        if (error) throw error;
        toast.success("Compañía actualizada correctamente.");
      } else {
        const { error } = await supabase.from("compania_envio").insert([
          {
            store_id: store.id,
            nombre: formData.nombre.trim(),
            contacto: formData.contacto.trim(),
            telefono: formData.telefono.trim(),
            activa: true,
          },
        ]);

        if (error) throw error;
        toast.success("Compañía afiliada con éxito.");
      }

      setShowModal(false);
      setEditingCompany(null);
      setFormData({ nombre: "", contacto: "", telefono: "" });
      fetchCompanies();
    } catch (err) {
      console.error("Error al guardar compañía:", err);
      toast.error("No se pudo guardar la compañía.");
    }
  };

  // Alternar estado activo/inactivo
  const handleToggleActive = async (company) => {
    try {
      const { error } = await supabase
        .from("compania_envio")
        .update({ activa: !company.activa })
        .eq("id", company.id);

      if (error) throw error;
      toast.success(
        `Compañía ${!company.activa ? "activada" : "desactivada"}.`
      );
      fetchCompanies();
    } catch (err) {
      console.error("Error alterando estado:", err);
      toast.error("Error al cambiar estado de la compañía.");
    }
  };

  // Eliminar compañía
  const handleDeleteCompany = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta compañía de envíos?"))
      return;

    try {
      const { error } = await supabase
        .from("compania_envio")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Compañía eliminada.");
      fetchCompanies();
    } catch (err) {
      console.error("Error eliminando compañía:", err);
      toast.error("No se pudo eliminar la compañía.");
    }
  };

  // Abrir modal de edición
  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      nombre: company.nombre || "",
      contacto: company.contacto || "",
      telefono: company.telefono || "",
    });
    setShowModal(true);
  };

  // Abrir modal de creación
  const handleOpenCreate = () => {
    setEditingCompany(null);
    setFormData({ nombre: "", contacto: "", telefono: "" });
    setShowModal(true);
  };

  // FILTRADO DE PEDIDOS CONSOLIDADOS (Solo pedidos finalizados)
  const consolidatedOrders = useMemo(() => {
    return orders.filter((order) => {
      // Requisito 1: Únicamente pedidos finalizados
      const isFinalized =
        order.estado === "finalizado" || order.estado === "completado";
      if (!isFinalized) return false;

      // Debe tener asignado un costo de envío > 0
      if (!order.costo_envio_usd || parseFloat(order.costo_envio_usd) <= 0) {
        return false;
      }

      // Filtro por compañía
      if (companyFilter !== "all") {
        if (String(order.compania_envio_id) !== String(companyFilter)) {
          return false;
        }
      }

      // Filtro por fecha
      if (dateFilter !== "all") {
        const orderDate = new Date(order.created_at);
        const now = new Date();

        if (dateFilter === "today") {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === "7days") {
          const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) return false;
        } else if (dateFilter === "month") {
          const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
          if (diffDays > 30) return false;
        }
      }

      // Filtro por búsqueda de texto (Cliente, ID, Compañía)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesClient = order.nombre_cliente?.toLowerCase().includes(query);
        const matchesId = String(order.id).includes(query);
        const matchesCompany = order.compania_envio_nombre
          ?.toLowerCase()
          .includes(query);
        if (!matchesClient && !matchesId && !matchesCompany) return false;
      }

      return true;
    });
  }, [orders, companyFilter, dateFilter, searchQuery]);

  // Cálculos de KPI de Consolidados
  const kpis = useMemo(() => {
    const totalTrips = consolidatedOrders.length;
    const totalUsd = consolidatedOrders.reduce(
      (acc, o) => acc + (parseFloat(o.costo_envio_usd) || 0),
      0
    );
    const totalBs = consolidatedOrders.reduce(
      (acc, o) => acc + (parseFloat(o.costo_envio_bs) || 0),
      0
    );
    const avgUsd = totalTrips > 0 ? totalUsd / totalTrips : 0;

    return { totalTrips, totalUsd, totalBs, avgUsd };
  }, [consolidatedOrders]);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (consolidatedOrders.length === 0) {
      toast.error("No hay registros para exportar.");
      return;
    }

    const headers = [
      "ID Pedido",
      "Fecha",
      "Cliente",
      "Teléfono",
      "Compañía de Envío",
      "Dirección de Entrega",
      "Costo Envío (USD)",
      "Costo Envío (BS)",
      "Total Pedido (USD)",
    ];

    const rows = consolidatedOrders.map((o) => [
      `#${o.id}`,
      new Date(o.created_at).toLocaleString("es-VE"),
      `"${o.nombre_cliente || ""}"`,
      `"${o.whatsapp_cliente || ""}"`,
      `"${o.compania_envio_nombre || "Sin especificar"}"`,
      `"${(o.direccion_entrega || "").replace(/"/g, '""')}"`,
      (parseFloat(o.costo_envio_usd) || 0).toFixed(2),
      (parseFloat(o.costo_envio_bs) || 0).toFixed(2),
      (parseFloat(o.total_usd) || 0).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Consolidado_Envios_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Consolidado exportado exitosamente a CSV.", {
      icon: "📊",
    });
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-zinc-900 text-white rounded-2xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-zinc-950">
                Gestión de Envíos y Consolidados
              </h2>
              <p className="text-xs text-zinc-500">
                Afiliación de agencias transportistas y reporte consolidado de viajes finalizados.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Navegación de Sub-Pestañas */}
        <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/60 self-start md:self-auto">
          <button
            onClick={() => setSubTab("consolidation")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "consolidation"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Consolidado de Viajes
          </button>
          <button
            onClick={() => setSubTab("companies")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "companies"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Compañías Afiliadas ({companies.length})
          </button>
        </div>
      </div>

      {/* SUB-PESTAÑA 1: CONSOLIDADO DE VIAJES */}
      {subTab === "consolidation" && (
        <div className="space-y-6">
          {/* Métricas KPI de Consolidados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Viajes Finalizados
                </span>
                <p className="text-3xl font-serif font-semibold text-zinc-900">
                  {kpis.totalTrips}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Total Envíos USD
                </span>
                <p className="text-3xl font-serif font-semibold text-zinc-900">
                  ${kpis.totalUsd.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-zinc-50 text-zinc-700 border border-zinc-100 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Total Envíos BS
                </span>
                <p className="text-xl font-mono font-bold text-zinc-900">
                  {kpis.totalBs.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Bs
                </p>
              </div>
              <div className="p-3 bg-zinc-50 text-zinc-700 border border-zinc-100 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Promedio / Viaje
                </span>
                <p className="text-3xl font-serif font-semibold text-zinc-900">
                  ${kpis.avgUsd.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filtros y Acciones */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Buscador */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, pedido o compañía..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                />
              </div>

              {/* Filtro por Compañía */}
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-900"
                >
                  <option value="all">🏢 Todas las Compañías</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón de Refrescar y Exportar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchOrders}
                  disabled={isLoadingOrders}
                  className="p-2 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-xl bg-white transition-all active:scale-95"
                  title="Actualizar datos"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoadingOrders ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel/CSV
                </button>
              </div>
            </div>

            {/* Filtro de Rango de Fecha */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Período:
              </span>
              {[
                { id: "all", label: "🗓️ Todos los Tiempos" },
                { id: "today", label: "⚡ Hoy" },
                { id: "7days", label: "📅 Últimos 7 días" },
                { id: "month", label: "📆 Último mes" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDateFilter(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
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

          {/* Tabla de Viajes Consolidados */}
          <div className="bg-white border border-zinc-200/80 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Pedido</th>
                    <th className="py-3.5 px-4">Fecha</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Compañía de Envío</th>
                    <th className="py-3.5 px-4">Dirección de Entrega</th>
                    <th className="py-3.5 px-4 text-right">Costo USD</th>
                    <th className="py-3.5 px-4 text-right">Costo BS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {consolidatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-zinc-400">
                        <Truck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-sm text-zinc-500">
                          No hay viajes finalizados registrados con los filtros aplicados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    consolidatedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                          #{order.id}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500 whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString("es-VE")}{" "}
                          <span className="text-[10px] text-zinc-400">
                            {new Date(order.created_at).toLocaleTimeString("es-VE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-900">
                            {order.nombre_cliente}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {order.whatsapp_cliente}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-900 font-semibold border border-zinc-200">
                            <Building2 className="w-3 h-3 text-zinc-500" />
                            {order.compania_envio_nombre || "No especificada"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-zinc-600">
                          {order.direccion_entrega || "Sin dirección"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                          ${(parseFloat(order.costo_envio_usd) || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-zinc-800">
                          {(parseFloat(order.costo_envio_bs) || 0).toFixed(2)} Bs
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: GESTIÓN DE COMPAÑÍAS (AFILIACIÓN) */}
      {subTab === "companies" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-zinc-900">
              Listado de Empresas de Envío Afiliadas
            </h3>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Afiliar Nueva Compañía
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.length === 0 ? (
              <div className="col-span-full bg-white border border-zinc-200/80 rounded-3xl p-12 text-center space-y-3">
                <Building2 className="w-12 h-12 text-zinc-300 mx-auto" />
                <p className="text-sm font-medium text-zinc-500">
                  Aún no has afiliado ninguna compañía de envíos.
                </p>
                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-all inline-block"
                >
                  Afiliar primera compañía
                </button>
              </div>
            ) : (
              companies.map((company) => (
                <div
                  key={company.id}
                  className={`bg-white border rounded-2xl p-5 space-y-4 shadow-xs transition-all ${
                    company.activa
                      ? "border-zinc-200/80"
                      : "border-zinc-200 opacity-60 bg-zinc-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-zinc-100 text-zinc-800 rounded-xl">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-zinc-900 text-base">
                          {company.nombre}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            company.activa
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-zinc-100 text-zinc-500 border-zinc-200"
                          }`}
                        >
                          {company.activa ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Activa
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactiva
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                    {company.contacto && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Contacto: <strong>{company.contacto}</strong></span>
                      </div>
                    )}
                    {company.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Teléfono: <strong>{company.telefono}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <button
                      onClick={() => handleToggleActive(company)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                        company.activa
                          ? "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {company.activa ? "Desactivar" : "Activar"}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(company)}
                        className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(company.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR COMPAÑÍA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-zinc-900">
                {editingCompany ? "Editar Compañía" : "Afiliar Nueva Compañía"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Yummy Delivery, Ridery, Tealca..."
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  placeholder="ej. Juan Pérez (Opcional)"
                  value={formData.contacto}
                  onChange={(e) =>
                    setFormData({ ...formData, contacto: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  placeholder="ej. +58 412 1234567"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
                >
                  {editingCompany ? "Guardar Cambios" : "Afiliar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingCompaniesManager;
