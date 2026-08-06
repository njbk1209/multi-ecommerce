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
  CreditCard,
  Upload,
  Printer,
  Eye,
  FileText,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";

const ShippingCompaniesManager = () => {
  const { store, exchangeRate } = useCurrency();
  const [subTab, setSubTab] = useState("consolidation"); // 'consolidation' | 'closures' | 'companies'

  // Estado para gestión de compañías
  const [companies, setCompanies] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    banco: "",
    cedula_rif: "",
    telefono_pago_movil: "",
  });

  // Estado para consolidados y viajes
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | '7days' | 'month'
  const [companyFilter, setCompanyFilter] = useState("all"); // 'all' | companyId
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para Cierres de Envíos
  const [closures, setClosures] = useState([]);
  const [isLoadingClosures, setIsLoadingLoadingClosures] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureCompanyId, setClosureCompanyId] = useState("");
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [viewingComprobanteUrl, setViewingComprobanteUrl] = useState(null);

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

  // Cargar cierres de viajes realizados
  const fetchClosures = async () => {
    if (!store?.id) return;
    setIsLoadingLoadingClosures(true);
    try {
      const { data, error } = await supabase
        .from("cierre_envio")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClosures(data || []);
    } catch (err) {
      console.error("Error cargando cierres de envío:", err);
    } finally {
      setIsLoadingLoadingClosures(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchOrders();
    fetchClosures();
  }, [store?.id]);

  // Guardar / Editar compañía
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("Ingresa el nombre de la compañía.");
      return;
    }

    try {
      const payload = {
        nombre: formData.nombre.trim(),
        contacto: formData.contacto.trim(),
        telefono: formData.telefono.trim(),
        banco: formData.banco.trim() || null,
        cedula_rif: formData.cedula_rif.trim() || null,
        telefono_pago_movil: formData.telefono_pago_movil.trim() || null,
      };

      if (editingCompany) {
        const { error } = await supabase
          .from("compania_envio")
          .update(payload)
          .eq("id", editingCompany.id);

        if (error) throw error;
        toast.success("Compañía actualizada correctamente.");
      } else {
        const { error } = await supabase.from("compania_envio").insert([
          {
            ...payload,
            store_id: store.id,
            activa: true,
          },
        ]);

        if (error) throw error;
        toast.success("Compañía afiliada con éxito.");
      }

      setShowModal(false);
      setEditingCompany(null);
      setFormData({
        nombre: "",
        contacto: "",
        telefono: "",
        banco: "",
        cedula_rif: "",
        telefono_pago_movil: "",
      });
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

  // Abrir modal de edición de compañía
  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      nombre: company.nombre || "",
      contacto: company.contacto || "",
      telefono: company.telefono || "",
      banco: company.banco || "",
      cedula_rif: company.cedula_rif || "",
      telefono_pago_movil: company.telefono_pago_movil || "",
    });
    setShowModal(true);
  };

  // Abrir modal de creación de compañía
  const handleOpenCreate = () => {
    setEditingCompany(null);
    setFormData({
      nombre: "",
      contacto: "",
      telefono: "",
      banco: "",
      cedula_rif: "",
      telefono_pago_movil: "",
    });
    setShowModal(true);
  };

  // Obtener Set de IDs de pedidos que ya pertenecen a algún cierre registrado
  const closedOrderIdsSet = useMemo(() => {
    const set = new Set();
    closures.forEach((c) => {
      if (Array.isArray(c.pedidos_ids)) {
        c.pedidos_ids.forEach((id) => set.add(id));
      }
    });
    return set;
  }, [closures]);

  // FILTRADO DE PEDIDOS CONSOLIDADOS (Solo pedidos finalizados)
  const consolidatedOrders = useMemo(() => {
    return orders.filter((order) => {
      // Requisito 1: Únicamente pedidos finalizados o completados
      const isFinalized =
        order.estado === "finalizado" || order.estado === "completado";
      if (!isFinalized) return false;

      // Debe tener asignado un costo de envío > 0
      if (!order.costo_envio_usd || parseFloat(order.costo_envio_usd) <= 0) {
        return false;
      }

      // Filtro por compañía
      if (companyFilter !== "all") {
        const selectedComp = companies.find((c) => String(c.id) === String(companyFilter));
        const matchId = String(order.compania_envio_id) === String(companyFilter);
        const matchName =
          selectedComp &&
          order.compania_envio_nombre &&
          order.compania_envio_nombre.trim().toLowerCase() === selectedComp.nombre.trim().toLowerCase();

        if (!matchId && !matchName) return false;
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
  }, [orders, companies, companyFilter, dateFilter, searchQuery]);

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

  // Exportar Consolidado a CSV
  const handleExportCSV = () => {
    if (consolidatedOrders.length === 0) {
      toast.error("No hay registros para exportar con los filtros seleccionados.");
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
      `"${o.id}"`,
      `"${new Date(o.created_at).toLocaleString("es-VE")}"`,
      `"${(o.nombre_cliente || "").replace(/"/g, '""')}"`,
      `"${(o.whatsapp_cliente || "").replace(/"/g, '""')}"`,
      `"${(o.compania_envio_nombre || "Sin especificar").replace(/"/g, '""')}"`,
      `"${(o.direccion_entrega || "").replace(/"/g, '""')}"`,
      (parseFloat(o.costo_envio_usd) || 0).toFixed(2),
      (parseFloat(o.costo_envio_bs) || 0).toFixed(2),
      (parseFloat(o.total_usd) || 0).toFixed(2),
    ]);

    const csvString =
      "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const selectedCompObj = companies.find((c) => String(c.id) === String(companyFilter));
    const compSlug = selectedCompObj ? selectedCompObj.nombre.replace(/[^a-z0-9]/gi, "_") : "Todas";

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Consolidado_Envios_${compSlug}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Consolidado exportado exitosamente a CSV.", {
      icon: "📊",
    });
  };

  // Pedidos pendientes de cierre para la empresa seleccionada en el Modal de Cierre
  const unclosedTripsForModal = useMemo(() => {
    if (!closureCompanyId) return [];

    const selectedCompObj = companies.find((c) => String(c.id) === String(closureCompanyId));
    if (!selectedCompObj) return [];

    return orders.filter((order) => {
      const isFinalized = order.estado === "finalizado" || order.estado === "completado";
      if (!isFinalized) return false;

      const hasCost = parseFloat(order.costo_envio_usd) > 0;
      if (!hasCost) return false;

      const matchId = String(order.compania_envio_id) === String(closureCompanyId);
      const matchName =
        order.compania_envio_nombre &&
        order.compania_envio_nombre.trim().toLowerCase() === selectedCompObj.nombre.trim().toLowerCase();

      if (!matchId && !matchName) return false;

      // No estar incluido en un cierre previo
      if (closedOrderIdsSet.has(order.id)) return false;

      return true;
    });
  }, [orders, companies, closureCompanyId, closedOrderIdsSet]);

  const selectedClosureCompanyObj = useMemo(() => {
    return companies.find((c) => String(c.id) === String(closureCompanyId));
  }, [companies, closureCompanyId]);

  const closureTotalUSD = useMemo(() => {
    return unclosedTripsForModal.reduce(
      (sum, o) => sum + (parseFloat(o.costo_envio_usd) || 0),
      0
    );
  }, [unclosedTripsForModal]);

  const currentRate = exchangeRate || 1;
  const closureTotalBS = closureTotalUSD * currentRate;

  const checkIsPdf = (url) => {
    if (!url) return false;
    const lower = String(url).toLowerCase();
    return lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.startsWith("data:application/pdf");
  };

  // Manejar selección de archivo de comprobante
  const handlePaymentFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPaymentFile(file);

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPaymentPreview("pdf");
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPaymentPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPaymentPreview(null);
    }
  };

  // Procesar Cierre y Pago
  const handleProcessClosurePayment = async (e) => {
    e.preventDefault();
    if (!closureCompanyId) {
      toast.error("Selecciona una compañía de envíos para realizar el cierre.");
      return;
    }
    if (unclosedTripsForModal.length === 0) {
      toast.error("No hay viajes pendientes por cerrar para esta compañía.");
      return;
    }
    if (!paymentFile) {
      toast.error("Por favor adjunta el comprobante del Pago Móvil realizado.");
      return;
    }

    setIsSubmittingPayment(true);
    let comprobanteUrl = "";

    try {
      // 1. Subir comprobante a Supabase Storage
      const fileExt = paymentFile.name.split(".").pop();
      const fileName = `cierre_envio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `comprobantes_envio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(filePath, paymentFile);

      if (uploadError) {
        console.warn("Storage upload warn:", uploadError);
      } else {
        const { data: urlData } = supabase.storage
          .from("productos")
          .getPublicUrl(filePath);
        comprobanteUrl = urlData?.publicUrl || "";
      }

      // Si no hay URL de storage por permiso o bucket, usar preview DataURL o marcador
      if (!comprobanteUrl && paymentPreview && paymentPreview !== "pdf") {
        comprobanteUrl = paymentPreview;
      }

      const pedidosIds = unclosedTripsForModal.map((o) => o.id);
      const pedidosResumen = unclosedTripsForModal.map((o) => ({
        id: o.id,
        created_at: o.created_at,
        nombre_cliente: o.nombre_cliente,
        whatsapp_cliente: o.whatsapp_cliente,
        direccion_entrega: o.direccion_entrega,
        costo_envio_usd: o.costo_envio_usd,
        costo_envio_bs: o.costo_envio_usd * currentRate,
      }));

      // 2. Guardar Cierre en la tabla `cierre_envio`
      const { error: insertError } = await supabase.from("cierre_envio").insert([
        {
          store_id: store.id,
          compania_envio_id: selectedClosureCompanyObj.id,
          compania_envio_nombre: selectedClosureCompanyObj.nombre,
          total_viajes: unclosedTripsForModal.length,
          monto_total_usd: closureTotalUSD,
          monto_total_bs: closureTotalBS,
          tasa_cambio: currentRate,
          banco_pago: selectedClosureCompanyObj.banco || "No especificado",
          cedula_rif_pago: selectedClosureCompanyObj.cedula_rif || "No especificado",
          telefono_pago: selectedClosureCompanyObj.telefono_pago_movil || selectedClosureCompanyObj.telefono || "No especificado",
          comprobante_url: comprobanteUrl || null,
          estado: "pagado",
          pedidos_ids: pedidosIds,
          pedidos_resumen: pedidosResumen,
        },
      ]);

      if (insertError) throw insertError;

      toast.success("🎉 ¡Cierre de viajes procesado y pagado exitosamente!", {
        duration: 5000,
        style: { background: "#059669", color: "#fff", borderRadius: "12px" },
      });

      setShowClosureModal(false);
      setPaymentFile(null);
      setPaymentPreview(null);
      setClosureCompanyId("");
      fetchClosures();
      fetchOrders();
    } catch (err) {
      console.error("Error procesando cierre de envío:", err);
      toast.error("No se pudo procesar el cierre del envío en la base de datos.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Generar e Imprimir PDF del Cierre
  const handleDownloadClosurePDF = (closure) => {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permite las ventanas emergentes en tu navegador para generar el PDF.");
      return;
    }

    const itemsRowsHTML = (closure.pedidos_resumen || [])
      .map(
        (p) => `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7; font-weight: bold; font-family: monospace;">#${p.id}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7;">${new Date(p.created_at).toLocaleDateString("es-VE")}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7;"><strong>${p.nombre_cliente || "-"}</strong><br/><small style="color: #71717a;">${p.whatsapp_cliente || ""}</small></td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7;">${p.direccion_entrega || "Entrega Local"}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: bold; color: #047857;">$${parseFloat(p.costo_envio_usd || 0).toFixed(2)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: bold;">${parseFloat(p.costo_envio_bs || (p.costo_envio_usd * (closure.tasa_cambio || 1))).toFixed(2)} Bs</td>
        </tr>
      `
      )
      .join("");

    let comprobanteHTML = "";
    if (closure.comprobante_url) {
      const isPdf = checkIsPdf(closure.comprobante_url);
      if (isPdf) {
        comprobanteHTML = `
          <div class="comprobante-section">
            <h4 style="margin: 0 0 8px 0; color: #18181b;">Comprobante de Pago Adjunto (Documento PDF)</h4>
            <div style="background: #f4f4f5; border: 1px dashed #a1a1aa; padding: 16px; border-radius: 12px; display: inline-flex; align-items: center; gap: 12px;">
              <span style="font-size: 28px;">📄</span>
              <div>
                <strong style="display: block; font-size: 13px; color: #18181b;">Comprobante_Pago_Movil.pdf</strong>
                <a href="${closure.comprobante_url}" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline; font-size: 12px;">Abrir / Descargar Documento PDF de Pago 🔗</a>
              </div>
            </div>
          </div>
        `;
      } else {
        comprobanteHTML = `
          <div class="comprobante-section">
            <h4 style="margin: 0 0 8px 0; color: #18181b;">Comprobante de Pago Móvil Adjunto</h4>
            <img src="${closure.comprobante_url}" alt="Comprobante de Pago Móvil" class="comprobante-img" />
          </div>
        `;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Reporte_Cierre_Envio_${closure.id}_${closure.compania_envio_nombre}</title>
        <style>
          @page {
            margin: 15mm 15mm 15mm 15mm;
          }
          body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; padding: 24px 32px; max-width: 900px; margin: 0 auto; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 800; color: #18181b; text-transform: uppercase; margin: 0; }
          .badge-pagado { background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f4f4f5; padding: 16px; border-radius: 12px; margin-bottom: 24px; font-size: 13px; }
          .info-box p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #27272a; color: #ffffff; text-align: left; padding: 10px; text-transform: uppercase; font-size: 11px; tracking-wide; }
          .totals-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 12px; text-align: right; margin-bottom: 24px; }
          .totals-box p { margin: 4px 0; }
          .comprobante-section { margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 16px; page-break-inside: avoid; }
          .comprobante-img { max-width: 320px; max-height: 400px; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 10px; }
          @media print {
            body { padding: 10px 0; margin: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background: #18181b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">
            🖨️ Imprimir / Guardar en PDF
          </button>
        </div>

        <div class="header">
          <div>
            <h1 class="title">INFORME OFICIAL DE CIERRE DE VIAJES</h1>
            <p style="margin: 4px 0 0 0; color: #71717a; font-size: 13px;">Comprobante de Despacho & Pago Móvil de Envíos</p>
          </div>
          <span class="badge-pagado">✓ CIERRE PAGADO</span>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <p><strong>Cierre de Viajes #:</strong> ${closure.id}</p>
            <p><strong>Fecha de Cierre:</strong> ${new Date(closure.created_at).toLocaleString("es-VE")}</p>
            <p><strong>Compañía de Envío:</strong> ${closure.compania_envio_nombre}</p>
            <p><strong>Tasa de Cambio Aplicada:</strong> ${parseFloat(closure.tasa_cambio || 1).toFixed(2)} Bs / USD</p>
          </div>
          <div class="info-box">
            <p><strong>Datos del Pago Móvil Efectuado:</strong></p>
            <p>🏦 <strong>Banco:</strong> ${closure.banco_pago || "No registrado"}</p>
            <p>🪪 <strong>C.I. / RIF:</strong> ${closure.cedula_rif_pago || "No registrado"}</p>
            <p>📱 <strong>Teléfono Pago Móvil:</strong> ${closure.telefono_pago || "No registrado"}</p>
          </div>
        </div>

        <h3>Detalle de Viajes Incluidos (${closure.total_viajes} viajes)</h3>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Dirección de Entrega</th>
              <th style="text-align: right;">Costo (USD)</th>
              <th style="text-align: right;">Costo (BS)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHTML}
          </tbody>
        </table>

        <div class="totals-box">
          <p style="font-size: 14px; color: #065f46;"><strong>Total Viajes Realizados:</strong> ${closure.total_viajes}</p>
          <p style="font-size: 18px; font-weight: 800; color: #065f46;"><strong>TOTAL PAGADO (USD):</strong> $${parseFloat(closure.monto_total_usd || 0).toFixed(2)} USD</p>
          <p style="font-size: 20px; font-weight: 900; color: #047857;"><strong>TOTAL PAGADO (BS):</strong> ${parseFloat(closure.monto_total_bs || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</p>
        </div>

        ${comprobanteHTML}
      </body>
      </html>
    `;

    win.document.write(htmlContent);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 500);
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
                Gestión de Envíos y Cierres
              </h2>
              <p className="text-xs text-zinc-500">
                Afiliación de agencias transportistas, reporte de viajes y cierres de Pago Móvil.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Navegación de Sub-Pestañas */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/60 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setSubTab("consolidation")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "consolidation"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Consolidado
          </button>

          <button
            onClick={() => setSubTab("closures")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "closures"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Cierres y Pagos ({closures.length})
          </button>

          <button
            onClick={() => setSubTab("companies")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "companies"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Agencias Afiliadas ({companies.length})
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

      {/* SUB-PESTAÑA 2: CIERRES Y PAGOS DE ENVÍOS */}
      {subTab === "closures" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Historial de Cierres de Envíos Realizados
              </h3>
              <p className="text-xs text-zinc-500">
                Resumen de cierres del día/período, comprobantes de Pago Móvil y reportes oficiales en PDF.
              </p>
            </div>
            <button
              onClick={() => {
                if (companies.length > 0) {
                  setClosureCompanyId(String(companies[0].id));
                }
                setShowClosureModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generar Cierre de Viajes</span>
            </button>
          </div>

          {/* Tabla de Cierres Pagados */}
          <div className="bg-white border border-zinc-200/80 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Cierre #</th>
                    <th className="py-3.5 px-4">Fecha Cierre</th>
                    <th className="py-3.5 px-4">Compañía</th>
                    <th className="py-3.5 px-4 text-center">Viajes</th>
                    <th className="py-3.5 px-4 text-right">Total USD</th>
                    <th className="py-3.5 px-4 text-right">Total BS</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {closures.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-zinc-400">
                        <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-sm text-zinc-500">
                          Aún no se han generado cierres de viajes. Haz clic en "Generar Cierre de Viajes".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    closures.map((closure) => (
                      <tr key={closure.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                          #{closure.id}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500 whitespace-nowrap">
                          {new Date(closure.fecha_cierre || closure.created_at).toLocaleString("es-VE")}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-900">
                          {closure.compania_envio_nombre}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-800">
                            {closure.total_viajes} viajes
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                          ${parseFloat(closure.monto_total_usd || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                          {parseFloat(closure.monto_total_bs || 0).toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          Bs
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PAGADO
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {closure.comprobante_url && (
                              <button
                                onClick={() => setViewingComprobanteUrl(closure.comprobante_url)}
                                className="p-1.5 text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                                title="Ver comprobante de Pago Móvil"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadClosurePDF(closure)}
                              className="px-2.5 py-1.5 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1"
                              title="Descargar o Imprimir Reporte PDF"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" /> PDF
                            </button>
                          </div>
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

      {/* SUB-PESTAÑA 3: COMPAÑÍAS AFILIADAS */}
      {subTab === "companies" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Agencias Transportistas Afiliadas</h3>
              <p className="text-xs text-zinc-500">Agregue y administre las empresas de despacho y sus datos de Pago Móvil.</p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              Afiliar Compañía
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.length === 0 ? (
              <div className="col-span-full bg-white border border-zinc-200/80 rounded-3xl p-12 text-center text-zinc-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-zinc-700 text-sm">No hay compañías afiliadas registradas.</p>
                <p className="text-xs text-zinc-400 mt-1">Haz clic en "Afiliar Compañía" para empezar.</p>
              </div>
            ) : (
              companies.map((company) => (
                <div
                  key={company.id}
                  className={`bg-white border rounded-2xl p-5 space-y-4 shadow-xs transition-all ${
                    company.activa ? "border-zinc-200/80" : "border-zinc-200 opacity-60 bg-zinc-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-serif font-bold text-base text-zinc-900 flex items-center gap-2">
                        <span>{company.nombre}</span>
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                          company.activa
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                        }`}
                      >
                        {company.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleActive(company)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-xl border transition-all ${
                        company.activa
                          ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {company.activa ? "Desactivar" : "Activar"}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                    {company.contacto && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Contacto: <strong>{company.contacto}</strong></span>
                      </div>
                    )}
                    {company.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Teléfono: <strong>{company.telefono}</strong></span>
                      </div>
                    )}

                    {/* Datos de Pago Móvil */}
                    <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 mt-2 space-y-1 text-[11px]">
                      <p className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-emerald-600" /> Datos de Pago Móvil:
                      </p>
                      <p className="text-zinc-700">🏦 <strong>Banco:</strong> {company.banco || "No configurado"}</p>
                      <p className="text-zinc-700">🪪 <strong>C.I. / RIF:</strong> {company.cedula_rif || "No configurado"}</p>
                      <p className="text-zinc-700">📱 <strong>Teléfono Pago:</strong> {company.telefono_pago_movil || company.telefono || "No configurado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                    <button
                      onClick={() => handleOpenEdit(company)}
                      className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
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
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR COMPAÑÍA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
                  Teléfono de Contacto (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="ej. 04141234567"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                />
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-700" /> Información de Pago Móvil
                </h4>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Banco de la Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Banesco, Mercantil, BDV..."
                    value={formData.banco}
                    onChange={(e) =>
                      setFormData({ ...formData, banco: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    C.I. / RIF del Titular
                  </label>
                  <input
                    type="text"
                    placeholder="ej. J-123456789 o V-12345678"
                    value={formData.cedula_rif}
                    onChange={(e) =>
                      setFormData({ ...formData, cedula_rif: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Teléfono Pago Móvil
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 04141234567"
                    value={formData.telefono_pago_movil}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        telefono_pago_movil: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
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

      {/* MODAL GENERAR Y PAGAR CIERRE DE VIAJES */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-zinc-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Generar Cierre y Pago de Envíos</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Consolide los viajes finalizados, consulte los datos de Pago Móvil y cargue el comprobante de pago.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowClosureModal(false);
                  setPaymentFile(null);
                  setPaymentPreview(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessClosurePayment} className="space-y-5">
              {/* Seleccionar Compañía */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  1. Seleccionar Compañía de Envío a Cerrar *
                </label>
                <select
                  value={closureCompanyId}
                  onChange={(e) => setClosureCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                >
                  <option value="">-- Selecciona una empresa --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClosureCompanyObj && (
                <>
                  {/* Tarjeta de Datos de Pago Móvil */}
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-700" /> Datos de Pago Móvil de {selectedClosureCompanyObj.nombre}:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Banco</span>
                        <strong className="text-zinc-900 font-serif">{selectedClosureCompanyObj.banco || "No configurado"}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">C.I. / RIF</span>
                        <strong className="text-zinc-900 font-mono">{selectedClosureCompanyObj.cedula_rif || "No configurado"}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Teléfono Pago</span>
                        <strong className="text-zinc-900 font-mono">{selectedClosureCompanyObj.telefono_pago_movil || selectedClosureCompanyObj.telefono || "No configurado"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Resumen Financiero del Cierre */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 text-center">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Viajes</span>
                      <strong className="text-2xl font-serif text-zinc-900">{unclosedTripsForModal.length}</strong>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 text-center">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total a Pagar (USD)</span>
                      <strong className="text-2xl font-serif text-emerald-700">${closureTotalUSD.toFixed(2)}</strong>
                    </div>
                    <div className="bg-emerald-600 text-white rounded-2xl p-3.5 text-center shadow-xs">
                      <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider block">Total a Pagar (BS)</span>
                      <strong className="text-xl font-mono font-bold">
                        {closureTotalBS.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                      </strong>
                    </div>
                  </div>

                  {/* Tabla de Viajes Incluidos */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      2. Viajes Finalizados Incluidos en el Cierre ({unclosedTripsForModal.length})
                    </label>
                    <div className="border border-zinc-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {unclosedTripsForModal.length === 0 ? (
                        <p className="p-4 text-center text-xs text-zinc-400">
                          No hay viajes pendientes por cerrar para esta compañía.
                        </p>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-100 text-zinc-500 font-bold">
                            <tr>
                              <th className="p-2">Pedido</th>
                              <th className="p-2">Cliente</th>
                              <th className="p-2">Dirección</th>
                              <th className="p-2 text-right">Monto USD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {unclosedTripsForModal.map((t) => (
                              <tr key={t.id}>
                                <td className="p-2 font-mono font-bold">#{t.id}</td>
                                <td className="p-2 font-semibold">{t.nombre_cliente}</td>
                                <td className="p-2 text-zinc-500 truncate max-w-[150px]">{t.direccion_entrega}</td>
                                <td className="p-2 text-right font-mono font-bold text-emerald-700">
                                  ${parseFloat(t.costo_envio_usd || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Adjuntar Comprobante de Pago */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      3. Subir Comprobante de Pago Móvil *
                    </label>

                    <div className="border-2 border-dashed border-zinc-200 hover:border-zinc-900 rounded-2xl p-4 text-center bg-zinc-50 hover:bg-white transition-all cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        required
                        onChange={handlePaymentFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-6 h-6 mx-auto text-zinc-400 mb-1" />
                      <p className="text-xs font-semibold text-zinc-700">
                        {paymentFile ? paymentFile.name : "Haz clic o arrastra aquí la captura del Pago Móvil"}
                      </p>
                      <p className="text-[10px] text-zinc-400">Archivos permitidos: JPG, PNG, WEBP, PDF</p>
                    </div>

                    {paymentPreview === "pdf" ? (
                      <div className="mt-2 p-3 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-zinc-800">
                        <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                        <span>Documento PDF cargado: <strong>{paymentFile?.name}</strong></span>
                      </div>
                    ) : paymentPreview ? (
                      <div className="mt-2 text-center">
                        <img
                          src={paymentPreview}
                          alt="Vista previa del comprobante"
                          className="max-h-40 rounded-xl border border-zinc-200 mx-auto shadow-xs"
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {/* Botón de Submit */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowClosureModal(false);
                    setPaymentFile(null);
                    setPaymentPreview(null);
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || !closureCompanyId || unclosedTripsForModal.length === 0}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all flex items-center gap-2 shadow-md ${
                    isSubmittingPayment || !closureCompanyId || unclosedTripsForModal.length === 0
                      ? "bg-zinc-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer shadow-emerald-600/30"
                  }`}
                >
                  {isSubmittingPayment ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span> Procesando Cierre...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Registrar y Pagar Cierre
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER COMPROBANTE DE PAGO */}
      {viewingComprobanteUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" /> Comprobante de Pago Móvil
              </h3>
              <button
                onClick={() => setViewingComprobanteUrl(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-2">
              {checkIsPdf(viewingComprobanteUrl) ? (
                <iframe
                  src={viewingComprobanteUrl}
                  title="Comprobante PDF"
                  className="w-full h-[60vh] rounded-2xl border border-zinc-200 shadow-md bg-zinc-50"
                />
              ) : (
                <img
                  src={viewingComprobanteUrl}
                  alt="Comprobante de Pago"
                  className="max-h-[60vh] w-auto mx-auto rounded-2xl border border-zinc-200 shadow-md object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <a
                href={viewingComprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold transition-all hover:bg-zinc-800"
              >
                Abrir en Tamaño Completo 🔗
              </a>
              <button
                onClick={() => setViewingComprobanteUrl(null)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingCompaniesManager;
