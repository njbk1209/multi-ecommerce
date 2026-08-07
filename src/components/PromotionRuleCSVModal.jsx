import React, { useState } from 'react'
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Download,
  Tag,
  Layers,
} from 'lucide-react'
import { parsePromotionRulesCSV, downloadPromotionRulesCSVTemplate } from '../utils/csv'
import { supabase } from '../utils/supabase'
import toast from 'react-hot-toast'

export default function PromotionRuleCSVModal({
  isOpen,
  onClose = () => {},
  promotion,
  products = [],
  onImportSuccess = () => {},
}) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [parseError, setParseError] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  if (!isOpen || !promotion) return null

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return
    if (
      !selectedFile.name.endsWith('.csv') &&
      selectedFile.type !== 'text/csv' &&
      selectedFile.type !== 'application/vnd.ms-excel'
    ) {
      toast.error('Por favor, selecciona un archivo con extensión .csv')
      return
    }

    setFile(selectedFile)
    setParseError('')
    setLoading(true)

    // Consultar productos directamente de Supabase para asegurar datos frescos y completos
    let freshProducts = products
    try {
      let query = supabase.from('producto').select('*')
      if (promotion?.store_id) {
        query = query.eq('store', promotion.store_id)
      }
      const { data: dbProds, error: fetchErr } = await query
      if (!fetchErr && dbProds && dbProds.length > 0) {
        freshProducts = dbProds
      }
    } catch (e) {
      console.warn('Usando productos locales como respaldo:', e)
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const result = parsePromotionRulesCSV(text, freshProducts)
        setParsedData(result)
      } catch (err) {
        console.error('Error al procesar CSV de reglas:', err)
        setParseError(err.message || 'No se pudo procesar el archivo CSV.')
        setParsedData(null)
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = () => {
      setParseError('Error al leer el archivo desde el disco.')
      setLoading(false)
    }

    reader.readAsText(selectedFile, 'UTF-8')
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleConfirmImport = async () => {
    if (!parsedData || parsedData.summary.valid === 0) {
      toast.error('No hay reglas válidas para importar en este archivo.')
      return
    }

    setImporting(true)
    let insertedCount = 0
    let errorCount = 0

    try {
      const validRows = parsedData.rows.filter((r) => r.status === 'valid')

      // Insertar masivamente en Supabase
      const payload = validRows.map((r) => ({
        promocion_id: promotion.id,
        sku: r.sku,
        cantidad_minima: r.cantidad_minima,
        cantidad_maxima: r.cantidad_maxima,
        tipo_descuento: r.tipo_descuento,
        valor_descuento: r.valor_descuento,
      }))

      const { data, error } = await supabase
        .from('promocion_regla')
        .insert(payload)

      if (error) throw error

      insertedCount = payload.length
      toast.success(`¡${insertedCount} reglas importadas e insertadas con éxito!`)

      if (onImportSuccess) {
        await onImportSuccess()
      }
      onClose()
    } catch (err) {
      console.error('Error al importar reglas vía CSV:', err)
      toast.error(`Error al insertar reglas: ${err.message || 'Error desconocido'}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 font-serif flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-500" />
              Carga Masiva de Reglas por CSV
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Promoción: <strong className="text-zinc-800">{promotion.nombre}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zona de Drop / Carga de Archivo */}
        {!parsedData ? (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-zinc-50 hover:bg-amber-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
            >
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 bg-amber-100 text-amber-700 rounded-full group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-zinc-700">
                  Arrastra tu archivo CSV aquí o{' '}
                  <span className="text-amber-600 underline">examina tu equipo</span>
                </p>
                <p className="text-[11px] text-zinc-400">
                  Acepta archivos con columnas: <code>sku, cantidad_minima, cantidad_maxima, tipo_descuento, valor_descuento</code>
                </p>
              </label>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                Procesando archivo CSV...
              </div>
            )}

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Botón de Plantilla */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">¿No tienes el formato adecuado?</span>
              <button
                type="button"
                onClick={downloadPromotionRulesCSVTemplate}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Plantilla CSV
              </button>
            </div>
          </div>
        ) : (
          /* Vista Previa del Análisis CSV */
          <div className="space-y-4">
            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                <span className="text-zinc-500 block text-[10px]">Total Filas</span>
                <span className="text-lg font-bold text-zinc-900">{parsedData.summary.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-800">
                <span className="text-emerald-600 block text-[10px]">Válidas a Insertar</span>
                <span className="text-lg font-bold">{parsedData.summary.valid}</span>
              </div>
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-800">
                <span className="text-rose-600 block text-[10px]">Errores / Omitidas</span>
                <span className="text-lg font-bold">{parsedData.summary.errors}</span>
              </div>
            </div>

            {/* Tabla de Filas Procesadas */}
            <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-600 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3">Cantidad</th>
                    <th className="py-2 px-3">Descuento</th>
                    <th className="py-2 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {parsedData.rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={r.status === 'valid' ? 'hover:bg-emerald-50/50' : 'bg-rose-50/40'}
                    >
                      <td className="py-2 px-3 font-mono font-semibold text-zinc-900">{r.sku}</td>
                      <td className="py-2 px-3 text-zinc-700 truncate max-w-[140px]">{r.productName}</td>
                      <td className="py-2 px-3 text-zinc-600">
                        {r.cantidad_minima} {r.cantidad_maxima ? `a ${r.cantidad_maxima}` : '+'} un.
                      </td>
                      <td className="py-2 px-3 font-bold text-zinc-800">
                        {r.tipo_descuento === 'porcentaje'
                          ? `${r.valor_descuento}%`
                          : `$${r.valor_descuento} USD`}
                      </td>
                      <td className="py-2 px-3">
                        {r.status === 'valid' ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Válido
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" title={r.reason}>
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> {r.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setParsedData(null)
                  setFile(null)
                }}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-900 font-semibold underline"
              >
                ← Seleccionar otro archivo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 font-semibold text-xs rounded-xl hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importing || parsedData.summary.valid === 0}
                  onClick={handleConfirmImport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Insertando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Importar {parsedData.summary.valid} Reglas
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
