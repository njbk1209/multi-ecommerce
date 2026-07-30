import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Mail,
  FileText,
  Building,
  RefreshCw,
  Star,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";

const BranchesManager = () => {
  const { store } = useCurrency();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    razon_social: "",
    identificacion_fiscal: "",
    direccion: "",
    ciudad: "",
    estado_provincia: "",
    codigo_postal: "",
    latitud: "",
    longitud: "",
    telefono: "",
    email_contacto: "",
    es_principal: false,
    is_active: true,
  });

  const fetchBranches = async (showToast = false) => {
    if (!store?.id) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("sucursal")
        .select("*")
        .eq("store_id", store.id)
        .order("es_principal", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setBranches(data || []);

      if (showToast) {
        toast.success("Sucursales actualizadas", {
          icon: "🏢",
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        });
      }
    } catch (err) {
      console.error("Error al cargar sucursales:", err);
      toast.error("No se pudieron cargar las sucursales.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [store?.id]);

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        nombre: branch.nombre || "",
        codigo: branch.codigo || "",
        razon_social: branch.razon_social || "",
        identificacion_fiscal: branch.identificacion_fiscal || "",
        direccion: branch.direccion || "",
        ciudad: branch.ciudad || "",
        estado_provincia: branch.estado_provincia || "",
        codigo_postal: branch.codigo_postal || "",
        latitud: branch.latitud || "",
        longitud: branch.longitud || "",
        telefono: branch.telefono || "",
        email_contacto: branch.email_contacto || "",
        es_principal: branch.es_principal || false,
        is_active: branch.is_active ?? true,
      });
    } else {
      setEditingBranch(null);
      setFormData({
        nombre: "",
        codigo: `SUC-00${branches.length + 1}`,
        razon_social: store?.comercial_name || "",
        identificacion_fiscal: "",
        direccion: "",
        ciudad: store?.city || "",
        estado_provincia: "",
        codigo_postal: "",
        latitud: "",
        longitud: "",
        telefono: store?.whatsapp || "",
        email_contacto: "",
        es_principal: branches.length === 0, // Si es la primera, marcar como principal por defecto
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre de la sucursal es obligatorio.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      return;
    }

    try {
      // Si la nueva sucursal o edición se marca como principal, desmarcar las demás de la tienda
      if (formData.es_principal) {
        await supabase
          .from("sucursal")
          .update({ es_principal: false })
          .eq("store_id", store.id);
      }

      // Preparar payload con tipos correctos (convertir latitud/longitud a float o null)
      const cleanLat = formData.latitud !== "" && formData.latitud !== null && !isNaN(parseFloat(formData.latitud))
        ? parseFloat(formData.latitud)
        : null;
      const cleanLng = formData.longitud !== "" && formData.longitud !== null && !isNaN(parseFloat(formData.longitud))
        ? parseFloat(formData.longitud)
        : null;

      const payload = {
        nombre: formData.nombre.trim(),
        codigo: formData.codigo ? formData.codigo.trim() : null,
        razon_social: formData.razon_social ? formData.razon_social.trim() : null,
        identificacion_fiscal: formData.identificacion_fiscal ? formData.identificacion_fiscal.trim() : null,
        direccion: formData.direccion ? formData.direccion.trim() : null,
        ciudad: formData.ciudad ? formData.ciudad.trim() : null,
        estado_provincia: formData.estado_provincia ? formData.estado_provincia.trim() : null,
        codigo_postal: formData.codigo_postal ? formData.codigo_postal.trim() : null,
        latitud: cleanLat,
        longitud: cleanLng,
        telefono: formData.telefono ? formData.telefono.trim() : null,
        email_contacto: formData.email_contacto ? formData.email_contacto.trim() : null,
        es_principal: !!formData.es_principal,
        is_active: !!formData.is_active,
      };

      if (editingBranch) {
        // Actualizar existente
        const { error } = await supabase
          .from("sucursal")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingBranch.id);

        if (error) throw error;
        toast.success(`Sucursal "${formData.nombre}" actualizada.`, {
          icon: "✏️",
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        });
      } else {
        // Crear nueva
        const { error } = await supabase.from("sucursal").insert([
          {
            ...payload,
            store_id: store.id,
          },
        ]);

        if (error) throw error;
        toast.success(`Sucursal "${formData.nombre}" creada con éxito.`, {
          icon: "🏢",
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        });
      }

      handleCloseModal();
      fetchBranches();
    } catch (err) {
      console.error("Error al guardar sucursal:", err);
      toast.error("Ocurrió un error al guardar la sucursal.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    }
  };

  const handleToggleActive = async (branch) => {
    try {
      const { error } = await supabase
        .from("sucursal")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id);

      if (error) throw error;

      toast.success(
        `Sucursal ${!branch.is_active ? "activada" : "desactivada"}.`,
        {
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        },
      );
      fetchBranches();
    } catch (err) {
      console.error("Error al cambiar estado de sucursal:", err);
      toast.error("No se pudo cambiar el estado de la sucursal.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    }
  };

  const handleDelete = async (branch) => {
    if (branch.es_principal) {
      toast.error("No se puede eliminar la sucursal principal.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      return;
    }

    if (
      !window.confirm(
        `¿Estás seguro de eliminar la sucursal "${branch.nombre}"? Se desvinculará el stock de esta sede.`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("sucursal")
        .delete()
        .eq("id", branch.id);

      if (error) throw error;

      toast.success("Sucursal eliminada.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      fetchBranches();
    } catch (err) {
      console.error("Error al eliminar sucursal:", err);
      toast.error("No se pudo eliminar la sucursal.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-zinc-200/80 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif font-semibold text-zinc-950">
              Gestión de Sucursales y Almacenes
            </h2>
            <span className="text-xs font-mono font-bold bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full border border-zinc-200">
              {branches.length} {branches.length === 1 ? "Sede" : "Sedes"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Administra las sedes físicas, datos fiscales para facturación y
            puntos de distribución de tu tienda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBranches(true)}
            disabled={isRefreshing}
            className={`p-2.5 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-xl shadow-sm transition-all ${
              isRefreshing ? "animate-spin" : ""
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva Sucursal
          </button>
        </div>
      </div>

      {/* Grid de Sucursales */}
      {loading ? (
        <div className="py-20 text-center text-zinc-400 font-serif animate-pulse">
          Cargando sucursales...
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-3xl p-16 text-center space-y-3">
          <Building2 className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">
            No tienes sucursales registradas aún.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-zinc-950 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Crear primera sucursal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`bg-white border rounded-2xl p-6 space-y-5 transition-all shadow-sm hover:shadow-md relative overflow-hidden ${
                branch.es_principal
                  ? "border-amber-300 ring-1 ring-amber-200"
                  : branch.is_active
                    ? "border-zinc-200/80"
                    : "border-zinc-200 bg-zinc-50/50 opacity-75"
              }`}
            >
              {/* Badge de Sede Principal */}
              {branch.es_principal && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Principal
                </div>
              )}

              {/* Cabecera Tarjeta */}
              <div className="space-y-1 pr-12">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-zinc-900 text-base">
                    {branch.nombre}
                  </h3>
                </div>
                {branch.codigo && (
                  <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded font-bold">
                    {branch.codigo}
                  </span>
                )}
              </div>

              {/* Datos Fiscales e Identidad Interna */}
              <div className="space-y-2 text-xs border-t border-b border-zinc-100 py-3 text-zinc-600">
                {branch.razon_social && (
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate font-medium">
                      {branch.razon_social}
                    </span>
                  </div>
                )}

                {branch.identificacion_fiscal && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-mono text-zinc-700 font-bold">
                      RIF/ID: {branch.identificacion_fiscal}
                    </span>
                  </div>
                )}

                {(branch.direccion || branch.ciudad) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {branch.direccion}
                      {branch.ciudad ? `, ${branch.ciudad}` : ""}
                    </span>
                  </div>
                )}

                {branch.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-mono">{branch.telefono}</span>
                  </div>
                )}

                {branch.email_contacto && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{branch.email_contacto}</span>
                  </div>
                )}
              </div>

              {/* Footer Acciones */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleToggleActive(branch)}
                  className={`text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                    branch.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200"
                  }`}
                >
                  {branch.is_active ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activa
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Inactiva
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(branch)}
                    className="p-2 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-xl transition-all shadow-sm"
                    title="Editar sucursal"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {!branch.es_principal && (
                    <button
                      onClick={() => handleDelete(branch)}
                      className="p-2 text-rose-500 hover:text-rose-700 border border-rose-200 hover:border-rose-300 bg-rose-50/50 rounded-xl transition-all shadow-sm"
                      title="Eliminar sucursal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar Sucursal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-semibold text-zinc-950">
                  {editingBranch ? "Editar Sucursal" : "Nueva Sucursal"}
                </h3>
                <p className="text-xs text-zinc-400 font-medium">
                  Configura los datos fiscales y logísticos del almacén/sede.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-zinc-400 hover:text-zinc-800 rounded-xl transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 block">
                    Nombre de Sucursal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Sucursal Chacao"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 block">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="ej: SUC-001"
                    value={formData.codigo}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Datos Fiscales */}
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-zinc-400 text-[10px]">
                  Identidad Fiscal (Uso Interno)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Razón Social / Nombre Legal
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Inversiones C.A."
                      value={formData.razon_social}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          razon_social: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      RIF / Identificación Fiscal
                    </label>
                    <input
                      type="text"
                      placeholder="ej: J-12345678-0"
                      value={formData.identificacion_fiscal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          identificacion_fiscal: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Dirección y Ubicación */}
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-zinc-400 text-[10px]">
                  Ubicación & Logística
                </h4>
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 block">
                    Dirección Física
                  </label>
                  <input
                    type="text"
                    placeholder="ej: Av. Francisco de Miranda, Edif. Centro, Piso 1"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Caracas"
                      value={formData.ciudad}
                      onChange={(e) =>
                        setFormData({ ...formData, ciudad: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Estado / Prov.
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Miranda"
                      value={formData.estado_provincia}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estado_provincia: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      placeholder="ej: 1060"
                      value={formData.codigo_postal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          codigo_postal: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Latitud GPS (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="ej: 10.4806"
                      value={formData.latitud}
                      onChange={(e) =>
                        setFormData({ ...formData, latitud: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Longitud GPS (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="ej: -66.9036"
                      value={formData.longitud}
                      onChange={(e) =>
                        setFormData({ ...formData, longitud: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contactos */}
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-zinc-400 text-[10px]">
                  Contacto de Sucursal
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="ej: +58 412 1234567"
                      value={formData.telefono}
                      onChange={(e) =>
                        setFormData({ ...formData, telefono: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 block">
                      Email de Contacto
                    </label>
                    <input
                      type="email"
                      placeholder="ej: chacao@tienda.com"
                      value={formData.email_contacto}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          email_contacto: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Switches Checkboxes */}
              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.es_principal}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        es_principal: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-zinc-950 focus:ring-zinc-950"
                  />
                  Marcar como Sede Principal
                </label>
                <p className="text-[11px] text-zinc-400 pl-6">
                  La sede principal se utilizará por defecto para el despacho y
                  precios predeterminados.
                </p>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-zinc-800 pt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-zinc-950 focus:ring-zinc-950"
                  />
                  Sucursal Activa
                </label>
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 border border-zinc-200 hover:border-zinc-400 text-zinc-600 font-semibold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95"
                >
                  {editingBranch ? "Guardar Cambios" : "Crear Sucursal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchesManager;
