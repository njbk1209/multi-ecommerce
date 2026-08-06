import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Barcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Building2,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
} from "lucide-react";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../utils/supabase";
import {
  playSuccessBeep,
  playErrorBeep,
  playCompleteFanfare,
} from "../utils/audio";

export default function PickingScannerModal({
  isOpen,
  onClose,
  order,
  onCompletePicking,
  pickedState,
  setPickedState,
  onRefreshOrders,
}) {
  const [manualCode, setManualCode] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const html5QrcodeScannerRef = useRef(null);
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(Date.now());
  const manualInputRef = useRef(null);

  // Ítems del pedido
  const items = order?.items || [];

  // Extraer lista única de sucursales en este pedido
  const sucursalesInOrder = Array.from(
    new Set(
      items.map(
        (i) => i.sucursal_nombre || i.sucursal?.nombre || "Sucursal Principal"
      )
    )
  );

  // Sincronizar estado inicial de picking desde Supabase (cantidad_recolectada de DB)
  useEffect(() => {
    if (!order?.id || !items.length) return;

    const dbPickingMap = {};
    items.forEach((item) => {
      dbPickingMap[item.id] = item.cantidad_recolectada || 0;
    });

    setPickedState((prev) => ({
      ...prev,
      [order.id]: {
        ...dbPickingMap,
        ...(prev[order.id] || {}),
      },
    }));
  }, [order?.id, items]);

  // Suscripción Realtime a cambios en la tabla 'pedido_item' para sincronización entre sucursales
  useEffect(() => {
    if (!isOpen || !order?.id) return;

    const channel = supabase
      .channel(`picking_order_${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedido_item",
          filter: `pedido_id=eq.${order.id}`,
        },
        (payload) => {
          const updatedItem = payload.new;
          if (updatedItem && updatedItem.id) {
            setPickedState((prev) => ({
              ...prev,
              [order.id]: {
                ...(prev[order.id] || {}),
                [updatedItem.id]: updatedItem.cantidad_recolectada || 0,
              },
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, order?.id]);

  const currentPicking = pickedState[order?.id] || {};

  // Totales globales
  const totalTargetQty = items.reduce((acc, item) => acc + (item.cantidad || 1), 0);
  const totalPickedQty = items.reduce((acc, item) => {
    const current = currentPicking[item.id] ?? (item.cantidad_recolectada || 0);
    return acc + current;
  }, 0);

  const isFullyPicked = totalTargetQty > 0 && totalPickedQty >= totalTargetQty;

  // Filtrar ítems por sucursal seleccionada
  const filteredItems = items.filter((item) => {
    if (selectedBranch === "all") return true;
    const bName =
      item.sucursal_nombre || item.sucursal?.nombre || "Sucursal Principal";
    return bName === selectedBranch;
  });

  // Auto-enfocar el input de escaneo al abrir modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Detector de pistola lectora de código de barras USB/HID (Pulsaciones súper rápidas)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length > 2) {
          e.preventDefault();
          const scanned = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = "";
          processScannedBarcode(scanned);
        }
      } else if (e.key.length === 1) {
        if (timeDiff < 50 || !isInput) {
          barcodeBufferRef.current += e.key;
        } else {
          barcodeBufferRef.current = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, order, currentPicking]);

  // Iniciar / Detener Cámara Móvil
  const toggleCameraScanner = async () => {
    if (isCameraActive) {
      await stopCamera();
    } else {
      await startCamera();
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("reader");
        html5QrcodeScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777778,
          },
          (decodedText) => {
            processScannedBarcode(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Error al iniciar cámara:", err);
        setCameraError("No se pudo acceder a la cámara del dispositivo.");
        setIsCameraActive(false);
      }
    }, 300);
  };

  const stopCamera = async () => {
    if (html5QrcodeScannerRef.current) {
      try {
        await html5QrcodeScannerRef.current.stop();
        html5QrcodeScannerRef.current.clear();
      } catch (err) {
        console.warn("Error deteniendo cámara:", err);
      }
      html5QrcodeScannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrcodeScannerRef.current) {
        try {
          html5QrcodeScannerRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  // Procesar código escaneado con persistencia directa en Supabase
  const processScannedBarcode = async (rawCode, incrementAmount = scanQty) => {
    if (!rawCode) return;
    const cleanCode = rawCode.trim().toLowerCase();
    const qtyToAdd = Math.max(1, parseInt(incrementAmount, 10) || 1);

    // Buscar ítem en el pedido (por barcode o sku)
    const matchingItem = items.find((item) => {
      const barcode = (item.codigo_barra || item.barcode || "").trim().toLowerCase();
      const sku = (item.sku || "").trim().toLowerCase();
      return (barcode && barcode === cleanCode) || (sku && sku === cleanCode);
    });

    if (!matchingItem) {
      if (soundEnabled) playErrorBeep();
      toast.error(`❌ Código "${rawCode}" NO pertenece a este pedido.`, {
        duration: 4000,
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      setManualCode("");
      return;
    }

    const currentQty = currentPicking[matchingItem.id] ?? (matchingItem.cantidad_recolectada || 0);

    if (currentQty >= matchingItem.cantidad) {
      if (soundEnabled) playErrorBeep();
      toast.error(
        `⚠️ "${matchingItem.nombre_producto}" ya está 100% recolectado (${currentQty}/${matchingItem.cantidad}).`,
        {
          duration: 4000,
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        }
      );
      setManualCode("");
      return;
    }

    const nextQty = Math.min(matchingItem.cantidad, currentQty + qtyToAdd);
    const addedActual = nextQty - currentQty;

    // Actualización optimista del estado local
    setPickedState((prev) => ({
      ...prev,
      [order.id]: {
        ...(prev[order.id] || {}),
        [matchingItem.id]: nextQty,
      },
    }));

    setManualCode("");
    setScanQty(1);

    // PERSISTIR EN SUPABASE (public.pedido_item)
    try {
      const { error: dbError } = await supabase
        .from("pedido_item")
        .update({ cantidad_recolectada: nextQty })
        .eq("id", matchingItem.id);

      if (dbError) throw dbError;
    } catch (err) {
      console.error("Error al persistir cantidad_recolectada en Supabase:", err);
      toast.error("⚠️ No se pudo guardar la lectura en la base de datos.");
    }

    // Notificaciones y Sonido Feedback
    const newTotalPicked = totalPickedQty + addedActual;
    const newIsComplete = newTotalPicked >= totalTargetQty;

    if (newIsComplete) {
      if (soundEnabled) playCompleteFanfare();
      toast.success(
        `🎉 ¡PICKING GLOBAL COMPLETADO AL 100%!`,
        {
          duration: 6000,
          style: { background: "#166534", color: "#fff", borderRadius: "12px" },
        }
      );
    } else if (nextQty === matchingItem.cantidad) {
      if (soundEnabled) playSuccessBeep();
      toast.success(
        `✅ ¡${matchingItem.nombre_producto} completado! (${nextQty}/${matchingItem.cantidad})`,
        {
          duration: 3000,
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        }
      );
    } else {
      if (soundEnabled) playSuccessBeep();
      toast.success(
        `✓ ${matchingItem.nombre_producto} (+${addedActual}) [${nextQty}/${matchingItem.cantidad}]`,
        {
          duration: 2500,
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        }
      );
    }

    if (onRefreshOrders) onRefreshOrders();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processScannedBarcode(manualCode, scanQty);
    }
  };

  const handleResetPicking = async () => {
    try {
      const itemIds = items.map((i) => i.id);
      const { error } = await supabase
        .from("pedido_item")
        .update({ cantidad_recolectada: 0 })
        .in("id", itemIds);

      if (error) throw error;

      const resetMap = {};
      items.forEach((i) => (resetMap[i.id] = 0));

      setPickedState((prev) => ({
        ...prev,
        [order.id]: resetMap,
      }));

      toast.success("Conteo de picking reiniciado en base de datos.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });

      if (onRefreshOrders) onRefreshOrders();
    } catch (err) {
      console.error("Error al reiniciar picking:", err);
      toast.error("Error al reiniciar picking en la base de datos.");
    }
  };

  if (!isOpen || !order) return null;

  const progressPercent = Math.min(
    100,
    Math.round((totalPickedQty / (totalTargetQty || 1)) * 100)
  );

  return (
    <div className="fixed inset-0 z-100 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ENCABEZADO MODAL */}
        <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-xl text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                <span>Estación de Picking - Pedido #{order.id}</span>
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Cliente: <span className="text-white font-semibold">{order.nombre_cliente}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                await stopCamera();
                onClose();
              }}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESO GLOBAL */}
        <div className="bg-zinc-900 px-5 py-3 border-t border-zinc-800 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <span>Picking Global:</span>
              <span className="font-bold text-white">
                {totalPickedQty} de {totalTargetQty} ítems ({progressPercent}%)
              </span>
            </span>
            {isFullyPicked ? (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 100% COMPLETADO EN BD
              </span>
            ) : (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Sincronizado en Tiempo Real ⚡
              </span>
            )}
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isFullyPicked
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/50"
                  : "bg-gradient-to-r from-amber-500 to-emerald-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* PESTAÑAS POR SUCURSAL / ALMACÉN */}
        {sucursalesInOrder.length > 1 && (
          <div className="bg-zinc-100 px-5 py-2 border-b border-zinc-200 flex items-center gap-2 overflow-x-auto shrink-0 whitespace-nowrap">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Filtrar Almacén:
            </span>

            <button
              type="button"
              onClick={() => setSelectedBranch("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedBranch === "all"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Todas ({items.reduce((sum, i) => sum + (currentPicking[i.id] || 0), 0)}/{totalTargetQty})
            </button>

            {sucursalesInOrder.map((sucName) => {
              const sucItems = items.filter(
                (i) =>
                  (i.sucursal_nombre || i.sucursal?.nombre || "Sucursal Principal") ===
                  sucName
              );
              const branchTarget = sucItems.reduce((sum, i) => sum + (i.cantidad || 1), 0);
              const branchPicked = sucItems.reduce(
                (sum, i) => sum + (currentPicking[i.id] || 0),
                0
              );
              const isBranchDone = branchTarget > 0 && branchPicked >= branchTarget;

              return (
                <button
                  key={sucName}
                  type="button"
                  onClick={() => setSelectedBranch(sucName)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedBranch === sucName
                      ? "bg-zinc-950 text-white shadow-xs"
                      : isBranchDone
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span>{sucName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isBranchDone
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {branchPicked}/{branchTarget}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* CONTENEDOR SCROLLEABLE PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* MÓDULO DE ESCANEO POR CÁMARA */}
          {isCameraActive && (
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-white font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Camera className="w-4 h-4" /> Escáner de Cámara Activo
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-xs text-zinc-400 hover:text-white underline"
                >
                  Cerrar Cámara
                </button>
              </div>
              <div
                id="reader"
                className="w-full rounded-xl overflow-hidden border border-zinc-700 bg-black min-h-[180px]"
              />
              {cameraError && (
                <p className="text-xs text-rose-400 font-medium">{cameraError}</p>
              )}
            </div>
          )}

          {/* INPUT MANUAL Y BOTONES DE ESCANEO */}
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2 items-center">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  placeholder="Escanea con pistola o ingresa código/SKU..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 outline-none text-xs font-mono font-semibold transition-all"
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </div>

              {/* CAMPO DE CANTIDAD DE ESCANEO MASIVO */}
              <div className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 rounded-xl px-2.5 py-1.5 shrink-0">
                <span className="text-[11px] font-bold text-zinc-600 uppercase">Cant:</span>
                <input
                  type="number"
                  min="1"
                  value={scanQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setScanQty(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className="w-14 py-1 text-center font-mono font-bold text-xs bg-white border border-zinc-300 rounded-lg outline-none focus:ring-2 focus:ring-zinc-950"
                  title="Cantidad a sumar en el escaneo"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 shrink-0"
              >
                Procesar
              </button>
            </form>

            <button
              type="button"
              onClick={toggleCameraScanner}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 shrink-0 ${
                isCameraActive
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-white border-zinc-200 hover:border-zinc-900 text-zinc-700"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isCameraActive ? "Detener Cámara" : "Cámara Móvil"}</span>
            </button>
          </div>

          {/* LISTA DE ARTÍCULOS PARA RECOLECTAR */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">
              <span>
                Artículos ({selectedBranch === "all" ? "Todas las Sucursales" : selectedBranch})
              </span>
              <button
                type="button"
                onClick={handleResetPicking}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 font-semibold flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Reiniciar conteo BD
              </button>
            </div>

            <div className="divide-y divide-zinc-100 border border-zinc-200/80 rounded-2xl bg-white overflow-hidden shadow-2xs">
              {filteredItems.map((item) => {
                const pickedCount = currentPicking[item.id] ?? (item.cantidad_recolectada || 0);
                const targetQty = item.cantidad || 1;
                const isItemComplete = pickedCount >= targetQty;
                const isItemPartial = pickedCount > 0 && !isItemComplete;

                const barcode = item.codigo_barra || item.barcode;
                const sucName =
                  item.sucursal_nombre || item.sucursal?.nombre || "Sucursal Principal";

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isItemComplete
                        ? "bg-emerald-50/60"
                        : isItemPartial
                        ? "bg-amber-50/40"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-sm ${
                            isItemComplete
                              ? "text-emerald-900 line-through opacity-85"
                              : "text-zinc-800"
                          }`}
                        >
                          {item.nombre_producto}
                        </span>

                        {/* Tag de Sucursal */}
                        <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-zinc-400" />
                          {sucName}
                        </span>

                        {/* Badges de Modificadores */}
                        {item.opciones_seleccionadas?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {item.opciones_seleccionadas.map((opt, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.5 rounded font-medium"
                              >
                                {opt.nombre}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Datos del Código de Barra / SKU */}
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 flex-wrap">
                        {item.sku && (
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700 font-semibold border border-zinc-200">
                            SKU: {item.sku}
                          </span>
                        )}
                        {barcode ? (
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700 font-semibold border border-zinc-200 flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-zinc-400" />
                            {barcode}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-sans italic text-[10px]">
                            ⚠️ Sin código de barra grabado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CONTADOR DE PICKING POR ÍTEM */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-bold font-mono px-2.5 py-1 rounded-xl border block ${
                            isItemComplete
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                              : isItemPartial
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          }`}
                        >
                          {pickedCount} / {targetQty}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PIE DEL MODAL CON ACCIÓN OBLIGATORIA */}
        <div className="bg-zinc-50 p-4 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-500 text-center sm:text-left">
            {isFullyPicked ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ¡Todas las sucursales completaron el picking en Supabase!
              </span>
            ) : (
              <span className="text-amber-800 font-medium">
                Escanea cada producto hasta alcanzar el 100% para avanzar el pedido.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={async () => {
                await stopCamera();
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl transition-all"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={!isFullyPicked}
              onClick={async () => {
                await stopCamera();
                onCompletePicking(order);
              }}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                isFullyPicked
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-emerald-600/30"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Avanzar Estado del Pedido</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
