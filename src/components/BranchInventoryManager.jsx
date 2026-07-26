import React, { useState, useEffect } from "react";
import {
  Package,
  Building2,
  Save,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";

const BranchInventoryManager = () => {
  const { store } = useCurrency();
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({}); // { `${producto_id}_${sucursal_id}`: { stock, stock_minimo, stock_status, id } }
  const [editedItems, setEditedItems] = useState({}); // Cambios pendientes de guardar
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async (showToast = false) => {
    if (!store?.id) return;
    setIsRefreshing(true);
    try {
      // 1. Cargar sucursales
      const { data: branchData, error: branchErr } = await supabase
        .from("sucursal")
        .select("*")
        .eq("store_id", store.id)
        .order("es_principal", { ascending: false })
        .order("nombre", { ascending: true });

      if (branchErr) throw branchErr;
      setBranches(branchData || []);

      if (branchData && branchData.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchData[0].id.toString());
      }

      // 2. Cargar productos de la tienda
      const { data: prodData, error: prodErr } = await supabase
        .from("producto")
        .select("id, name, sku, is_active, category:category!producto_category_fkey(name)")
        .eq("store", store.id)
        .order("name", { ascending: true });

      if (prodErr) throw prodErr;
      setProducts(prodData || []);

      // 3. Cargar stock por sucursal
      const branchIds = (branchData || []).map((b) => b.id);
      if (branchIds.length > 0) {
        const { data: inventoryData, error: invErr } = await supabase
          .from("producto_stock_sucursal")
          .select("*")
          .in("sucursal_id", branchIds);

        if (invErr) throw invErr;

        const map = {};
        (inventoryData || []).forEach((item) => {
          map[`${item.producto_id}_${item.sucursal_id}`] = {
            id: item.id,
            stock: item.stock,
            stock_minimo: item.stock_minimo || 0,
            stock_status: item.stock_status,
          };
        });
        setStockMap(map);
      }

      setEditedItems({});

      if (showToast) {
        toast.success("Inventarios actualizados", {
          icon: "📦",
          style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
        });
      }
    } catch (err) {
      console.error("Error al cargar inventarios por sucursal:", err);
      toast.error("No se pudieron cargar los datos de inventario.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [store?.id]);

  const handleStockChange = (productoId, sucursalId, field, value) => {
    const key = `${productoId}_${sucursalId}`;
    const current = editedItems[key] || stockMap[key] || {
      stock: 0,
      stock_minimo: 0,
      stock_status: true,
    };

    const updated = {
      ...current,
      [field]: value,
    };

    setEditedItems((prev) => ({
      ...prev,
      [key]: updated,
    }));
  };

  const handleSaveChanges = async () => {
    const keysToSave = Object.keys(editedItems);
    if (keysToSave.length === 0) {
      toast("No hay cambios pendientes por guardar.", {
        icon: "ℹ️",
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
      return;
    }

    setIsSaving(true);
    try {
      const recordsToUpsert = keysToSave.map((key) => {
        const [producto_id, sucursal_id] = key.split("_");
        const item = editedItems[key];
        return {
          producto_id: parseInt(producto_id),
          sucursal_id: parseInt(sucursal_id),
          stock: parseInt(item.stock) || 0,
          stock_minimo: parseInt(item.stock_minimo) || 0,
          stock_status: item.stock_status ?? true,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from("producto_stock_sucursal")
        .upsert(recordsToUpsert, { onConflict: "producto_id, sucursal_id" });

      if (error) throw error;

      toast.success(`${recordsToUpsert.length} registro(s) de inventario actualizados.`, {
        icon: "✅",
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });

      fetchData();
    } catch (err) {
      console.error("Error al guardar cambios de inventario:", err);
      toast.error("No se pudieron guardar los cambios de inventario.", {
        style: { background: "#18181b", color: "#fff", borderRadius: "12px" },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeBranch = branches.find(
    (b) => b.id.toString() === selectedBranchId,
  );

  const pendingCount = Object.keys(editedItems).length;

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-zinc-200/80 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif font-semibold text-zinc-950">
              Control de Inventario por Almacén / Sucursal
            </h2>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Ajusta las existencias físicas, existencias mínimas de alerta y disponibilidad por cada sede.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className={`p-2.5 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-xl shadow-sm transition-all ${
              isRefreshing ? "animate-spin" : ""
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSaveChanges}
            disabled={pendingCount === 0 || isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Save className="w-4 h-4" />
            {isSaving
              ? "Guardando..."
              : pendingCount > 0
                ? `Guardar Cambios (${pendingCount})`
                : "Guardado"}
          </button>
        </div>
      </div>

      {/* Selector de Sucursal y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 border border-zinc-200/80 rounded-2xl shadow-sm">
        {/* Selector de Sucursal */}
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider shrink-0">
            Sucursal / Almacén:
          </span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} {b.es_principal ? "(Sede Principal)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Buscador de Productos */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none transition-all"
          />
        </div>
      </div>

      {/* Tabla de Inventario por Sucursal */}
      {loading ? (
        <div className="py-20 text-center text-zinc-400 font-serif animate-pulse">
          Cargando matriz de inventario...
        </div>
      ) : !activeBranch ? (
        <div className="bg-white border border-zinc-200/80 rounded-3xl p-16 text-center space-y-3">
          <Building2 className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">
            Debes registrar primero al menos una sucursal.
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-3xl p-16 text-center space-y-3">
          <Package className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">
            No se encontraron productos coincidentes.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200/80 text-zinc-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="p-4">Producto / SKU</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4 text-center">Stock Actual ({activeBranch.nombre})</th>
                  <th className="p-4 text-center">Stock Mínimo</th>
                  <th className="p-4 text-center">Estado en Sucursal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProducts.map((product) => {
                  const key = `${product.id}_${activeBranch.id}`;
                  const currentData =
                    editedItems[key] || stockMap[key] || {
                      stock: 0,
                      stock_minimo: 0,
                      stock_status: true,
                    };

                  const isModified = !!editedItems[key];
                  const stockNum = parseInt(currentData.stock) || 0;
                  const minStockNum = parseInt(currentData.stock_minimo) || 0;
                  const isLowStock = stockNum <= minStockNum && stockNum > 0;
                  const isOutOfStock = stockNum <= 0;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-zinc-50/60 transition-colors ${
                        isModified ? "bg-amber-50/30" : ""
                      }`}
                    >
                      {/* Producto & SKU */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-900 text-xs sm:text-sm">
                            {product.name}
                          </p>
                          {product.sku && (
                            <span className="text-[10px] font-mono text-zinc-400 font-medium">
                              SKU: {product.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="p-4 text-zinc-600 font-medium">
                        {product.category?.name || "Sin Categoría"}
                      </td>

                      {/* Stock Actual Input */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={currentData.stock}
                            onChange={(e) =>
                              handleStockChange(
                                product.id,
                                activeBranch.id,
                                "stock",
                                e.target.value,
                              )
                            }
                            className={`w-24 text-center px-3 py-1.5 rounded-xl border text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-zinc-950 transition-all ${
                              isOutOfStock
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : isLowStock
                                  ? "border-amber-300 bg-amber-50 text-amber-800"
                                  : "border-zinc-200 text-zinc-900"
                            }`}
                          />
                          {isLowStock && (
                            <AlertTriangle
                              className="w-4 h-4 text-amber-500 shrink-0"
                              title="Alerta de Stock Bajo"
                            />
                          )}
                        </div>
                      </td>

                      {/* Stock Mínimo Input */}
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={currentData.stock_minimo}
                          onChange={(e) =>
                            handleStockChange(
                              product.id,
                              activeBranch.id,
                              "stock_minimo",
                              e.target.value,
                            )
                          }
                          className="w-20 text-center px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-mono font-medium outline-none focus:ring-1 focus:ring-zinc-950 transition-all"
                        />
                      </td>

                      {/* Estado en esta Sucursal (Switch/Toggle) */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleStockChange(
                              product.id,
                              activeBranch.id,
                              "stock_status",
                              !currentData.stock_status,
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 mx-auto border transition-all ${
                            currentData.stock_status
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          }`}
                        >
                          {currentData.stock_status ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Disponible
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> No Disponible
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchInventoryManager;
