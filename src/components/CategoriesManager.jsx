import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, Loader2, Folder } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'
import toast from 'react-hot-toast'

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Reemplaza espacios por -
    .replace(/[^\w\-]+/g, '')       // Elimina caracteres no alfanuméricos
    .replace(/\-\-+/g, '-')         // Reemplaza múltiples - por uno solo
    .replace(/^-+/, '')             // Quita - del inicio
    .replace(/-+$/, '')             // Quita - del final
}

export default function CategoriesManager() {
  const { store } = useCurrency()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  
  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchCategories = async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('category')
        .select('*')
        .eq('store', store.id)
        .order('name', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      console.error('Error al cargar categorías:', err)
      toast.error('No se pudieron cargar las categorías.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [store?.id])

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setName('')
    setDescription('')
    setModalOpen(true)
  }

  const handleOpenEdit = (category) => {
    setEditingCategory(category)
    setName(category.name)
    setDescription(category.description || '')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre de la categoría es obligatorio.')
      return
    }

    setSubmitting(true)
    const slug = slugify(name)

    try {
      if (editingCategory) {
        // Actualizar
        const { error } = await supabase
          .from('category')
          .update({
            name: name.trim(),
            slug,
            description: description.trim()
          })
          .eq('id', editingCategory.id)

        if (error) throw error
        toast.success('Categoría actualizada con éxito.')
      } else {
        // Crear
        const { error } = await supabase
          .from('category')
          .insert({
            store: store.id,
            name: name.trim(),
            slug,
            description: description.trim()
          })

        if (error) throw error
        toast.success('Categoría creada con éxito.')
      }
      setModalOpen(false)
      fetchCategories()
    } catch (err) {
      console.error('Error al guardar categoría:', err)
      toast.error('Ocurrió un error al guardar la categoría.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (categoryId, categoryName) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoryName}"?\nNota: Los productos asociados a esta categoría podrían perder su relación.`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('category')
        .delete()
        .eq('id', categoryId)

      if (error) throw error
      toast.success('Categoría eliminada correctamente.')
      fetchCategories()
    } catch (err) {
      console.error('Error al eliminar categoría:', err)
      toast.error('No se pudo eliminar la categoría. Asegúrate de que no esté siendo usada.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif font-semibold text-zinc-950">Categorías de la Tienda</h2>
          <p className="text-xs text-zinc-400 font-medium">Administra las secciones del menú para clasificar tus productos.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Cargando categorías...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-16 text-center space-y-3">
          <Folder className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">No has creado categorías en esta tienda todavía.</p>
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
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm text-zinc-700">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-900">{category.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">{category.slug}</td>
                    <td className="px-6 py-4 text-zinc-500 max-w-xs truncate">{category.description || 'Sin descripción'}</td>
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
                          onClick={() => handleDelete(category.id, category.name)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 hover:rotate-90 transition-all p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre de la Categoría</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Postres Fríos, Cafetería..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción (Opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre esta sección del menú..."
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
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
