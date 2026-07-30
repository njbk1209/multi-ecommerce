import React, { useState } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ArrowRight, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { parseProductsCSV } from '../utils/csv'
import { supabase } from '../utils/supabase'
import toast from 'react-hot-toast'

export default function CSVImportModal({ isOpen, onClose, existingProducts, branches, onImportSuccess }) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [parseError, setParseError] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  if (!isOpen) return null

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv' && selectedFile.type !== 'application/vnd.ms-excel') {
      toast.error('Por favor, selecciona un archivo con extensión .csv')
      return
    }

    setFile(selectedFile)
    setParseError('')
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const result = parseProductsCSV(text, existingProducts, branches)
        setParsedData(result)
      } catch (err) {
        console.error('Error al procesar CSV:', err)
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
    if (!parsedData || parsedData.summary.toUpdate === 0) {
      toast.error('No hay productos válidos para actualizar.')
      return
    }

    setImporting(true)
    let updatedCount = 0
    let errorCount = 0

    try {
      const rowsToUpdate = parsedData.rows.filter(r => r.action === 'update')

      for (const row of rowsToUpdate) {
        // 1. Actualizar producto en la tabla producto
        const productPayload = {
          name: row.title.trim(),
          price: row.price,
          tax: row.tax,
          stock: row.totalStockSum,
          stock_status: row.totalStockSum >= 1
        }

        const { error: prodErr } = await supabase
          .from('producto')
          .update(productPayload)
          .eq('id', row.productId)

        if (prodErr) {
          console.error(`Error actualizando producto SKU ${row.sku}:`, prodErr)
          errorCount++
          continue
        }

        // 2. Actualizar stock por sucursal en producto_stock_sucursal
        if (branches.length > 0) {
          const pssPayload = branches.map(b => {
            const stockVal = row.branchStocks[b.id] !== undefined ? row.branchStocks[b.id] : 0
            return {
              producto_id: row.productId,
              sucursal_id: b.id,
              stock: stockVal,
              stock_status: stockVal >= 1
            }
          })

          const { error: pssErr } = await supabase
            .from('producto_stock_sucursal')
            .upsert(pssPayload, { onConflict: 'producto_id, sucursal_id' })

          if (pssErr) {
            console.error(`Error actualizando inventario sucursales SKU ${row.sku}:`, pssErr)
          }
        }

        updatedCount++
      }

      if (updatedCount > 0) {
        toast.success(`Se actualizaron ${updatedCount} productos e inventarios exitosamente.`)
        if (errorCount > 0) {
          toast.error(`Ocurrieron ${errorCount} errores durante el procesamiento.`)
        }
        onImportSuccess()
        onClose()
      } else {
        toast.error('No se pudo actualizar ningún producto.')
      }
    } catch (err) {
      console.error('Error durante la importación masiva:', err)
      toast.error('Ocurrió un error inesperado al guardar los cambios.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl my-8 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-zinc-900 text-base">Importación Masiva de Inventario vía CSV</h3>
              <p className="text-xs text-zinc-500">Actualiza precios, IVA y stock por almacén/sucursal para productos existentes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="text-zinc-400 hover:text-zinc-600 hover:rotate-90 transition-all p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          
          {/* Zona de Carga de Archivos */}
          {!parsedData ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-zinc-300 hover:border-zinc-800 rounded-2xl p-10 text-center space-y-4 bg-zinc-50/50 transition-all cursor-pointer group"
            >
              <input
                type="file"
                accept=".csv, text/csv, application/vnd.ms-excel"
                className="hidden"
                id="csv-file-input"
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-3">
                <div className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-zinc-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Arrastra tu archivo CSV aquí o haz click para explorar</p>
                  <p className="text-xs text-zinc-400 mt-1">Formatos soportados: .csv (delimitado por comas o punto y coma)</p>
                </div>
              </label>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-600 pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando archivo CSV...
                </div>
              )}

              {parseError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2 max-w-lg mx-auto">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (
            /* Vista Previa y Resumen */
            <div className="space-y-4">
              
              {/* Barra de Resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">A Actualizar</span>
                    <p className="text-xl font-bold font-mono text-emerald-900">{parsedData.summary.toUpdate}</p>
                  </div>
                  <RefreshCw className="w-5 h-5 text-emerald-600" />
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Omitidos (Sin SKU / Inexistentes)</span>
                    <p className="text-xl font-bold font-mono text-amber-900">{parsedData.summary.omitted}</p>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>

                <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Total Filas CSV</span>
                    <p className="text-xl font-bold font-mono text-zinc-900">{parsedData.summary.total}</p>
                  </div>
                  <FileText className="w-5 h-5 text-zinc-400" />
                </div>
              </div>

              {/* Botón para Cambiar Archivo */}
              <div className="flex justify-between items-center bg-zinc-50 px-4 py-2.5 border border-zinc-200 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-700 truncate">
                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="font-semibold">{file?.name}</span>
                </div>
                <button
                  onClick={() => { setParsedData(null); setFile(null); }}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 border border-zinc-300 px-3 py-1 rounded-lg hover:bg-white transition-colors"
                >
                  Seleccionar otro archivo
                </button>
              </div>

              {/* Tabla de Previsualización */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-zinc-100 border-b border-zinc-200 font-bold uppercase text-zinc-500 tracking-wider sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Línea</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Título</th>
                        <th className="px-4 py-3">Precio ($)</th>
                        <th className="px-4 py-3">IVA (%)</th>
                        {branches.map(b => (
                          <th key={b.id} className="px-4 py-3">Stock ({b.nombre})</th>
                        ))}
                        <th className="px-4 py-3 text-center">Acción / Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-mono text-zinc-700">
                      {parsedData.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={row.action === 'update' ? 'hover:bg-emerald-50/40' : 'bg-amber-50/30 opacity-70'}
                        >
                          <td className="px-4 py-2.5 text-zinc-400 font-sans">{row.lineIndex}</td>
                          <td className="px-4 py-2.5 font-bold text-zinc-900">{row.sku}</td>
                          <td className="px-4 py-2.5 font-sans font-medium text-zinc-800 max-w-[150px] truncate">{row.title}</td>
                          <td className="px-4 py-2.5 font-semibold text-emerald-700">${row.price.toFixed(2)}</td>
                          <td className="px-4 py-2.5">{row.tax}%</td>
                          {branches.map(b => (
                            <td key={b.id} className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded ${row.branchStocks[b.id] > 0 ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-400'}`}>
                                {row.branchStocks[b.id] || 0}
                              </span>
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-center font-sans">
                            {row.action === 'update' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Actualizar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full" title={row.reason}>
                                <AlertTriangle className="w-3 h-3" /> Omitido
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Pie del Modal con Acciones */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={importing}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          {parsedData && (
            <button
              onClick={handleConfirmImport}
              disabled={importing || parsedData.summary.toUpdate === 0}
              className={`flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95
                ${importing || parsedData.summary.toUpdate === 0
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-zinc-950 hover:bg-zinc-800 text-white'}`}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Actualizando productos...
                </>
              ) : (
                <>
                  Confirmar y Actualizar {parsedData.summary.toUpdate} Productos
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
