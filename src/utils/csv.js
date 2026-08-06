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

  // 1. Encabezados base + automotrices + dinámicos por sucursal
  const headers = ['SKU', 'Título', 'Precio', 'IVA (%)', 'OEM', 'Código Fabricante', 'Viscosidad', 'Tipo Aceite', 'Normativa', 'Presentación', 'Origen']
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
      p.tax !== undefined && p.tax !== null ? p.tax : 0,
      p.oem_number || '',
      p.part_number_fabricante || '',
      p.viscosidad || '',
      p.tipo_aceite || '',
      p.normativa_api_jaso || '',
      p.volumen_presentacion || '',
      p.origen_fabricacion || ''
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
  if (delimiter === '\t') {
    return line.split('\t').map(col => col.replace(/^"|"$/g, '').trim())
  }
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
  
  // Buscar índices de columnas base y automotrices
  const skuIdx = headers.findIndex(h => /sku/i.test(h))
  const titleIdx = headers.findIndex(h => /t[íi]tulo|nombre|title|name/i.test(h))
  const priceIdx = headers.findIndex(h => /precio|price/i.test(h))
  const taxIdx = headers.findIndex(h => /iva|tax|tipo_iva|impuesto/i.test(h))

  const oemIdx = headers.findIndex(h => /^oem$/i.test(h) || /oem_number/i.test(h))
  const partNumIdx = headers.findIndex(h => /fabricante|c[óo]digo.*fabricante|part.*number/i.test(h))
  const viscosidadIdx = headers.findIndex(h => /viscosidad/i.test(h))
  const tipoAceiteIdx = headers.findIndex(h => /tipo.*aceite/i.test(h))
  const normativaIdx = headers.findIndex(h => /normativa|jaso|api/i.test(h))
  const presentacionIdx = headers.findIndex(h => /presentaci[óo]n|volumen/i.test(h))
  const origenIdx = headers.findIndex(h => /origen/i.test(h))

  if (skuIdx === -1) {
    throw new Error('No se encontró la columna "SKU" obligatoria en el CSV.')
  }

  const branchHeaderMap = []
  branches.forEach(b => {
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

    const rowOem = oemIdx !== -1 ? values[oemIdx] : undefined
    const rowPartNum = partNumIdx !== -1 ? values[partNumIdx] : undefined
    const rowViscosidad = viscosidadIdx !== -1 ? values[viscosidadIdx] : undefined
    const rowTipoAceite = tipoAceiteIdx !== -1 ? values[tipoAceiteIdx] : undefined
    const rowNormativa = normativaIdx !== -1 ? values[normativaIdx] : undefined
    const rowPresentacion = presentacionIdx !== -1 ? values[presentacionIdx] : undefined
    const rowOrigen = origenIdx !== -1 ? values[origenIdx] : undefined

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
        oem_number: rowOem !== undefined ? rowOem : existingProduct.oem_number,
        part_number_fabricante: rowPartNum !== undefined ? rowPartNum : existingProduct.part_number_fabricante,
        viscosidad: rowViscosidad !== undefined ? rowViscosidad : existingProduct.viscosidad,
        tipo_aceite: rowTipoAceite !== undefined ? rowTipoAceite : existingProduct.tipo_aceite,
        normativa_api_jaso: rowNormativa !== undefined ? rowNormativa : existingProduct.normativa_api_jaso,
        volumen_presentacion: rowPresentacion !== undefined ? rowPresentacion : existingProduct.volumen_presentacion,
        origen_fabricacion: rowOrigen !== undefined ? rowOrigen : existingProduct.origen_fabricacion,
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

/**
 * Descarga una plantilla CSV de ejemplo para importar reglas de promoción.
 */
export const downloadPromotionRulesCSVTemplate = () => {
  const headers = ['sku', 'cantidad_minima', 'cantidad_maxima', 'tipo_descuento', 'valor_descuento']
  const sampleRows = [
    ['RTR-044-RE', '10', '19', 'porcentaje', '10'],
    ['RTR-044-RE', '20', '', 'porcentaje', '15'],
    ['ACE-4T-1L', '1', '', 'monto_fijo', '2.50'],
  ]
  const content = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'plantilla_reglas_promocion.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parsea e inspecciona un archivo CSV de reglas de promoción.
 */
export const parsePromotionRulesCSV = (csvText, existingProducts = []) => {
  if (!csvText || !csvText.trim()) {
    throw new Error('El archivo CSV está vacío.')
  }

  // Limpiar BOM UTF-8 si existe
  let cleanText = csvText
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1)
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length < 1) {
    throw new Error('El archivo CSV no contiene líneas válidas.')
  }

  const firstLine = lines[0]
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length

  let delimiter = ','
  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) {
    delimiter = '\t'
  } else if (semicolonCount > commaCount) {
    delimiter = ';'
  }

  const rawHeaders = parseCSVLine(firstLine, delimiter)
  const headers = rawHeaders.map(h => h.replace(/^"|"$/g, '').toLowerCase().trim())

  // Helpers de conversión de números flexibles (reemplaza coma por punto, remueve $, %, espacios)
  const parseFlexibleFloat = (valStr) => {
    if (valStr === null || valStr === undefined || String(valStr).trim() === '') return NaN
    const cleaned = String(valStr)
      .replace(/[\$%€\u00A0\s]/g, '')
      .replace(',', '.')
      .trim()
    return parseFloat(cleaned)
  }

  const parseFlexibleInt = (valStr) => {
    const f = parseFlexibleFloat(valStr)
    return isNaN(f) ? NaN : Math.floor(f)
  }

  // Detección si la primera fila son encabezados o datos reales
  const hasExplicitHeaders = headers.some(h =>
    h === 'sku' ||
    h === 'codigo' ||
    h === 'código' ||
    h.includes('descuento') ||
    h.includes('valor') ||
    h.includes('monto') ||
    h.includes('min') ||
    h.includes('max') ||
    h.includes('tipo')
  )

  // Resolver índices de columnas por nombre o por posición
  let targetSkuIdx = headers.findIndex(h =>
    h === 'sku' ||
    h === 'codigo' ||
    h === 'código' ||
    h.includes('barcode') ||
    h.includes('barra') ||
    h.includes('referencia') ||
    h.includes('producto')
  )
  let minQtyIdx = headers.findIndex(h => h.includes('min') || h.includes('cantidad_minima'))
  let maxQtyIdx = headers.findIndex(h => h.includes('max') || h.includes('cantidad_maxima'))

  let discountTypeIdx = headers.findIndex(h =>
    h === 'tipo' || h === 'tipo_descuento' || h === 'tipo_de_descuento' || h === 'type' || h.includes('tipo')
  )

  let discountValIdx = headers.findIndex((h, idx) =>
    idx !== discountTypeIdx && (
      h === 'valor_descuento' ||
      h === 'valor' ||
      h === 'descuento' ||
      h === 'monto' ||
      h === 'porcentaje' ||
      h === '%' ||
      h.includes('valor') ||
      h.includes('monto') ||
      (h.includes('descuento') && !h.includes('tipo')) ||
      (h.includes('porcentaje') && !h.includes('tipo')) ||
      h.includes('value') ||
      h.includes('amount') ||
      h.includes('rate') ||
      h.includes('precio')
    )
  )

  // Fallbacks posicionales según la cantidad total de columnas del CSV
  const colCount = rawHeaders.length
  if (colCount >= 5) {
    if (minQtyIdx === -1) minQtyIdx = 1
    if (maxQtyIdx === -1) maxQtyIdx = 2
    if (discountTypeIdx === -1) discountTypeIdx = 3
    if (discountValIdx === -1) discountValIdx = 4
  } else if (colCount === 4) {
    if (minQtyIdx === -1) minQtyIdx = 1
    if (discountTypeIdx === -1) discountTypeIdx = 2
    if (discountValIdx === -1) discountValIdx = 3
  } else if (colCount === 3) {
    if (minQtyIdx === -1) minQtyIdx = 1
    if (discountValIdx === -1) discountValIdx = 2
  } else if (colCount === 2) {
    if (discountValIdx === -1) discountValIdx = 1
  } else if (colCount === 1) {
    if (discountValIdx === -1) discountValIdx = 0
  }

  const startLineIndex = hasExplicitHeaders ? 1 : 0

  // Helpers de normalización de código
  const cleanCode = (str) => {
    if (str === null || str === undefined) return ''
    let val = String(str)
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, '')
      .replace(/^"|"$/g, '')
      .trim()
    if (val.endsWith('.0')) {
      val = val.slice(0, -2)
    }
    return val.toLowerCase()
  }

  const stripNonAlphaNum = (str) => {
    return cleanCode(str).replace(/[^a-z0-9]/g, '')
  }

  // Indexar los productos por CUALQUIERA de sus propiedades de código
  const productSkuMap = new Map()

  existingProducts.forEach(p => {
    if (!p) return
    const candidateFields = [
      p.sku,
      p.barcode,
      p.codigo_barra,
      p.codigo,
      p.codigo_producto,
      p.oem_number,
      p.part_number_fabricante,
      p.id
    ]

    candidateFields.forEach(val => {
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const c1 = cleanCode(val)
        const c2 = stripNonAlphaNum(val)
        if (c1) productSkuMap.set(c1, p)
        if (c2) productSkuMap.set(c2, p)
      }
    })
  })

  const parsedRows = []
  let validCount = 0
  let errorCount = 0

  for (let i = startLineIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter)
    const rawRowSku = values[targetSkuIdx] ? values[targetSkuIdx].replace(/^"|"$/g, '').trim() : ''
    const cleanedRowSku = cleanCode(rawRowSku)
    const strippedRowSku = stripNonAlphaNum(rawRowSku)

    const rowMinQtyStr = minQtyIdx !== -1 && values[minQtyIdx] !== undefined ? values[minQtyIdx] : '1'
    const rowMaxQtyStr = maxQtyIdx !== -1 && values[maxQtyIdx] !== undefined ? values[maxQtyIdx] : ''
    const rowTypeStr = discountTypeIdx !== -1 && values[discountTypeIdx] !== undefined ? values[discountTypeIdx] : 'porcentaje'
    const rowValStr = discountValIdx !== -1 && values[discountValIdx] !== undefined ? values[discountValIdx] : ''

    const minQty = parseFlexibleInt(rowMinQtyStr)
    const finalMinQty = isNaN(minQty) || minQty < 1 ? 1 : minQty
    const maxQty = rowMaxQtyStr ? parseFlexibleInt(rowMaxQtyStr) : null
    const finalMaxQty = isNaN(maxQty) ? null : maxQty

    const valorDescuento = parseFlexibleFloat(rowValStr)

    const cleanType = String(rowTypeStr).toLowerCase().includes('monto') || String(rowTypeStr).toLowerCase().includes('fijo') || String(rowTypeStr).includes('$')
      ? 'monto_fijo'
      : 'porcentaje'

    const matchedProduct = productSkuMap.get(cleanedRowSku) || productSkuMap.get(strippedRowSku)

    let isValid = true
    let reason = ''

    if (!rawRowSku) {
      isValid = false
      reason = 'Falta el código SKU'
    } else if (!matchedProduct) {
      isValid = false
      reason = `SKU/Código "${rawRowSku}" no coincide con ningún producto del catálogo`
    } else if (isNaN(valorDescuento) || valorDescuento <= 0) {
      isValid = false
      reason = 'El valor del descuento debe ser un número mayor a 0'
    } else if (finalMaxQty !== null && finalMaxQty < finalMinQty) {
      isValid = false
      reason = 'Cantidad máxima debe ser mayor o igual a la mínima'
    }

    if (isValid) {
      validCount++
      const skuToSave = matchedProduct.sku || matchedProduct.codigo_barra || matchedProduct.barcode || rawRowSku
      parsedRows.push({
        lineIndex: i + 1,
        sku: skuToSave,
        rawSkuUploaded: rawRowSku,
        productName: matchedProduct.name,
        productId: matchedProduct.id,
        cantidad_minima: finalMinQty,
        cantidad_maxima: finalMaxQty,
        tipo_descuento: cleanType,
        valor_descuento: valorDescuento,
        status: 'valid',
        reason: 'Válido para insertar'
      })
    } else {
      errorCount++
      parsedRows.push({
        lineIndex: i + 1,
        sku: rawRowSku || 'SIN SKU',
        rawSkuUploaded: rawRowSku,
        productName: matchedProduct ? matchedProduct.name : '-',
        cantidad_minima: finalMinQty,
        cantidad_maxima: finalMaxQty,
        tipo_descuento: cleanType,
        valor_descuento: isNaN(valorDescuento) ? 0 : valorDescuento,
        status: 'error',
        reason
      })
    }
  }

  return {
    rows: parsedRows,
    summary: {
      total: parsedRows.length,
      valid: validCount,
      errors: errorCount
    }
  }
}
