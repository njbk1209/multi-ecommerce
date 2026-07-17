import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, Loader2, Settings, HelpCircle, Check, Info } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'
import toast from 'react-hot-toast'

export default function OptionsManager() {
  const { store } = useCurrency()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields
  const [nombre, setNombre] = useState('')
  const [esObligatorio, setEsObligatorio] = useState(false)
  const [esMultiple, setEsMultiple] = useState(false)
  const [valores, setValores] = useState([{ nombre: '', modificador_precio: '0', modificador_precio_comparacion: '' }])

  const fetchGroups = async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('producto_opciones_grupo')
        .select(`
          *,
          producto_opciones_valor(*)
        `)
        .eq('store', store.id)
        .order('nombre', { ascending: true })

      if (error) throw error
      setGroups(data || [])
    } catch (err) {
      console.error('Error al cargar grupos:', err)
      toast.error('No se pudieron cargar los grupos de opciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [store?.id])

  const handleOpenCreate = () => {
    setEditingGroup(null)
    setNombre('')
    setEsObligatorio(false)
    setEsMultiple(false)
    setValores([{ nombre: '', modificador_precio: '0', modificador_precio_comparacion: '' }])
    setModalOpen(true)
  }

  const handleOpenEdit = (group) => {
    setEditingGroup(group)
    setNombre(group.nombre)
    setEsObligatorio(group.es_obligatorio)
    setEsMultiple(group.es_multiple)
    
    if (group.producto_opciones_valor && group.producto_opciones_valor.length > 0) {
      setValores(group.producto_opciones_valor.map(v => ({
        id: v.id,
        nombre: v.nombre,
        modificador_precio: v.modificador_precio.toString(),
        modificador_precio_comparacion: v.modificador_precio_comparacion ? v.modificador_precio_comparacion.toString() : ''
      })))
    } else {
      setValores([{ nombre: '', modificador_precio: '0', modificador_precio_comparacion: '' }])
    }
    setModalOpen(true)
  }

  const handleAddValueRow = () => {
    setValores([...valores, { nombre: '', modificador_precio: '0', modificador_precio_comparacion: '' }])
  }

  const handleRemoveValueRow = (index) => {
    const newValues = valores.filter((_, i) => i !== index)
    setValores(newValues.length > 0 ? newValues : [{ nombre: '', modificador_precio: '0', modificador_precio_comparacion: '' }])
  }

  const handleValueChange = (index, field, value) => {
    const newValues = [...valores]
    newValues[index][field] = value
    setValores(newValues)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) {
      toast.error('El nombre del grupo es obligatorio.')
      return
    }

    // Filtrar valores vacíos
    const activeValues = valores.filter(v => v.nombre.trim() !== '')
    if (activeValues.length === 0) {
      toast.error('Debes añadir al menos una opción con nombre.')
      return
    }

    setSubmitting(true)

    try {
      const groupPayload = {
        store: store.id,
        nombre: nombre.trim(),
        es_obligatorio: esObligatorio,
        es_multiple: esMultiple
      }

      let groupId

      if (editingGroup) {
        // 1. Actualizar grupo
        const { error: groupError } = await supabase
          .from('producto_opciones_grupo')
          .update(groupPayload)
          .eq('id', editingGroup.id)

        if (groupError) throw groupError
        groupId = editingGroup.id
      } else {
        // 2. Crear grupo nuevo
        const { data: newGroup, error: groupError } = await supabase
          .from('producto_opciones_grupo')
          .insert(groupPayload)
          .select('id')
          .single()

        if (groupError) throw groupError
        groupId = newGroup.id
      }

      // 3. Sincronizar valores (Borrar anteriores y reinsertar)
      const { error: deleteError } = await supabase
        .from('producto_opciones_valor')
        .delete()
        .eq('grupo', groupId)

      if (deleteError) throw deleteError

      const valuesPayload = activeValues.map(v => ({
        grupo: groupId,
        nombre: v.nombre.trim(),
        modificador_precio: parseFloat(v.modificador_precio) || 0,
        modificador_precio_comparacion: v.modificador_precio_comparacion ? parseFloat(v.modificador_precio_comparacion) : null
      }))

      const { error: insertError } = await supabase
        .from('producto_opciones_valor')
        .insert(valuesPayload)

      if (insertError) throw insertError

      toast.success(editingGroup ? 'Grupo de opciones actualizado.' : 'Grupo de opciones creado.')
      setModalOpen(false)
      fetchGroups()
    } catch (err) {
      console.error('Error al guardar opciones:', err)
      toast.error('Error al guardar el grupo de opciones.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el grupo "${name}"? Se desvinculará de todos los productos.`)) return
    try {
      // Las relaciones en cascada borrarán automáticamente los valores y referencias
      const { error } = await supabase
        .from('producto_opciones_grupo')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Grupo de opciones eliminado.')
      fetchGroups()
    } catch (err) {
      console.error('Error al eliminar grupo:', err)
      toast.error('No se pudo eliminar el grupo de opciones.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-semibold text-zinc-900">Variaciones y Modificadores</h2>
          <p className="text-xs font-medium text-zinc-450 mt-1">
            Administra grupos de opciones (ej. Sabores, Tamaños, Coberturas) y sus respectivos costos adicionales.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4.5 py-3 rounded-xl transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Grupo de Opciones
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          <p className="text-xs font-semibold text-zinc-400">Cargando grupos de opciones...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-zinc-200 rounded-2xl py-16 px-6 text-center bg-zinc-50/20">
          <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-150 flex items-center justify-center mx-auto mb-3">
            <Settings className="w-5 h-5 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-800 text-sm">No hay grupos creados</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
            Añade modificadores para que tus clientes personalicen sus pedidos con diferentes acompañantes, tamaños o sabores.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            Crear primer grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.id} className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm hover:shadow-md/5 transition-all p-5 flex flex-col justify-between">
              
              <div>
                {/* Título y Estado */}
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-serif font-semibold text-zinc-900 text-base">{group.nombre}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        group.es_obligatorio 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}>
                        {group.es_obligatorio ? 'Obligatorio' : 'Opcional'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-50 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded">
                        {group.es_multiple ? 'Selección Múltiple' : 'Selección Única'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(group)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50 border border-transparent hover:border-zinc-150 rounded-lg transition-all"
                      title="Editar grupo y valores"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id, group.nombre)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50/50 rounded-lg transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Listado de Valores */}
                <div className="mt-4.5 border-t border-zinc-100 pt-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Opciones Disponibles</span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {group.producto_opciones_valor?.map((val) => (
                      <div key={val.id} className="flex justify-between items-center bg-zinc-50/70 border border-zinc-100/60 rounded-xl px-3.5 py-2 text-xs">
                        <span className="font-semibold text-zinc-700">{val.nombre}</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-zinc-800">
                            {val.modificador_precio > 0 ? `+$${val.modificador_precio.toFixed(2)}` : 'Gratis'}
                          </span>
                          {val.modificador_precio_comparacion && (
                            <span className="text-[10px] text-zinc-400 line-through">
                              ${val.modificador_precio_comparacion.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-zinc-400 shrink-0" />
                  {group.producto_opciones_valor?.length || 0} variaciones
                </span>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal Formulario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-xl my-8 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-serif font-semibold text-zinc-900 text-lg">
                {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo de Opciones'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 hover:rotate-90 transition-all p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Formulario */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre del Grupo</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Coberturas Adicionales, Tipo de Masa"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 bg-zinc-50/50 hover:bg-zinc-50 p-4 border border-zinc-100 rounded-xl cursor-pointer select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={esObligatorio}
                    onChange={(e) => setEsObligatorio(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 block">Es Obligatorio</span>
                    <span className="text-[10px] text-zinc-400 font-medium">El cliente debe elegir al menos una opción</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-zinc-50/50 hover:bg-zinc-50 p-4 border border-zinc-100 rounded-xl cursor-pointer select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={esMultiple}
                    onChange={(e) => setEsMultiple(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 block">Selección Múltiple</span>
                    <span className="text-[10px] text-zinc-400 font-medium">Permite seleccionar varias opciones juntas</span>
                  </div>
                </label>
              </div>

              {/* Valores / Opciones */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Valores y Modificadores de Precio</label>
                  <button
                    type="button"
                    onClick={handleAddValueRow}
                    className="text-xs text-zinc-900 hover:text-zinc-600 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Opción
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {valores.map((val, index) => (
                    <div key={index} className="flex gap-2.5 items-end bg-zinc-50/30 p-3 rounded-xl border border-zinc-100">
                      
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-450">Opción</label>
                        <input
                          type="text"
                          required
                          value={val.nombre}
                          onChange={(e) => handleValueChange(index, 'nombre', e.target.value)}
                          placeholder="Ej. Fresa, Chocolate"
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs bg-white transition-all"
                        />
                      </div>

                      <div className="w-24 sm:w-28 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-450">Precio Extra ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={val.modificador_precio}
                          onChange={(e) => handleValueChange(index, 'modificador_precio', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs bg-white text-right font-mono transition-all"
                        />
                      </div>

                      <div className="w-24 sm:w-28 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-455">Comparar ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={val.modificador_precio_comparacion}
                          onChange={(e) => handleValueChange(index, 'modificador_precio_comparacion', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs bg-white text-right font-mono transition-all"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveValueRow(index)}
                        disabled={valores.length === 1 && !val.nombre}
                        className="p-2 bg-white text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-zinc-200 rounded-lg transition-colors shrink-0 disabled:opacity-30 disabled:hover:bg-white"
                        title="Quitar opción"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3 shrink-0">
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
                  {editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
