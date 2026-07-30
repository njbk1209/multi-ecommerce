import React, { useState, useEffect } from 'react'
import { Car, X, ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react'
import { supabase } from '../utils/supabase'

export default function VehicleFilterSelector({
  vehicleFilter = { marcaId: '', modeloId: '', generacionId: '' },
  onChange,
  onClear,
  compact = false
}) {
  const [marcas, setMarcas] = useState([])
  const [modelos, setModelos] = useState([])
  const [generaciones, setGeneraciones] = useState([])
  const [loading, setLoading] = useState(true)

  // Cargar catálogos de vehículos
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true)
        const { data: marData } = await supabase.from('vehiculo_marca').select('*').order('nombre')
        const { data: modData } = await supabase.from('vehiculo_modelo').select('*, vehiculo_marca(*)').order('nombre')
        const { data: genData } = await supabase.from('vehiculo_generacion').select('*, vehiculo_modelo(*, vehiculo_marca(*))').order('id', { ascending: false })

        setMarcas(marData || [])
        setModelos(modData || [])
        setGeneraciones(genData || [])
      } catch (err) {
        console.error('Error cargando catálogo de vehículos para filtros:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVehicles()
  }, [])

  const handleMarcaChange = (e) => {
    const marcaId = e.target.value
    onChange({
      marcaId,
      modeloId: '',
      generacionId: ''
    })
  }

  const handleModeloChange = (e) => {
    const modeloId = e.target.value
    onChange({
      marcaId: vehicleFilter.marcaId,
      modeloId,
      generacionId: ''
    })
  }

  const handleGeneracionChange = (e) => {
    const generacionId = e.target.value
    const targetGen = generaciones.find(g => g.id.toString() === generacionId.toString())
    onChange({
      marcaId: targetGen?.vehiculo_modelo?.marca_id?.toString() || vehicleFilter.marcaId,
      modeloId: targetGen?.modelo_id?.toString() || vehicleFilter.modeloId,
      generacionId
    })
  }

  const selectedMarca = marcas.find(m => m.id.toString() === vehicleFilter.marcaId?.toString())
  const selectedModelo = modelos.find(m => m.id.toString() === vehicleFilter.modeloId?.toString())
  const selectedGen = generaciones.find(g => g.id.toString() === vehicleFilter.generacionId?.toString())

  const availableModelos = modelos.filter(m => !vehicleFilter.marcaId || m.marca_id.toString() === vehicleFilter.marcaId.toString())
  const availableGeneraciones = generaciones.filter(g => !vehicleFilter.modeloId || g.modelo_id.toString() === vehicleFilter.modeloId.toString())

  const hasActiveFilter = !!(vehicleFilter.marcaId || vehicleFilter.modeloId || vehicleFilter.generacionId)

  return (
    <div className={`bg-zinc-950 text-white rounded-2xl border border-zinc-800 shadow-xl overflow-hidden ${compact ? 'p-4' : 'p-5'}`}>
      
      {/* Encabezado del Filtro de Vehículo */}
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-zinc-800 text-zinc-100 shrink-0">
            <Car className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-serif font-bold text-white tracking-wide">
              Buscador por Vehículo (Fitment)
            </h3>
            <p className="text-[11px] text-zinc-400 font-medium">
              Selecciona tu coche para filtrar repuestos compatibles
            </p>
          </div>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 px-2.5 py-1 rounded-lg transition-all"
            title="Limpiar filtro de vehículo"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Selectores Cascada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* 1. MARCA */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            1. Marca
          </label>
          <select
            value={vehicleFilter.marcaId || ''}
            onChange={handleMarcaChange}
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-white outline-none transition-all cursor-pointer disabled:opacity-50"
          >
            <option value="">-- Marca de Vehículo --</option>
            {marcas.map(m => (
              <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                {m.nombre} ({m.tipo})
              </option>
            ))}
          </select>
        </div>

        {/* 2. MODELO */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            2. Modelo
          </label>
          <select
            value={vehicleFilter.modeloId || ''}
            onChange={handleModeloChange}
            disabled={loading || !vehicleFilter.marcaId}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-white outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">-- Modelo --</option>
            {availableModelos.map(m => (
              <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* 3. VARIANTE (AÑO + MOTOR) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            3. Versión / Variante (Año - Motor)
          </label>
          <select
            value={vehicleFilter.generacionId || ''}
            onChange={handleGeneracionChange}
            disabled={loading || !vehicleFilter.modeloId}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-white outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">-- Año / Motor (Generación) --</option>
            {availableGeneraciones.map(g => (
              <option key={g.id} value={g.id} className="bg-zinc-900 text-white">
                {g.nombre} ({g.anio_inicio} - {g.anio_fin === 2099 ? 'Presente' : g.anio_fin}) {g.motor ? `| ${g.motor}` : ''}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Badge del vehículo activo */}
      {hasActiveFilter && (
        <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 bg-emerald-950/30 border border-emerald-800/40 px-3.5 py-2 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Filtrando para:{' '}
              <strong className="text-white font-bold">
                {selectedMarca?.nombre} {selectedModelo?.nombre} {selectedGen ? `— ${selectedGen.nombre} (${selectedGen.anio_inicio}-${selectedGen.anio_fin === 2099 ? 'Pres' : selectedGen.anio_fin})` : ''} {selectedGen?.motor ? `[${selectedGen.motor}]` : ''}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="text-emerald-400 hover:text-white underline text-[11px] font-semibold cursor-pointer"
          >
            Quitar filtro
          </button>
        </div>
      )}

    </div>
  )
}
