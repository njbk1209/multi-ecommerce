import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit3, X, Loader2, Folder, CornerDownRight, Layers } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";
import toast from "react-hot-toast";

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Reemplaza espacios por -
    .replace(/[^\w\-]+/g, "") // Elimina caracteres no alfanuméricos
    .replace(/\-\-+/g, "-") // Reemplaza múltiples - por uno solo
    .replace(/^-+/, "") // Quita - del inicio
    .replace(/-+$/, ""); // Quita - del final
};

// Helper recursivo para aplanar el árbol de categorías manteniendo jerarquía y profundidad
export const buildCategoryTree = (flatList, parentId = null, depth = 0) => {
  let result = [];
  const children = flatList.filter((c) => {
    if (parentId === null) return !c.parent;
    return c.parent === parentId;
  });

  children.forEach((child) => {
    result.push({ ...child, depth });
    const subChildren = buildCategoryTree(flatList, child.id, depth + 1);
    result = result.concat(subChildren);
  });

  return result;
};

// Helper para obtener todos los IDs descendientes de una categoría (para evitar loops en el selector)
const getDescendantIds = (flatList, categoryId) => {
  let ids = [categoryId];
  const children = flatList.filter((c) => c.parent === categoryId);
  children.forEach((child) => {
    ids = ids.concat(getDescendantIds(flatList, child.id));
  });
  return ids;
};

export default function CategoriesManager() {
  const { store } = useCurrency();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Form fields
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("category")
        .select("*")
        .eq("store", store.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error al cargar categorías:", err);
      toast.error("No se pudieron cargar las categorías.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [store?.id]);

  // Árbol ordenado de categorías
  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories, null, 0);
  }, [categories]);

  // Mapa de IDs a nombres para mostrar rápidamente el nombre del padre
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Categorías válidas para seleccionar como Padre en el modal (excluyendo a la misma categoría y sus descendientes)
  const validParentOptions = useMemo(() => {
    if (!editingCategory) return categoryTree;
    const forbiddenIds = getDescendantIds(categories, editingCategory.id);
    return categoryTree.filter((c) => !forbiddenIds.includes(c.id));
  }, [categories, categoryTree, editingCategory]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName("");
    setParentId("");
    setDescription("");
    setModalOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setName(category.name);
    setParentId(category.parent ? category.parent.toString() : "");
    setDescription(category.description || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre de la categoría es obligatorio.");
      return;
    }

    setSubmitting(true);
    const slug = slugify(name);
    const parentValue = parentId ? parseInt(parentId) : null;

    try {
      if (editingCategory) {
        // Actualizar
        const { error } = await supabase
          .from("category")
          .update({
            name: name.trim(),
            slug,
            parent: parentValue,
            description: description.trim(),
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Categoría actualizada con éxito.");
      } else {
        // Crear
        const { error } = await supabase.from("category").insert({
          store: store.id,
          name: name.trim(),
          slug,
          parent: parentValue,
          description: description.trim(),
        });

        if (error) throw error;
        toast.success("Categoría creada con éxito.");
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      console.error("Error al guardar categoría:", err);
      toast.error("Ocurrió un error al guardar la categoría.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (categoryId, categoryName) => {
    // Comprobar si tiene subcategorías fijadas a ella
    const hasChildren = categories.some((c) => c.parent === categoryId);
    if (hasChildren) {
      toast.error(
        `No se puede eliminar "${categoryName}" porque tiene subcategorías asociadas. Elimina o reasigna sus subcategorías primero.`,
      );
      return;
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar la categoría "${categoryName}"?\nNota: Los productos asociados podrían perder su relación.`,
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("category")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
      toast.success("Categoría eliminada correctamente.");
      fetchCategories();
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      toast.error(
        "No se pudo eliminar la categoría. Asegúrate de que no esté siendo usada.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif font-semibold text-zinc-950">
              Categorías de la Tienda
            </h2>
            <span className="text-xs font-mono font-bold bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full border border-zinc-200">
              {categories.length} {categories.length === 1 ? "Categoría" : "Categorías"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Organiza tus productos en categorías principales y subcategorías jerárquicas.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">
            Cargando jerarquía de categorías...
          </span>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-16 text-center space-y-3">
          <Folder className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">
            No has creado categorías en esta tienda todavía.
          </p>
          <button
            onClick={handleOpenCreate}
            className="text-xs font-semibold text-zinc-900 border border-zinc-300 px-3.5 py-1.5 rounded-xl hover:border-zinc-900 transition-colors"
          >
            Crear la primera categoría
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4">Categoría / Jerarquía</th>
                  <th className="px-6 py-4">Categoría Padre</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm text-zinc-700">
                {categoryTree.map((category) => {
                  const parentName = category.parent
                    ? categoryMap[category.parent]
                    : null;
                  const isSubcategory = category.depth > 0;

                  return (
                    <tr
                      key={category.id}
                      className={`hover:bg-zinc-50/50 transition-colors ${
                        isSubcategory ? "bg-zinc-50/20" : ""
                      }`}
                    >
                      {/* Nombre con sangría según jerarquía */}
                      <td className="px-6 py-4">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${category.depth * 24}px` }}
                        >
                          {isSubcategory ? (
                            <CornerDownRight className="w-4 h-4 text-zinc-400 shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
                          )}
                          <span
                            className={`font-semibold ${
                              isSubcategory
                                ? "text-zinc-800"
                                : "text-zinc-950 font-bold"
                            }`}
                          >
                            {category.name}
                          </span>
                        </div>
                      </td>

                      {/* Categoría Padre */}
                      <td className="px-6 py-4">
                        {parentName ? (
                          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 border border-zinc-200 px-2.5 py-0.5 rounded-full text-xs font-medium">
                            <Layers className="w-3 h-3 text-zinc-400" />
                            {parentName}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 font-medium italic">
                            Categoría Principal
                          </span>
                        )}
                      </td>

                      {/* Slug */}
                      <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                        {category.slug}
                      </td>

                      {/* Descripción */}
                      <td className="px-6 py-4 text-zinc-500 max-w-xs truncate">
                        {category.description || "Sin descripción"}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(category)}
                            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(category.id, category.name)
                            }
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Formulario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-zinc-900 text-lg">
                {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 hover:rotate-90 transition-all p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Laptops, Audio, Postres Fríos..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                />
              </div>

              {/* Selector de Categoría Padre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Categoría Padre (Opcional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all bg-white"
                >
                  <option value="">Ninguna (Es Categoría Principal)</option>
                  {validParentOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {"— ".repeat(cat.depth)}
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400 font-medium">
                  Si seleccionas una categoría padre, esta se convertirá en una subcategoría.
                </p>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre esta sección del catálogo..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm resize-none transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-400 text-xs font-semibold text-zinc-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingCategory ? "Guardar Cambios" : "Crear Categoría"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
