/**
 * Utilidades para exportación e importación de productos e inventario vía CSV.
 */

// Función auxiliar para escapar campos CSV
const escapeCSVField = (field) => {
  if (field === null || field === undefined) return '""'
  const str = String(field)
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Genera y descarga un archivo CSV con los productos y su stock por sucursal.
 */
export const exportProductsToCSV = (products, branchStockMap, branches, storeName = 'tienda') => {
  if (!products || products.length === 0) {
    throw new Error('No hay productos para exportar.')
  }

  // 1. Encabezados base + dinámicos por sucursal
  const headers = ['SKU', 'Título', 'Precio', 'IVA (%)']
  branches.forEach(b => {
    headers.push(`Stock - ${b.nombre}`)
  })

  const rows = [headers.map(escapeCSVField).join(',')]

  // 2. Filas de datos
  products.forEach(p => {
    const pssList = branchStockMap[p.id] || []
    
    const row = [
      p.sku || '',
      p.name || '',
      p.price !== undefined && p.price !== null ? p.price : 0,
      p.tax !== undefined && p.tax !== null ? p.tax : 0
    ]

    // Agregar stock de cada sucursal
    branches.forEach(b => {
      const match = pssList.find(item => item.sucursal_id === b.id)
      row.push(match ? match.stock : 0)
    })

    rows.push(row.map(escapeCSVField).join(','))
  })

  // 3. Crear Blob con BOM UTF-8 (\uFEFF) para compatibilidad con Excel
  const csvContent = '\uFEFF' + rows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // 4. Disparar descarga
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const cleanStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const dateStr = new Date().toISOString().split('T')[0]
  
  link.setAttribute('href', url)
  link.setAttribute('download', `inventario_${cleanStoreName}_${dateStr}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parsea una línea de CSV respetando comillas y caracteres de escape.
 */
const parseCSVLine = (line, delimiter = ',') => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // saltar la comilla escapada
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Procesa el contenido de un archivo CSV para actualizar productos.
 */
export const parseProductsCSV = (csvText, existingProducts, branches) => {
  // Limpiar BOM UTF-8 si existe
  let cleanText = csvText
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1)
  }

  // Dividir líneas
  const rawLines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (rawLines.length < 2) {
    throw new Error('El archivo CSV está vacío o solo contiene encabezados.')
  }

  // Detectar delimitador (, o ;)
  const firstLine = rawLines[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const delimiter = semicolonCount > commaCount ? ';' : ','

  // Encabezados
  const headers = parseCSVLine(rawLines[0], delimiter).map(h => h.replace(/^"|"$/g, '').trim())
  
  // Buscar índices de columnas base
  const skuIdx = headers.findIndex(h => /sku/i.test(h))
  const titleIdx = headers.findIndex(h => /t[íi]tulo|nombre|title|name/i.test(h))
  const priceIdx = headers.findIndex(h => /precio|price/i.test(h))
  const taxIdx = headers.findIndex(h => /iva|tax|tipo_iva|impuesto/i.test(h))

  if (skuIdx === -1) {
    throw new Error('No se encontró la columna "SKU" obligatoria en el CSV.')
  }

  // Mapear columnas de stock por sucursal
  // Ejemplo: "Stock - Sucursal Principal" -> asociar a la sucursal correspondiente
  const branchHeaderMap = [] // [ { branchId, branchName, colIndex } ]
  
  branches.forEach(b => {
    // Buscar columna que mencione el nombre o código de la sucursal
    const colIdx = headers.findIndex(h => {
      const hLower = h.toLowerCase()
      const bNameLower = b.nombre.toLowerCase()
      const bCodeLower = (b.codigo || '').toLowerCase()
      return hLower.includes(bNameLower) || (bCodeLower && hLower.includes(bCodeLower))
    })

    if (colIdx !== -1) {
      branchHeaderMap.push({
        branchId: b.id,
        branchName: b.nombre,
        colIndex: colIdx
      })
    }
  })

  // Mapa de productos existentes por SKU (case-insensitive)
  const productSkuMap = new Map()
  existingProducts.forEach(p => {
    if (p.sku) {
      productSkuMap.set(p.sku.trim().toUpperCase(), p)
    }
  })

  const parsedRows = []
  let countUpdate = 0
  let countOmitted = 0
  let countInvalid = 0

  for (let i = 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i]
    const values = parseCSVLine(rawLine, delimiter).map(v => v.replace(/^"|"$/g, '').trim())
    
    const rowSku = (values[skuIdx] || '').toUpperCase()
    const rowTitle = titleIdx !== -1 ? values[titleIdx] : ''
    const rowPrice = priceIdx !== -1 ? parseFloat(values[priceIdx]) : NaN
    const rowTax = taxIdx !== -1 ? parseFloat(values[taxIdx]) : 0

    // Extraer stocks por sucursal
    const branchStocks = {}
    let totalStockSum = 0

    branches.forEach(b => {
      const mappedCol = branchHeaderMap.find(m => m.branchId === b.id)
      if (mappedCol && values[mappedCol.colIndex] !== undefined) {
        const val = parseInt(values[mappedCol.colIndex], 10)
        const stockVal = isNaN(val) || val < 0 ? 0 : val
        branchStocks[b.id] = stockVal
        totalStockSum += stockVal
      } else {
        branchStocks[b.id] = 0
      }
    })

    if (!rowSku) {
      countInvalid++
      parsedRows.push({
        lineIndex: i + 1,
        sku: 'SIN SKU',
        title: rowTitle || 'Sin Título',
        price: isNaN(rowPrice) ? 0 : rowPrice,
        tax: isNaN(rowTax) ? 0 : rowTax,
        branchStocks,
        totalStockSum,
        action: 'omit',
        reason: 'Línea sin SKU válido'
      })
      continue
    }

    const existingProduct = productSkuMap.get(rowSku)

    if (existingProduct) {
      countUpdate++
      parsedRows.push({
        lineIndex: i + 1,
        productId: existingProduct.id,
        sku: rowSku,
        title: rowTitle || existingProduct.name,
        price: !isNaN(rowPrice) && rowPrice >= 0 ? rowPrice : existingProduct.price,
        tax: !isNaN(rowTax) && rowTax >= 0 ? rowTax : (existingProduct.tax || 0),
        branchStocks,
        totalStockSum,
        action: 'update',
        reason: 'Producto encontrado (se actualizará)'
      })
    } else {
      countOmitted++
      parsedRows.push({
        lineIndex: i + 1,
        sku: rowSku,
        title: rowTitle || 'Producto Desconocido',
        price: isNaN(rowPrice) ? 0 : rowPrice,
        tax: isNaN(rowTax) ? 0 : rowTax,
        branchStocks,
        totalStockSum,
        action: 'omit',
        reason: 'SKU no existe en el catálogo (omitido)'
      })
    }
  }

  return {
    rows: parsedRows,
    branchHeaderMap,
    summary: {
      total: parsedRows.length,
      toUpdate: countUpdate,
      omitted: countOmitted + countInvalid
    }
  }
}
