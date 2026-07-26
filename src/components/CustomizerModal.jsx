import React, { useState, useEffect } from "react";
import { X, ShoppingBag } from "lucide-react";

const CustomizerModal = ({ isOpen, onClose, product, onConfirm }) => {
  const [optionGroups, setOptionGroups] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({}); // Key: group_id, Value: Array of option objects
  const [comment, setComment] = useState("");
  const loading = false;

  useEffect(() => {
    if (!isOpen) return;
    setOptionGroups(product?.optionGroups || []);
    setSelectedOptions({});
    setComment("");
  }, [isOpen, product]);

  if (!isOpen) return null;

  // Manejar cambios en la selección de opciones
  const handleOptionSelect = (group, value) => {
    setSelectedOptions((prev) => {
      const currentSelection = prev[group.id] || [];
      const price_modifier = parseFloat(value.modificador_precio) || 0;
      const price_compare_modifier = value.modificador_precio_comparacion
        ? parseFloat(value.modificador_precio_comparacion)
        : null;

      if (group.es_multiple) {
        // Multi-selección (Checkbox behavior)
        const exists = currentSelection.some((item) => item.id === value.id);
        const updated = exists
          ? currentSelection.filter((item) => item.id !== value.id)
          : [
              ...currentSelection,
              {
                value_id: value.id,
                id: value.id, // For uniqueness mapping
                nombre: value.nombre,
                grupo: group.nombre,
                price_modifier,
                price_compare_modifier,
              },
            ];
        return { ...prev, [group.id]: updated };
      } else {
        // Selección única (Radio button behavior)
        return {
          ...prev,
          [group.id]: [
            {
              value_id: value.id,
              id: value.id,
              nombre: value.nombre,
              grupo: group.nombre,
              price_modifier,
              price_compare_modifier,
            },
          ],
        };
      }
    });
  };

  // Verificar si hay grupos obligatorios sin selección
  const isMissingRequiredSelections = () => {
    for (const group of optionGroups) {
      if (group.es_obligatorio) {
        const selection = selectedOptions[group.id] || [];
        if (selection.length === 0) {
          return true; // Falta selección obligatoria
        }
      }
    }
    return false;
  };

  // Calcular precio total dinámico (Base + Modificadores)
  const basePrice = product.precio_por_tamano
    ? 0
    : parseFloat(product.price) || 0;
  const baseComparePrice = product.precio_por_tamano
    ? 0
    : parseFloat(product.compare_price) || 0;
  const selectedOptionsFlat = Object.values(selectedOptions).flat();
  const modifiersTotal = selectedOptionsFlat.reduce(
    (sum, opt) => sum + (parseFloat(opt.price_modifier) || 0),
    0,
  );
  const totalUnitPrice = basePrice + modifiersTotal;

  const modifiersCompareTotal = selectedOptionsFlat.reduce((sum, opt) => {
    const compVal =
      opt.price_compare_modifier !== null &&
      opt.price_compare_modifier !== undefined
        ? opt.price_compare_modifier
        : opt.price_modifier;
    return sum + (parseFloat(compVal) || 0);
  }, 0);

  const totalUnitComparePrice =
    baseComparePrice > 0 ||
    selectedOptionsFlat.some((o) => o.price_compare_modifier !== null)
      ? (baseComparePrice || basePrice) + modifiersCompareTotal
      : null;

  const handleConfirm = () => {
    if (isMissingRequiredSelections()) return;
    onConfirm(selectedOptionsFlat, comment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-rose-50 flex flex-col max-h-[85vh] animate-scale-up">
        {/* Header */}
        <div className="p-5 border-b border-rose-50 flex items-center justify-between bg-rose-50/20">
          <div>
            <span className="text-xs uppercase tracking-widest text-rose-400 font-semibold">
              Personalizar
            </span>
            <h3 className="text-lg font-bold text-slate-800 mt-0.5">
              {product.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-rose-100/50 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-10 h-10 border-4 border-rose-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">
                Cargando opciones...
              </p>
            </div>
          ) : (
            <>
              {/* Grupos de modificadores */}
              {optionGroups.map((group) => {
                const hasSelection =
                  (selectedOptions[group.id] || []).length > 0;
                const isMissing = group.es_obligatorio && !hasSelection;

                return (
                  <div
                    key={group.id}
                    className={`space-y-2 rounded-xl transition-all duration-300 ${
                      isMissing
                        ? "bg-rose-50/30 border border-rose-100 shadow-sm"
                        : "border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm md:text-base">
                        {group.nombre}
                        {!group.es_obligatorio && (
                          <span className="text-slate-400 font-normal text-xs lowercase ml-1.5">
                            (opcional)
                          </span>
                        )}
                      </h4>
                      {group.es_obligatorio &&
                        (isMissing ? (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-rose-100 text-rose-600 rounded animate-pulse">
                            Selección obligatoria
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                            ✓ Listo
                          </span>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {group.producto_opciones_valor?.map((val) => {
                        const isSelected = (
                          selectedOptions[group.id] || []
                        ).some((item) => item.id === val.id);
                        const extraPrice =
                          parseFloat(val.modificador_precio) || 0;
                        const extraComparePrice =
                          val.modificador_precio_comparacion
                            ? parseFloat(val.modificador_precio_comparacion)
                            : null;

                        return (
                          <button
                            type="button"
                            key={val.id}
                            onClick={() => handleOptionSelect(group, val)}
                            className={`p-3 text-left rounded-xl border text-sm font-medium transition-all flex items-center justify-between
                              ${
                                isSelected
                                  ? "bg-rose-50 border-rose-300 text-rose-700 font-semibold ring-1 ring-rose-300/30"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-rose-50/10 hover:border-rose-100"
                              }`}
                          >
                            <span>{val.nombre}</span>
                            <div className="flex items-center gap-1.5 text-xs">
                              {extraComparePrice &&
                                extraComparePrice > extraPrice && (
                                  <span className="line-through text-slate-400">
                                    ${extraComparePrice.toFixed(2)}
                                  </span>
                                )}
                              {extraPrice > 0 && (
                                <span
                                  className={
                                    isSelected
                                      ? "text-rose-600 font-bold"
                                      : "text-slate-500"
                                  }
                                >
                                  {basePrice === 0 && !group.es_multiple
                                    ? ""
                                    : "+"}
                                  ${extraPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Caja de comentarios */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-sm md:text-base">
                  Instrucciones Especiales
                </h4>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ej: Sin cebolla en la hamburguesa, borde de queso para la pizza, salsas aparte, etc..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none transition-all resize-none text-slate-700 placeholder-slate-400"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-rose-50 bg-slate-50 flex items-center justify-between">
          <div className="text-left">
            <p className="text-xs text-slate-400 font-medium">
              Precio Unitario
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-rose-500">
                ${totalUnitPrice.toFixed(2)}
              </p>
              {totalUnitComparePrice &&
                totalUnitComparePrice > totalUnitPrice && (
                  <p className="text-xs text-slate-400 line-through">
                    ${totalUnitComparePrice.toFixed(2)}
                  </p>
                )}
            </div>
            {isMissingRequiredSelections() && (
              <p className="text-[11px] text-rose-500 font-medium mt-0.5 animate-pulse">
                Faltan opciones obligatorias
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isMissingRequiredSelections() || loading}
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95
              ${
                isMissingRequiredSelections() || loading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200"
              }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Agregar al Carrito
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizerModal;
