import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Loader2,
  Tag,
  Calendar,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Package,
  ChevronDown,
  Layers,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";
import toast from "react-hot-toast";
import PromotionRuleCSVModal from "./PromotionRuleCSVModal";

export default function PromotionsManager() {
  const { store, refetchPromotions } = useCurrency();
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [selectedPromoForRule, setSelectedPromoForRule] = useState(null);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [selectedPromoForCsv, setSelectedPromoForCsv] = useState(null);

  // Formulario Promoción
  const [promoForm, setPromoForm] = useState({
    nombre: "",
    descripcion: "",
    tipo: "volumen", // 'volumen' | 'campana'
    fecha_inicio: "",
    fecha_fin: "",
    prioridad: 0,
    is_active: true,
  });

  // Formulario Regla
  const [ruleForm, setRuleForm] = useState({
    sku: "",
    cantidad_minima: 1,
    cantidad_maxima: "",
    tipo_descuento: "porcentaje", // 'porcentaje' | 'monto_fijo'
    valor_descuento: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Cargar catálogo de productos y promociones con sus reglas
  const fetchData = async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      // 1. Cargar productos para el selector de SKU y pareo de CSV
      const { data: prodData } = await supabase
        .from("producto")
        .select("id, name, sku, barcode, codigo_barra, oem_number, part_number_fabricante, price, is_active")
        .eq("store", store.id)
        .order("name", { ascending: true });

      setProducts(prodData || []);

      // 2. Cargar promociones con sus reglas
      const { data: promoData, error: promoError } = await supabase
        .from("promocion")
        .select("*, promocion_regla(*)")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });

      if (promoError) throw promoError;
      setPromotions(promoData || []);
    } catch (err) {
      console.error("Error al cargar promociones:", err);
      toast.error("No se pudieron cargar las promociones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [store?.id]);

  // Mapa de SKU a Objeto de Producto para visualización amigable
  const productSkuMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const skuVal = (p.sku || p.codigo_barra || p.barcode || "").trim().toLowerCase();
      if (skuVal) {
        map[skuVal] = p;
      }
    });
    return map;
  }, [products]);

  // ---- HANDLERS PROMOCIÓN ----
  const handleOpenCreatePromo = () => {
    setEditingPromo(null);
    setPromoForm({
      nombre: "",
      descripcion: "",
      tipo: "volumen",
      fecha_inicio: "",
      fecha_fin: "",
      prioridad: 0,
      is_active: true,
    });
    setPromoModalOpen(true);
  };

  const handleOpenEditPromo = (promo) => {
    setEditingPromo(promo);
    setPromoForm({
      nombre: promo.nombre || "",
      descripcion: promo.descripcion || "",
      tipo: promo.tipo || "volumen",
      fecha_inicio: promo.fecha_inicio ? promo.fecha_inicio.slice(0, 16) : "",
      fecha_fin: promo.fecha_fin ? promo.fecha_fin.slice(0, 16) : "",
      prioridad: promo.prioridad || 0,
      is_active: promo.is_active ?? true,
    });
    setPromoModalOpen(true);
  };

  const handleSubmitPromo = async (e) => {
    e.preventDefault();
    if (!promoForm.nombre.trim()) {
      toast.error("El nombre de la promoción es obligatorio.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        store_id: store.id,
        nombre: promoForm.nombre.trim(),
        descripcion: promoForm.descripcion.trim() || null,
        tipo: promoForm.tipo,
        fecha_inicio: promoForm.fecha_inicio ? new Date(promoForm.fecha_inicio).toISOString() : null,
        fecha_fin: promoForm.fecha_fin ? new Date(promoForm.fecha_fin).toISOString() : null,
        prioridad: parseInt(promoForm.prioridad) || 0,
        is_active: promoForm.is_active,
      };

      if (editingPromo) {
        const { error } = await supabase
          .from("promocion")
          .update(payload)
          .eq("id", editingPromo.id);
        if (error) throw error;
        toast.success("Promoción actualizada correctamente.");
      } else {
        const { error } = await supabase.from("promocion").insert(payload);
        if (error) throw error;
        toast.success("Promoción creada correctamente.");
      }

      setPromoModalOpen(false);
      await fetchData();
      if (refetchPromotions) refetchPromotions();
    } catch (err) {
      console.error("Error al guardar promoción:", err);
      toast.error("No se pudo guardar la promoción.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePromoStatus = async (promo) => {
    try {
      const newStatus = !promo.is_active;
      const { error } = await supabase
        .from("promocion")
        .update({ is_active: newStatus })
        .eq("id", promo.id);

      if (error) throw error;
      toast.success(newStatus ? "Promoción activada" : "Promoción desactivada");
      fetchData();
      if (refetchPromotions) refetchPromotions();
    } catch (err) {
      toast.error("Error al cambiar estado.");
    }
  };

  const handleDeletePromo = async (promoId) => {
    if (!window.confirm("¿Eliminar esta promoción y todas sus reglas?")) return;
    try {
      const { error } = await supabase.from("promocion").delete().eq("id", promoId);
      if (error) throw error;
      toast.success("Promoción eliminada.");
      fetchData();
      if (refetchPromotions) refetchPromotions();
    } catch (err) {
      toast.error("Error al eliminar.");
    }
  };

  // ---- HANDLERS REGLAS ----
  const handleOpenCreateRule = (promo) => {
    setSelectedPromoForRule(promo);
    setEditingRule(null);
    setRuleForm({
      sku: products[0]?.sku || "",
      cantidad_minima: 1,
      cantidad_maxima: "",
      tipo_descuento: "porcentaje",
      valor_descuento: "",
    });
    setRuleModalOpen(true);
  };

  const handleOpenEditRule = (promo, rule) => {
    setSelectedPromoForRule(promo);
    setEditingRule(rule);
    setRuleForm({
      sku: rule.sku || "",
      cantidad_minima: rule.cantidad_minima || 1,
      cantidad_maxima: rule.cantidad_maxima != null ? rule.cantidad_maxima : "",
      tipo_descuento: rule.tipo_descuento || "porcentaje",
      valor_descuento: rule.valor_descuento != null ? rule.valor_descuento : "",
    });
    setRuleModalOpen(true);
  };

  const handleSubmitRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.sku.trim()) {
      toast.error("Debes seleccionar o ingresar un Código SKU.");
      return;
    }
    const valorNum = parseFloat(ruleForm.valor_descuento);
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("El valor del descuento debe ser mayor a 0.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        promocion_id: selectedPromoForRule.id,
        sku: ruleForm.sku.trim(),
        cantidad_minima: parseInt(ruleForm.cantidad_minima) || 1,
        cantidad_maxima: ruleForm.cantidad_maxima ? parseInt(ruleForm.cantidad_maxima) : null,
        tipo_descuento: ruleForm.tipo_descuento,
        valor_descuento: valorNum,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("promocion_regla")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Regla actualizada.");
      } else {
        const { error } = await supabase.from("promocion_regla").insert(payload);
        if (error) throw error;
        toast.success("Regla agregada a la promoción.");
      }

      setRuleModalOpen(false);
      await fetchData();
      if (refetchPromotions) refetchPromotions();
    } catch (err) {
      console.error("Error al guardar regla:", err);
      toast.error("No se pudo guardar la regla.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("¿Deseas quitar esta regla de la promoción?")) return;
    try {
      const { error } = await supabase.from("promocion_regla").delete().eq("id", ruleId);
      if (error) throw error;
      toast.success("Regla eliminada.");
      fetchData();
      if (refetchPromotions) refetchPromotions();
    } catch (err) {
      toast.error("Error al eliminar regla.");
    }
  };

  const handleOpenCsvModal = (promo) => {
    setSelectedPromoForCsv(promo);
    setCsvModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-sm font-medium">Cargando módulo de promociones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Encabezado Explicativo */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-2xl p-6 shadow-xl border border-zinc-700/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-400/20 text-amber-300 p-1.5 rounded-lg border border-amber-400/30">
                <Tag className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold font-serif">Gestión de Promociones por SKU y Volumen</h2>
            </div>
            <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed mt-1">
              Configura campañas especiales (ej: <i>"Día del Padre"</i>) o reglas escalonadas por volumen (ej: <i>"Si compran más de 10 unidades obtienen 10% off"</i>). Las reglas se aplican automáticamente en catálogo y carrito.
            </p>
          </div>

          <button
            onClick={handleOpenCreatePromo}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nueva Promoción
          </button>
        </div>
      </div>

      {/* Lista de Promociones */}
      {promotions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-zinc-200 space-y-3">
          <Sparkles className="w-12 h-12 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800 font-serif">No tienes promociones creadas</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Crea tu primera promoción para ofrecer descuentos por volumen o eventos especiales a tus clientes.
          </p>
          <button
            onClick={handleOpenCreatePromo}
            className="mt-2 px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors"
          >
            + Crear Primera Promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {promotions.map((promo) => {
            const reglas = promo.promocion_regla || promo.reglas || [];
            return (
              <div
                key={promo.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs ${
                  promo.is_active ? "border-zinc-200" : "border-zinc-200 opacity-60 bg-zinc-50/50"
                }`}
              >
                {/* Header de la Tarjeta de Promoción */}
                <div className="p-4 sm:p-5 bg-zinc-50/70 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-900 font-serif">{promo.nombre}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          promo.tipo === "campana"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {promo.tipo === "campana" ? "🎉 Campaña / Evento" : "📦 Por Volumen"}
                      </span>
                      {promo.prioridad > 0 && (
                        <span className="text-[10px] bg-zinc-100 text-zinc-700 font-medium px-2 py-0.5 rounded-full border border-zinc-200">
                          Prioridad: {promo.prioridad}
                        </span>
                      )}
                    </div>

                    {promo.descripcion && (
                      <p className="text-xs text-zinc-500">{promo.descripcion}</p>
                    )}

                    {/* Vigencia */}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {promo.fecha_inicio || promo.fecha_fin
                          ? `${promo.fecha_inicio ? new Date(promo.fecha_inicio).toLocaleDateString("es-VE") : "Inicio libre"} ➔ ${promo.fecha_fin ? new Date(promo.fecha_fin).toLocaleDateString("es-VE") : "Sin expiración"}`
                          : "Permanente / Sin límite de fechas"}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de Cabecera */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleTogglePromoStatus(promo)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                        promo.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                      }`}
                      title="Activar/Desactivar promoción"
                    >
                      {promo.is_active ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Activa
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-zinc-400" /> Inactiva
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEditPromo(promo)}
                      className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                      title="Editar metadatos de la promoción"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeletePromo(promo.id)}
                      className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar promoción"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-Tabla de Reglas por SKU */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-500" />
                      Reglas de Descuento por Producto / SKU ({reglas.length})
                    </h4>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCsvModal(promo)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-[11px] rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Cargar múltiples reglas desde un archivo CSV"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Cargar CSV de Reglas
                      </button>

                      <button
                        onClick={() => handleOpenCreateRule(promo)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[11px] rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Regla de SKU
                      </button>
                    </div>
                  </div>

                  {reglas.length === 0 ? (
                    <div className="bg-zinc-50 rounded-xl p-4 text-center border border-dashed border-zinc-200">
                      <p className="text-xs text-zinc-500 italic">
                        Esta promoción no tiene reglas asignadas. Haz clic en <strong>"+ Agregar Regla de SKU"</strong> para seleccionar qué productos y cantidades obtendrán el descuento.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-100/70 text-zinc-600 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-200">
                          <tr>
                            <th className="py-2.5 px-3">Producto / SKU</th>
                            <th className="py-2.5 px-3">Rango de Cantidad</th>
                            <th className="py-2.5 px-3">Descuento Aplicado</th>
                            <th className="py-2.5 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 bg-white">
                          {reglas.map((rule) => {
                            const matchedProd = productSkuMap[String(rule.sku).trim().toLowerCase()];
                            return (
                              <tr key={rule.id} className="hover:bg-zinc-50/80 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-zinc-900">
                                    {matchedProd ? matchedProd.name : `SKU: ${rule.sku}`}
                                  </div>
                                  <div className="text-[10px] font-mono text-zinc-400">
                                    SKU: {rule.sku} {matchedProd ? `(Precio base: $${matchedProd.price})` : ""}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-zinc-700">
                                  {rule.cantidad_minima} {rule.cantidad_maxima ? `a ${rule.cantidad_maxima}` : "+"} piezas
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Tag className="w-3 h-3 text-emerald-600" />
                                    {rule.tipo_descuento === "porcentaje"
                                      ? `${rule.valor_descuento}% OFF`
                                      : `-$${parseFloat(rule.valor_descuento).toFixed(2)} USD`}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right space-x-1">
                                  <button
                                    onClick={() => handleOpenEditRule(promo, rule)}
                                    className="p-1 text-zinc-500 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                                    title="Editar regla"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="p-1 text-zinc-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                    title="Eliminar regla"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR PROMOCIÓN */}
      {promoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 font-serif flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                {editingPromo ? "Editar Promoción" : "Nueva Promoción"}
              </h3>
              <button
                onClick={() => setPromoModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPromo} className="space-y-4 text-xs">
              {/* Nombre */}
              <div>
                <label className="font-bold text-zinc-800 block mb-1">
                  Nombre de la Promoción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Descuento por Volumen Repuestos RTR o Especial Día del Padre"
                  value={promoForm.nombre}
                  onChange={(e) => setPromoForm({ ...promoForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                />
                <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 shrink-0" />
                  Identificador público y administrativo de la campaña o regla.
                </p>
              </div>

              {/* Tipo */}
              <div>
                <label className="font-bold text-zinc-800 block mb-1">
                  Tipo de Promoción *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPromoForm({ ...promoForm, tipo: "volumen" })}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      promoForm.tipo === "volumen"
                        ? "border-zinc-900 bg-zinc-900 text-white font-bold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="font-semibold text-xs">📦 Por Volumen</p>
                    <p className="text-[10px] opacity-80 font-normal mt-0.5">
                      Se activa por cantidad de piezas agregadas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPromoForm({ ...promoForm, tipo: "campana" })}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      promoForm.tipo === "campana"
                        ? "border-zinc-900 bg-zinc-900 text-white font-bold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="font-semibold text-xs">🎉 Campaña / Evento</p>
                    <p className="text-[10px] opacity-80 font-normal mt-0.5">
                      Vigencia temporal (ej: Día del Padre, Navidad).
                    </p>
                  </button>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="font-bold text-zinc-800 block mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Descuentos al mayor al llevar 10 o más unidades"
                  value={promoForm.descripcion}
                  onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                />
              </div>

              {/* Fechas de Vigencia */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Fecha Inicio (Opcional)</label>
                  <input
                    type="datetime-local"
                    value={promoForm.fecha_inicio}
                    onChange={(e) => setPromoForm({ ...promoForm, fecha_inicio: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Fecha Fin (Opcional)</label>
                  <input
                    type="datetime-local"
                    value={promoForm.fecha_fin}
                    onChange={(e) => setPromoForm({ ...promoForm, fecha_fin: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs outline-none bg-white"
                  />
                </div>
                <p className="col-span-2 text-[10px] text-zinc-400">
                  💡 Déjalo vacío para que la promoción esté activa permanentemente sin fecha de caducidad.
                </p>
              </div>

              {/* Prioridad y Estado Activo */}
              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="font-bold text-zinc-800 block mb-1">
                    Prioridad (Entero)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={promoForm.prioridad}
                    onChange={(e) => setPromoForm({ ...promoForm, prioridad: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    En caso de conflicto, aplica la de mayor prioridad.
                  </p>
                </div>

                <div className="flex flex-col items-start pt-1">
                  <label className="font-bold text-zinc-800 mb-1 block">Estado de la Promo</label>
                  <button
                    type="button"
                    onClick={() => setPromoForm({ ...promoForm, is_active: !promoForm.is_active })}
                    className={`w-full py-2 px-3 rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      promoForm.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-zinc-100 text-zinc-500 border-zinc-200"
                    }`}
                  >
                    {promoForm.is_active ? "✓ Promoción Activa" : "✕ Inactiva"}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setPromoModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Guardando..." : editingPromo ? "Actualizar" : "Crear Promoción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR REGLA DE SKU */}
      {ruleModalOpen && selectedPromoForRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 font-serif flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  {editingRule ? "Editar Regla" : "Agregar Regla a Promoción"}
                </h3>
                <p className="text-[10px] text-zinc-400">Promoción: {selectedPromoForRule.nombre}</p>
              </div>
              <button
                onClick={() => setRuleModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRule} className="space-y-4 text-xs">
              {/* Seleccionar Producto / SKU */}
              <div>
                <label className="font-bold text-zinc-800 block mb-1">
                  Producto / SKU Objetivo *
                </label>
                {products.length > 0 ? (
                  <select
                    value={ruleForm.sku}
                    onChange={(e) => setRuleForm({ ...ruleForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white font-medium"
                  >
                    {products.map((p) => {
                      const skuVal = p.sku || p.codigo_barra || p.barcode || "";
                      return (
                        <option key={p.id} value={skuVal}>
                          {p.name} — SKU: {skuVal || "Sin SKU"} (${p.price})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Ingresa el SKU (ej: RTR-044-RE)"
                    value={ruleForm.sku}
                    onChange={(e) => setRuleForm({ ...ruleForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  />
                )}
                <p className="text-[10px] text-zinc-400 mt-1">
                  Coincidencia exacta por el código de SKU o código de barra registrado en el producto.
                </p>
              </div>

              {/* Rango de Cantidad */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Cantidad Mínima *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ruleForm.cantidad_minima}
                    onChange={(e) => setRuleForm({ ...ruleForm, cantidad_minima: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs outline-none bg-white font-bold"
                  />
                  <p className="text-[10px] text-zinc-400 mt-0.5">Ej: 10 piezas</p>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Cantidad Máxima</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={ruleForm.cantidad_maxima}
                    onChange={(e) => setRuleForm({ ...ruleForm, cantidad_maxima: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs outline-none bg-white font-bold"
                  />
                  <p className="text-[10px] text-zinc-400 mt-0.5">Ej: 19 piezas (o vacío)</p>
                </div>
              </div>

              {/* Tipo y Valor de Descuento */}
              <div className="space-y-2">
                <label className="font-bold text-zinc-800 block">Tipo y Valor del Descuento *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, tipo_descuento: "porcentaje" })}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      ruleForm.tipo_descuento === "porcentaje"
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    Porcentaje (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, tipo_descuento: "monto_fijo" })}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      ruleForm.tipo_descuento === "monto_fijo"
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    Monto Fijo USD ($)
                  </button>
                </div>

                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={ruleForm.tipo_descuento === "porcentaje" ? "Ej: 10 (para 10% off)" : "Ej: 5.00 (para $5.00 USD off)"}
                    value={ruleForm.valor_descuento}
                    onChange={(e) => setRuleForm({ ...ruleForm, valor_descuento: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 bg-white font-bold"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {ruleForm.tipo_descuento === "porcentaje"
                      ? "Ingresa 10 para descontar el 10% del precio unitario."
                      : "Ingresa 5.00 para descontar $5.00 USD por cada unidad."}
                  </p>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Guardando..." : editingRule ? "Actualizar Regla" : "Guardar Regla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARGA MASIVA CSV */}
      {csvModalOpen && selectedPromoForCsv && (
        <PromotionRuleCSVModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          promotion={selectedPromoForCsv}
          products={products}
          onImportSuccess={async () => {
            await fetchData();
            if (refetchPromotions) refetchPromotions();
          }}
        />
      )}
    </div>
  );
}
