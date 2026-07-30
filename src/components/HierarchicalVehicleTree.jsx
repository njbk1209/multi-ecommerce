import React, { useState, useEffect } from 'react'
import { Car, ChevronRight, ChevronDown, Check, RotateCcw, ShieldCheck, Layers } from 'lucide-react'
import { supabase } from '../utils/supabase'

export default function HierarchicalVehicleTree({
  vehicleFilter = { marcaId: '', modeloId: '', generacionId: '' },
  onChange,
  onClear,
}) {
  const [marcasTree, setMarcasTree] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados de expansión (carpetas desplegables)
  const [expandedMarcas, setExpandedMarcas] = useState({})
  const [expandedModelos, setExpandedModelos] = useState({})

  useEffect(() => {
    const fetchTreeData = async () => {
      try {
        setLoading(true)
        const { data: marData } = await supabase.from('vehiculo_marca').select('*').order('nombre')
        const { data: modData } = await supabase.from('vehiculo_modelo').select('*').order('nombre')
        const { data: genData } = await supabase.from('vehiculo_generacion').select('*').order('id', { ascending: false })

        // Armar árbol jerárquico Marcas -> Modelos -> Generaciones
        const tree = (marData || []).map(marca => {
          const modOfMarca = (modData || [])
            .filter(m => m.marca_id === marca.id)
            .map(modelo => {
              const genOfModelo = (genData || []).filter(g => g.modelo_id === modelo.id)
              return {
                ...modelo,
                generaciones: genOfModelo
              }
            })

          return {
            ...marca,
            modelos: modOfMarca
          }
        })

        setMarcasTree(tree)

        // Si ya hay un filtro activo, auto-expandir la marca y modelo correspondientes
        if (vehicleFilter.marcaId) {
          setExpandedMarcas(prev => ({ ...prev, [vehicleFilter.marcaId]: true }))
        }
        if (vehicleFilter.modeloId) {
          setExpandedModelos(prev => ({ ...prev, [vehicleFilter.modeloId]: true }))
        }
      } catch (err) {
        console.error('Error al cargar árbol de vehículos:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTreeData()
  }, [])

  const toggleMarca = (marcaId, e) => {
    e.stopPropagation()
    setExpandedMarcas(prev => ({ ...prev, [marcaId]: !prev[marcaId] }))
  }

  const toggleModelo = (modeloId, e) => {
    e.stopPropagation()
    setExpandedModelos(prev => ({ ...prev, [modeloId]: !prev[modeloId] }))
  }

  const handleSelectMarca = (marcaId) => {
    if (vehicleFilter.marcaId === marcaId.toString() && !vehicleFilter.modeloId && !vehicleFilter.generacionId) {
      onClear()
    } else {
      onChange({
        marcaId: marcaId.toString(),
        modeloId: '',
        generacionId: ''
      })
      setExpandedMarcas(prev => ({ ...prev, [marcaId.toString()]: true }))
    }
  }

  const handleSelectModelo = (marcaId, modeloId) => {
    if (vehicleFilter.modeloId === modeloId.toString() && !vehicleFilter.generacionId) {
      onClear()
    } else {
      onChange({
        marcaId: marcaId.toString(),
        modeloId: modeloId.toString(),
        generacionId: ''
      })
      setExpandedMarcas(prev => ({ ...prev, [marcaId.toString()]: true }))
      setExpandedModelos(prev => ({ ...prev, [modeloId.toString()]: true }))
    }
  }

  const handleSelectGeneracion = (marcaId, modeloId, generacionId) => {
    if (vehicleFilter.generacionId === generacionId.toString()) {
      onClear()
    } else {
      onChange({
        marcaId: marcaId.toString(),
        modeloId: modeloId.toString(),
        generacionId: generacionId.toString()
      })
    }
  }

  const hasFilter = !!(vehicleFilter.marcaId || vehicleFilter.modeloId || vehicleFilter.generacionId)

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-dark">
          <Car className="w-4 h-4 text-primary" />
          Vehículos & Compatibilidad
        </h4>

        {hasFilter && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 italic">Cargando marcas y modelos...</p>
      ) : marcasTree.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin vehículos registrados</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1 custom-scrollbar text-xs">
          {marcasTree.map((marca) => {
            const isMarcaSelected = vehicleFilter.marcaId === marca.id.toString() && !vehicleFilter.modeloId && !vehicleFilter.generacionId
            const isMarcaExpanded = !!expandedMarcas[marca.id.toString()]
            const hasModelos = marca.modelos && marca.modelos.length > 0

            return (
              <div key={marca.id} className="space-y-1">
                {/* NIVEL 1: MARCA */}
                <div
                  className={`flex items-center justify-between py-1.5 rounded-lg cursor-pointer transition-all ${isMarcaSelected
                      ? 'bg-primary-light/20 text-primary-dark font-bold'
                      : 'hover:bg-gray-100 text-gray-800'
                    }`}
                >
                  <div
                    onClick={() => handleSelectMarca(marca.id)}
                    className="flex items-center gap-2 flex-1"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={vehicleFilter.marcaId === marca.id.toString()}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary-dark pointer-events-none transition-colors"
                    />
                    <span className="font-semibold text-xs">{marca.nombre}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-mono">({marca.tipo})</span>
                  </div>

                  {hasModelos && (
                    <button
                      type="button"
                      onClick={(e) => toggleMarca(marca.id.toString(), e)}
                      className="p-1 text-gray-400 hover:text-gray-700 transition-transform"
                    >
                      {isMarcaExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* NIVEL 2: MODELOS (Desplegables) */}
                {isMarcaExpanded && hasModelos && (
                  <div className="pl-4 space-y-1 border-l-2 border-gray-100 ml-3">
                    {marca.modelos.map((modelo) => {
                      const isModeloSelected = vehicleFilter.modeloId === modelo.id.toString() && !vehicleFilter.generacionId
                      const isModeloExpanded = !!expandedModelos[modelo.id.toString()]
                      const hasGeneraciones = modelo.generaciones && modelo.generaciones.length > 0

                      return (
                        <div key={modelo.id} className="space-y-1">
                          <div
                            className={`flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer transition-all ${isModeloSelected
                                ? 'bg-primary-light/20 text-primary-dark font-bold'
                                : 'hover:bg-gray-100 text-gray-700'
                              }`}
                          >
                            <div
                              onClick={() => handleSelectModelo(marca.id, modelo.id)}
                              className="flex items-center gap-2 flex-1"
                            >
                              <span className="text-gray-300 font-mono text-[10px]">↳</span>
                              <input
                                type="checkbox"
                                readOnly
                                checked={vehicleFilter.modeloId === modelo.id.toString()}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary-dark pointer-events-none transition-colors"
                              />
                              <span className="font-medium text-xs">{modelo.nombre}</span>
                            </div>

                            {hasGeneraciones && (
                              <button
                                type="button"
                                onClick={(e) => toggleModelo(modelo.id.toString(), e)}
                                className="p-0.5 text-gray-400 hover:text-gray-700"
                              >
                                {isModeloExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* NIVEL 3: VARIANTES / GENERACIONES (Desplegables) */}
                          {isModeloExpanded && hasGeneraciones && (
                            <div className="pl-4 space-y-1 border-l-2 border-gray-100 ml-3">
                              {modelo.generaciones.map((gen) => {
                                const isGenSelected = vehicleFilter.generacionId === gen.id.toString()

                                return (
                                  <div
                                    key={gen.id}
                                    onClick={() => handleSelectGeneracion(marca.id, modelo.id, gen.id)}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-all ${isGenSelected
                                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                                        : 'hover:bg-gray-100 text-gray-600'
                                      }`}
                                  >
                                    <span className="text-gray-300 font-mono text-[10px]">↳</span>
                                    <input
                                      type="checkbox"
                                      readOnly
                                      checked={isGenSelected}
                                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 pointer-events-none transition-colors"
                                    />
                                    <div className="flex flex-col text-[11px] leading-tight">
                                      <span className="font-semibold text-gray-800">{gen.nombre}</span>
                                      <span className="text-[10px] text-gray-500 font-mono">
                                        {gen.anio_inicio} - {gen.anio_fin === 2099 ? 'Pres' : gen.anio_fin} {gen.motor ? `| ${gen.motor}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
