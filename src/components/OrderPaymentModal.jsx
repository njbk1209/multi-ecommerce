import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  X,
  DollarSign,
  TrendingUp,
  Building2,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";

const PAYMENT_METHODS = [
  "Pago Móvil",
  "Punto de Venta",
  "Efectivo USD",
  "Efectivo Bs",
  "Zelle",
  "Binance Pay",
  "Transferencia Bancaria",
  "Otros",
];

const checkIsPdf = (url) => {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.startsWith("data:application/pdf");
};

const OrderPaymentModal = ({
  isOpen,
  onClose = () => {},
  order,
  exchangeRate = 1,
  onSaveSuccess = () => {},
}) => {
  const rate = exchangeRate || 1;
  const [mode, setMode] = useState("structured"); // 'structured' | 'generic'
  const [notaLibre, setNotaLibre] = useState("");
  const [payments, setPayments] = useState([]);
  const [genericFiles, setGenericFiles] = useState([]);
  const [existingComprobantes, setExistingComprobantes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingUrl, setViewingUrl] = useState(null);

  // Inicializar el estado si el pedido ya tiene detalles_pago guardados
  useEffect(() => {
    if (order && order.detalles_pago) {
      const dp = order.detalles_pago;
      if (dp.tipo_registro === "generic") {
        setMode("generic");
      } else {
        setMode("structured");
      }

      setNotaLibre(dp.nota_libre || "");

      if (Array.isArray(dp.pagos) && dp.pagos.length > 0) {
        setPayments(
          dp.pagos.map((p, idx) => ({
            id: String(idx + 1),
            metodo: p.metodo || "Pago Móvil",
            monto_usd: parseFloat(p.monto_usd) || 0,
            monto_bs: parseFloat(p.monto_bs) || (parseFloat(p.monto_usd || 0) * rate),
            referencia: p.referencia || "",
            comprobante_url: p.comprobante_url || "",
            file: null,
          }))
        );
      } else {
        setPayments([
          {
            id: "1",
            metodo: "Pago Móvil",
            monto_usd: order.total_usd || 0,
            monto_bs: (order.total_usd || 0) * rate,
            referencia: "",
            comprobante_url: "",
            file: null,
          },
        ]);
      }

      setExistingComprobantes(dp.comprobantes || []);
    } else if (order) {
      setMode("structured");
      setNotaLibre("");
      setPayments([
        {
          id: "1",
          metodo: "Pago Móvil",
          monto_usd: order.total_usd || 0,
          monto_bs: (order.total_usd || 0) * rate,
          referencia: "",
          comprobante_url: "",
          file: null,
        },
      ]);
      setGenericFiles([]);
      setExistingComprobantes([]);
    }
  }, [order, rate, isOpen]);

  // Cálculos dinámicos en vivo
  const totalOrderUSD = parseFloat(order?.total_usd || 0);
  const totalOrderBS = totalOrderUSD * rate;

  const totalRegisteredUSD = useMemo(() => {
    if (mode === "generic") return totalOrderUSD;
    return payments.reduce((sum, p) => sum + (parseFloat(p.monto_usd) || 0), 0);
  }, [payments, mode, totalOrderUSD]);

  const totalRegisteredBS = totalRegisteredUSD * rate;
  const remainingUSD = totalOrderUSD - totalRegisteredUSD;

  // Agregar una nueva línea de pago
  const handleAddPaymentLine = () => {
    const defaultMonto = remainingUSD > 0 ? remainingUSD : 0;
    setPayments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        metodo: "Pago Móvil",
        monto_usd: defaultMonto,
        monto_bs: defaultMonto * rate,
        referencia: "",
        comprobante_url: "",
        file: null,
      },
    ]);
  };

  // Remover línea de pago
  const handleRemovePaymentLine = (id) => {
    if (payments.length === 1) {
      toast.error("Debe existir al menos una forma de pago en la lista.");
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  // Cambiar valores de una línea de pago
  const handlePaymentChange = (id, field, value) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "monto_usd") {
          const usdVal = parseFloat(value) || 0;
          return {
            ...p,
            monto_usd: usdVal,
            monto_bs: usdVal * rate,
          };
        }
        return { ...p, [field]: value };
      })
    );
  };

  // Asignar archivo por línea
  const handleLineFileChange = (id, file) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, file } : p))
    );
  };

  // Subir un archivo a Supabase Storage bucket 'productos'
  const uploadFileToSupabase = async (file, prefix = "comprobante") => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `comprobantes_pedidos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(filePath, file);

      if (uploadError) {
        console.warn("Error de subida a Supabase storage:", uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("productos")
        .getPublicUrl(filePath);

      return urlData?.publicUrl || null;
    } catch (err) {
      console.error("Excepción en uploadFileToSupabase:", err);
      return null;
    }
  };

  // Guardar detalles de pago en Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!order?.id) return;

    setIsSubmitting(true);
    try {
      let finalComprobantes = [...existingComprobantes];
      let finalPayments = [];

      if (mode === "structured") {
        for (const p of payments) {
          let url = p.comprobante_url;
          if (p.file) {
            const uploadedUrl = await uploadFileToSupabase(p.file, "pago_linea");
            if (uploadedUrl) {
              url = uploadedUrl;
              finalComprobantes.push(uploadedUrl);
            }
          }

          finalPayments.push({
            metodo: p.metodo,
            monto_usd: parseFloat(p.monto_usd || 0),
            monto_bs: parseFloat(p.monto_bs || 0),
            referencia: p.referencia || "",
            comprobante_url: url || null,
          });
        }
      } else {
        // Modo genérico
        for (const file of genericFiles) {
          const uploadedUrl = await uploadFileToSupabase(file, "pago_generico");
          if (uploadedUrl) {
            finalComprobantes.push(uploadedUrl);
          }
        }
      }

      const detallesPayload = {
        tipo_registro: mode,
        nota_libre: notaLibre.trim(),
        pagos: finalPayments,
        comprobantes: finalComprobantes,
        total_registrado_usd: totalRegisteredUSD,
        total_registrado_bs: totalRegisteredBS,
        fecha_registro: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("pedido")
        .update({ detalles_pago: detallesPayload })
        .eq("id", order.id);

      if (error) throw error;

      toast.success("🎉 ¡Detalles de pago guardados correctamente!", {
        style: { background: "#059669", color: "#fff", borderRadius: "12px" },
      });

      if (onSaveSuccess) {
        onSaveSuccess({
          ...order,
          detalles_pago: detallesPayload,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error guardando detalles de pago:", err);
      toast.error("No se pudieron guardar los detalles de pago en la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-zinc-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Detalles y Verificación de Pago - Pedido #{order.id}</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Cliente: <strong>{order.nombre_cliente}</strong> | Tasa de Cambio: <strong>{rate.toFixed(2)} Bs/USD</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tarjeta Resumen Financiero del Pedido */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4">
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Pedido</span>
            <strong className="text-xl font-serif text-zinc-900">${totalOrderUSD.toFixed(2)} USD</strong>
            <p className="text-[11px] text-zinc-500 font-mono">{totalOrderBS.toFixed(2)} Bs</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Registrado</span>
            <strong className="text-xl font-serif text-emerald-700">${totalRegisteredUSD.toFixed(2)} USD</strong>
            <p className="text-[11px] text-emerald-600 font-mono">{totalRegisteredBS.toFixed(2)} Bs</p>
          </div>
          <div className="text-right sm:text-left">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Estado de Cobertura</span>
            {Math.abs(remainingUSD) < 0.01 ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Cubierto
              </span>
            ) : remainingUSD > 0 ? (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5" /> Faltan ${remainingUSD.toFixed(2)}
              </span>
            ) : (
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 border border-blue-300">
                Excedente (+${Math.abs(remainingUSD).toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Seleccionar Modo de Registro */}
        <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/60">
          <button
            type="button"
            onClick={() => setMode("structured")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === "structured"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Formas de Pago Mixtas (Estructurado)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("generic")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === "generic"
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Nota Libre / Explicación Genérica</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* MODO 1: ESTRUCTURADO (PAGOS MULTIMÉTODO) */}
          {mode === "structured" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Desglose de Formas de Pago ({payments.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddPaymentLine}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Pago</span>
                </button>
              </div>

              <div className="space-y-3">
                {payments.map((p, index) => (
                  <div
                    key={p.id}
                    className="bg-white border border-zinc-200/90 rounded-2xl p-4 space-y-3 shadow-xs relative"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] text-zinc-700">
                          {index + 1}
                        </span>
                        <span>Línea de Pago #{index + 1}</span>
                      </span>

                      {payments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePaymentLine(p.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar esta línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                          Método de Pago
                        </label>
                        <select
                          value={p.metodo}
                          onChange={(e) => handlePaymentChange(p.id, "metodo", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                          Monto en USD ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.monto_usd}
                          onChange={(e) => handlePaymentChange(p.id, "monto_usd", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                        />
                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                          ≈ {(parseFloat(p.monto_usd || 0) * rate).toFixed(2)} Bs
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                          N° Referencia / Comprobante
                        </label>
                        <input
                          type="text"
                          placeholder="ej. Ref 984521 o PV-123"
                          value={p.referencia}
                          onChange={(e) => handlePaymentChange(p.id, "referencia", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all"
                        />
                      </div>
                    </div>

                    {/* Subida de comprobante por línea */}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-zinc-600" />
                          <span>{p.file ? p.file.name : "Adjuntar Capture / Foto"}</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleLineFileChange(p.id, f);
                            }}
                            className="hidden"
                          />
                        </label>

                        {p.comprobante_url && !p.file && (
                          <button
                            type="button"
                            onClick={() => setViewingUrl(p.comprobante_url)}
                            className="text-emerald-700 underline font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Comprobante
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODO 2: NOTA LIBRE GENÉRICA */}
          {mode === "generic" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Explicación o Leyenda del Pago Libre
                </label>
                <textarea
                  rows={4}
                  placeholder="ej. El cliente realizó un pago parcial en tienda por punto de venta Banesco de $70 y canceló los $30 restantes mediante Pago Móvil a la cuenta de la empresa (Ref: 984521)."
                  value={notaLibre}
                  onChange={(e) => setNotaLibre(e.target.value)}
                  className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  Adjuntar Fotos / Captures de Pago Adicionales
                </label>

                <div className="border-2 border-dashed border-zinc-200 hover:border-zinc-900 rounded-2xl p-4 text-center bg-zinc-50 hover:bg-white transition-all cursor-pointer relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const filesArray = Array.from(e.target.files || []);
                      setGenericFiles((prev) => [...prev, ...filesArray]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 mx-auto text-zinc-400 mb-1" />
                  <p className="text-xs font-semibold text-zinc-700">
                    Haz clic o arrastra fotos/PDFs de comprobantes aquí
                  </p>
                </div>

                {genericFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {genericFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 flex items-center gap-1.5"
                      >
                        {file.type === "application/pdf" ? (
                          <FileText className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setGenericFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comprobantes Existentes Guardados */}
          {existingComprobantes.length > 0 && (
            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Comprobantes Registrados Anteriores ({existingComprobantes.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {existingComprobantes.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setViewingUrl(url)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Comprobante #{idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botones del Formulario */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                isSubmitting
                  ? "bg-zinc-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/30"
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin text-xs">⏳</span> Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Guardar Detalles de Pago
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal para visualizar comprobantes */}
      {viewingUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" /> Comprobante de Pago
              </h3>
              <button
                onClick={() => setViewingUrl(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-2">
              {checkIsPdf(viewingUrl) ? (
                <iframe
                  src={viewingUrl}
                  title="Comprobante PDF"
                  className="w-full h-[60vh] rounded-2xl border border-zinc-200 shadow-md bg-zinc-50"
                />
              ) : (
                <img
                  src={viewingUrl}
                  alt="Comprobante"
                  className="max-h-[60vh] w-auto mx-auto rounded-2xl border border-zinc-200 shadow-md object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <a
                href={viewingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold transition-all hover:bg-zinc-800"
              >
                Abrir en Tamaño Completo 🔗
              </a>
              <button
                onClick={() => setViewingUrl(null)}
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

export default OrderPaymentModal;
