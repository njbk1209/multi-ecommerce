import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, Loader2, Car, Search, Calendar, ChevronRight, Layers, ShieldCheck } from 'lucide-react'
import { supabase } from '../utils/supabase'
import toast from 'react-hot-toast'

export default function VehiclesManager() {
  const [activeTab, setActiveTab] = useState('marcas') // 'marcas' | 'modelos' | 'generaciones'
  const [loading, setLoading] = useState(true)

  // Listas de datos
  const [marcas, setMarcas] = useState([])
  const [modelos, setModelos] = useState([])
  const [generaciones, setGeneraciones] = useState([])

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMarcaFilter, setSelectedMarcaFilter] = useState('')
  const [selectedModeloFilter, setSelectedModeloFilter] = useState('')

  // Modales
  const [modalType, setModalType] = useState(null) // 'marca' | 'modelo' | 'generacion' | null
  const [editingItem, setEditingItem] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Campos de formulario - Marca
  const [marcaNombre, setMarcaNombre] = useState('')
  const [marcaTipo, setMarcaTipo] = useState('auto')
  const [marcaLogoUrl, setMarcaLogoUrl] = useState('')

  // Campos de formulario - Modelo
  const [modeloMarcaId, setModeloMarcaId] = useState('')
  const [modeloNombre, setModeloNombre] = useState('')

  // Campos de formulario - Generación
  const [genModeloId, setGenModeloId] = useState('')
  const [genNombre, setGenNombre] = useState('')
  const [genMotor, setGenMotor] = useState('')
  const [genAnioInicio, setGenAnioInicio] = useState(new Date().getFullYear())
  const [genAnioFin, setGenAnioFin] = useState(2099)
  const [genEsPresente, setGenEsPresente] = useState(true)

  // Cargar datos principales
  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Cargar marcas
      const { data: marData, error: marErr } = await supabase
        .from('vehiculo_marca')
        .select('*')
        .order('nombre', { ascending: true })
      if (marErr) throw marErr
      setMarcas(marData || [])

      // 2. Cargar modelos con marca asociada
      const { data: modData, error: modErr } = await supabase
        .from('vehiculo_modelo')
        .select('*, vehiculo_marca(*)')
        .order('nombre', { ascending: true })
      if (modErr) throw modErr
      setModelos(modData || [])

      // 3. Cargar generaciones con modelo y marca asociada
      const { data: genData, error: genErr } = await supabase
        .from('vehiculo_generacion')
        .select('*, vehiculo_modelo(*, vehiculo_marca(*))')
        .order('anio_inicio', { ascending: false })
      if (genErr) throw genErr
      setGeneraciones(genData || [])

    } catch (err) {
      console.error('Error al cargar catálogo de vehículos:', err)
      toast.error('No se pudieron cargar los datos de vehículos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Limpiar campos al abrir modal
  const handleOpenModal = (type, item = null) => {
    setModalType(type)
    setEditingItem(item)

    if (type === 'marca') {
      setMarcaNombre(item?.nombre || '')
      setMarcaTipo(item?.tipo || 'auto')
      setMarcaLogoUrl(item?.logo_url || '')
    } else if (type === 'modelo') {
      setModeloMarcaId(item?.marca_id ? item.marca_id.toString() : (marcas[0]?.id ? marcas[0].id.toString() : ''))
      setModeloNombre(item?.nombre || '')
    } else if (type === 'generacion') {
      setGenModeloId(item?.modelo_id ? item.modelo_id.toString() : (modelos[0]?.id ? modelos[0].id.toString() : ''))
      setGenNombre(item?.nombre || '')
      setGenMotor(item?.motor || '')
      setGenAnioInicio(item?.anio_inicio || 2008)
      const isPres = !item || item.anio_fin === 2099
      setGenEsPresente(isPres)
      setGenAnioFin(isPres ? 2099 : (item?.anio_fin || new Date().getFullYear()))
    }
  }

  // Guardar Marca
  const handleSaveMarca = async (e) => {
    e.preventDefault()
    if (!marcaNombre.trim()) {
      toast.error('El nombre de la marca es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        nombre: marcaNombre.trim(),
        tipo: marcaTipo,
        logo_url: marcaLogoUrl.trim() || null
      }

      if (editingItem) {
        const { error } = await supabase
          .from('vehiculo_marca')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
        toast.success('Marca actualizada correctamente.')
      } else {
        const { error } = await supabase
          .from('vehiculo_marca')
          .insert(payload)
        if (error) throw error
        toast.success('Marca creada con éxito.')
      }

      setModalType(null)
      fetchData()
    } catch (err) {
      console.error('Error al guardar marca:', err)
      toast.error(err.message?.includes('duplicate') ? 'Ya existe una marca con ese nombre.' : 'Ocurrió un error al guardar la marca.')
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Modelo
  const handleSaveModelo = async (e) => {
    e.preventDefault()
    if (!modeloMarcaId) {
      toast.error('Debes seleccionar una marca.')
      return
    }
    if (!modeloNombre.trim()) {
      toast.error('El nombre del modelo es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        marca_id: parseInt(modeloMarcaId),
        nombre: modeloNombre.trim()
      }

      if (editingItem) {
        const { error } = await supabase
          .from('vehiculo_modelo')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
        toast.success('Modelo actualizado correctamente.')
      } else {
        const { error } = await supabase
          .from('vehiculo_modelo')
          .insert(payload)
        if (error) throw error
        toast.success('Modelo creado con éxito.')
      }

      setModalType(null)
      fetchData()
    } catch (err) {
      console.error('Error al guardar modelo:', err)
      toast.error(err.message?.includes('duplicate') ? 'Este modelo ya existe para esta marca.' : 'Ocurrió un error al guardar el modelo.')
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Generación
  const handleSaveGeneracion = async (e) => {
    e.preventDefault()
    if (!genModeloId) {
      toast.error('Debes seleccionar un modelo.')
      return
    }
    if (!genNombre.trim()) {
      toast.error('El nombre de la generación es obligatorio.')
      return
    }
    const finalAnioFin = genEsPresente ? 2099 : parseInt(genAnioFin)
    if (parseInt(genAnioInicio) > finalAnioFin) {
      toast.error('El año de inicio no puede ser mayor al año de fin.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        modelo_id: parseInt(genModeloId),
        nombre: genNombre.trim(),
        motor: genMotor.trim() || null,
        anio_inicio: parseInt(genAnioInicio),
        anio_fin: finalAnioFin
      }

      if (editingItem) {
        const { error } = await supabase
          .from('vehiculo_generacion')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
        toast.success('Generación actualizada correctamente.')
      } else {
        const { error } = await supabase
          .from('vehiculo_generacion')
          .insert(payload)
        if (error) throw error
        toast.success('Generación creada con éxito.')
      }

      setModalType(null)
      fetchData()
    } catch (err) {
      console.error('Error al guardar generación:', err)
      toast.error('Ocurrió un error al guardar la generación.')
    } finally {
      setSubmitting(false)
    }
  }

  // Eliminar elemento
  const handleDelete = async (table, id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${name}"?`)) return
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      toast.success('Registro eliminado correctamente.')
      fetchData()
    } catch (err) {
      console.error('Error al eliminar:', err)
      toast.error('No se pudo eliminar el registro. Verifica que no tenga modelos o compatibilidades asociadas.')
    }
  }

  // Filtrado de Marcas
  const filteredMarcas = marcas.filter(m =>
    m.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filtrado de Modelos
  const filteredModelos = modelos.filter(m => {
    const matchesSearch = m.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.vehiculo_marca?.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMarca = !selectedMarcaFilter || m.marca_id.toString() === selectedMarcaFilter
    return matchesSearch && matchesMarca
  })

  // Filtrado de Generaciones
  const filteredGeneraciones = generaciones.filter(g => {
    const matchesSearch = g.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.vehiculo_modelo?.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.vehiculo_modelo?.vehiculo_marca?.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesModelo = !selectedModeloFilter || g.modelo_id.toString() === selectedModeloFilter
    return matchesSearch && matchesModelo
  })

  return (
    <div className="space-y-6">
      
      {/* Encabezado y Selector de Sub-pestañas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-semibold text-zinc-950 flex items-center gap-2">
            <Car className="w-5 h-5 text-zinc-700" />
            Catálogo de Vehículos
          </h2>
          <p className="text-xs text-zinc-400 font-medium">Administra las marcas, modelos y generaciones para la compatibilidad de repuestos.</p>
        </div>

        {/* Botón de Creación Dinámico */}
        <button
          onClick={() => handleOpenModal(activeTab === 'marcas' ? 'marca' : activeTab === 'modelos' ? 'modelo' : 'generacion')}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'marcas' ? 'Nueva Marca' : activeTab === 'modelos' ? 'Nuevo Modelo' : 'Nueva Generación'}
        </button>
      </div>

      {/* Tabs Internas */}
      <div className="flex border-b border-zinc-200 gap-6">
        <button
          onClick={() => { setActiveTab('marcas'); setSearchQuery(''); }}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'marcas' ? 'border-zinc-950 text-zinc-950 font-bold' : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Marcas ({marcas.length})
        </button>

        <button
          onClick={() => { setActiveTab('modelos'); setSearchQuery(''); }}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'modelos' ? 'border-zinc-950 text-zinc-950 font-bold' : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Car className="w-4 h-4" />
          Modelos ({modelos.length})
        </button>

        <button
          onClick={() => { setActiveTab('generaciones'); setSearchQuery(''); }}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'generaciones' ? 'border-zinc-950 text-zinc-950 font-bold' : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          Generaciones ({generaciones.length})
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-xs bg-white"
          />
        </div>

        {activeTab === 'modelos' && (
          <select
            value={selectedMarcaFilter}
            onChange={(e) => setSelectedMarcaFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 outline-none text-xs bg-white font-medium"
          >
            <option value="">Todas las marcas</option>
            {marcas.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        )}

        {activeTab === 'generaciones' && (
          <select
            value={selectedModeloFilter}
            onChange={(e) => setSelectedModeloFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 outline-none text-xs bg-white font-medium"
          >
            <option value="">Todos los modelos</option>
            {modelos.map(mod => (
              <option key={mod.id} value={mod.id}>{mod.vehiculo_marca?.nombre} - {mod.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Cargando */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Cargando catálogo de vehículos...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: MARCAS */}
          {activeTab === 'marcas' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-4">Marca</th>
                    <th className="px-6 py-4">Tipo de Vehículo</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredMarcas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400 font-medium">
                        No se encontraron marcas registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredMarcas.map((marca) => (
                      <tr key={marca.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-zinc-900 flex items-center gap-3">
                          {marca.logo_url ? (
                            <img src={marca.logo_url} alt={marca.nombre} className="w-6 h-6 object-contain shrink-0" />
                          ) : (
                            <ShieldCheck className="w-5 h-5 text-zinc-400 shrink-0" />
                          )}
                          <span>{marca.nombre}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            marca.tipo === 'auto' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            marca.tipo === 'moto' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            marca.tipo === 'camion' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            'bg-zinc-100 text-zinc-700 border border-zinc-200'
                          }`}>
                            {marca.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal('marca', marca)}
                              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('vehiculo_marca', marca.id, marca.nombre)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: MODELOS */}
          {activeTab === 'modelos' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-4">Modelo</th>
                    <th className="px-6 py-4">Marca</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredModelos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400 font-medium">
                        No se encontraron modelos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredModelos.map((mod) => (
                      <tr key={mod.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-zinc-900 flex items-center gap-2">
                          <Car className="w-4 h-4 text-zinc-400" />
                          <span>{mod.nombre}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-700">
                          {mod.vehiculo_marca?.nombre || 'Sin Marca'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal('modelo', mod)}
                              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('vehiculo_modelo', mod.id, mod.nombre)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: GENERACIONES */}
          {activeTab === 'generaciones' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-4">Generación / Versión</th>
                    <th className="px-6 py-4">Vehículo</th>
                    <th className="px-6 py-4">Motor</th>
                    <th className="px-6 py-4">Rango de Años</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredGeneraciones.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-medium">
                        No se encontraron generaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredGeneraciones.map((gen) => (
                      <tr key={gen.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-zinc-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-zinc-400" />
                          <span>{gen.nombre}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-700">
                          {gen.vehiculo_modelo?.vehiculo_marca?.nombre} {gen.vehiculo_modelo?.nombre}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-600">
                          {gen.motor ? (
                            <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-zinc-200">
                              {gen.motor}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-emerald-700">
                          {gen.anio_inicio} — {gen.anio_fin === 2099 ? 'Presente' : gen.anio_fin}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal('generacion', gen)}
                              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('vehiculo_generacion', gen.id, gen.nombre)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modales Formulario */}

      {/* Modal MARCA */}
      {modalType === 'marca' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-zinc-900 text-base">
                {editingItem ? 'Editar Marca' : 'Nueva Marca de Vehículo'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMarca} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre de la Marca *</label>
                <input
                  type="text"
                  required
                  value={marcaNombre}
                  onChange={(e) => setMarcaNombre(e.target.value)}
                  placeholder="Ej. Toyota, Chevrolet, Yamaha..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tipo de Vehículo *</label>
                <select
                  value={marcaTipo}
                  onChange={(e) => setMarcaTipo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm bg-white font-medium"
                >
                  <option value="auto">Auto / Camioneta</option>
                  <option value="moto">Moto</option>
                  <option value="camion">Camión / Pesado</option>
                  <option value="universal">Universal / Multimarcha</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">URL del Logo (Opcional)</label>
                <input
                  type="url"
                  value={marcaLogoUrl}
                  onChange={(e) => setMarcaLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItem ? 'Guardar Cambios' : 'Crear Marca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal MODELO */}
      {modalType === 'modelo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-zinc-900 text-base">
                {editingItem ? 'Editar Modelo' : 'Nuevo Modelo de Vehículo'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModelo} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Marca Perteneciente *</label>
                <select
                  required
                  value={modeloMarcaId}
                  onChange={(e) => setModeloMarcaId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm bg-white font-semibold"
                >
                  {marcas.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre del Modelo *</label>
                <input
                  type="text"
                  required
                  value={modeloNombre}
                  onChange={(e) => setModeloNombre(e.target.value)}
                  placeholder="Ej. Corolla, Aveo, Ka, DT175..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-semibold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItem ? 'Guardar Cambios' : 'Crear Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal GENERACIÓN */}
      {modalType === 'generacion' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-zinc-900 text-base">
                {editingItem ? 'Editar Generación' : 'Nueva Generación / Versión'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGeneracion} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Modelo *</label>
                <select
                  required
                  value={genModeloId}
                  onChange={(e) => setGenModeloId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm bg-white font-semibold"
                >
                  {modelos.map(m => (
                    <option key={m.id} value={m.id}>{m.vehiculo_marca?.nombre} - {m.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre de la Generación *</label>
                <input
                  type="text"
                  required
                  value={genNombre}
                  onChange={(e) => setGenNombre(e.target.value)}
                  placeholder="Ej. 2da Generación / Fly (2008-2014)"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Motor / Especificación de Motor (Opcional)</label>
                <input
                  type="text"
                  value={genMotor}
                  onChange={(e) => setGenMotor(e.target.value)}
                  placeholder="Ej. 1.6L Zetec Rocam / 2.0L / 150cc 4T"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Año Inicio *</label>
                  <input
                    type="number"
                    required
                    value={genAnioInicio}
                    onChange={(e) => setGenAnioInicio(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Año Fin</label>
                  <input
                    type="number"
                    disabled={genEsPresente}
                    value={genEsPresente ? '' : genAnioFin}
                    onChange={(e) => setGenAnioFin(e.target.value)}
                    placeholder={genEsPresente ? 'Presente' : '2014'}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm font-mono font-bold disabled:bg-zinc-100 disabled:text-zinc-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gen-presente-check"
                  checked={genEsPresente}
                  onChange={(e) => setGenEsPresente(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
                />
                <label htmlFor="gen-presente-check" className="text-xs font-semibold text-zinc-700 cursor-pointer">
                  Aplica hasta la actualidad / Presente
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:border-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItem ? 'Guardar Cambios' : 'Crear Generación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
