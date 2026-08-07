/**
 * Motor de Evaluación de Promociones y Descuentos
 * 
 * Permite evaluar promociones por SKU, por categoría, por volumen escalonado (10 unidades -> 10%, 20 -> 15%)
 * y por campañas temporales (ej: "Día del Padre").
 */

/**
 * Verifica si una promoción está vigente según sus fechas de inicio y fin.
 */
export const esPromocionVigente = (promocion) => {
  if (!promocion || promocion.is_active === false) return false

  const ahora = new Date()

  if (promocion.fecha_inicio && new Date(promocion.fecha_inicio) > ahora) {
    return false
  }

  if (promocion.fecha_fin && new Date(promocion.fecha_fin) < ahora) {
    return false
  }

  return true
}

/**
 * Evalúa las promociones activas para un producto específico y una cantidad dada.
 * Retorna la mejor oferta disponible para el cliente.
 * 
 * @param {Object} producto - Objeto del producto (contiene sku, category_id, price, compare_price, etc.)
 * @param {number} cantidad - Cantidad seleccionada (por defecto 1 para visualización en catálogo)
 * @param {Array} promociones - Lista de promociones obtenidas de Supabase con sus reglas
 * @returns {Object} Detalle del precio original, precio promocional, descuento aplicado y etiquetas
 */
export const evaluarPromocionProducto = (producto, cantidad = 1, promociones = []) => {
  const precioBase = parseFloat(producto?.price ?? 0)
  
  if (!producto || precioBase <= 0 || !Array.isArray(promociones) || promociones.length === 0) {
    return {
      tienePromocion: false,
      precioOriginal: precioBase,
      precioFinal: precioBase,
      montoDescuentoUnitario: 0,
      porcentajeDescuento: 0,
      badgeText: null,
      nombrePromocion: null,
      proximoEscalon: null
    }
  }

  const sku = producto.sku ?? producto.codigo_barra ?? null
  const categoryId = producto.category_id ?? producto.category ?? null

  let mejorOferta = {
    montoDescuentoUnitario: 0,
    porcentajeDescuento: 0,
    promocion: null,
    regla: null
  }

  let proximosEscalones = []

  for (const promo of promociones) {
    if (!esPromocionVigente(promo)) continue
    
    const reglas = promo.promocion_regla || promo.reglas || []

    for (const regla of reglas) {
      // Coincidencia por SKU o por Categoría
      const coincideSku = sku && regla.sku && String(regla.sku).trim().toLowerCase() === String(sku).trim().toLowerCase()
      const coincideCategoria = categoryId && regla.category_id && String(regla.category_id) === String(categoryId)

      if (!coincideSku && !coincideCategoria) continue

      const minQty = regla.cantidad_minima || 1
      const maxQty = regla.cantidad_maxima || null

      // Si cumple la cantidad requerida
      if (cantidad >= minQty && (!maxQty || cantidad <= maxQty)) {
        let descuentoUnitario = 0
        let porcentaje = 0

        if (regla.tipo_descuento === 'porcentaje') {
          porcentaje = parseFloat(regla.valor_descuento || 0)
          descuentoUnitario = precioBase * (porcentaje / 100)
        } else if (regla.tipo_descuento === 'monto_fijo') {
          descuentoUnitario = parseFloat(regla.valor_descuento || 0)
          porcentaje = precioBase > 0 ? (descuentoUnitario / precioBase) * 100 : 0
        }

        // Siempre seleccionar la promoción que ofrezca EL MAYOR DESCUENTO para el cliente
        if (descuentoUnitario > mejorOferta.montoDescuentoUnitario) {
          mejorOferta = {
            montoDescuentoUnitario: Math.min(descuentoUnitario, precioBase),
            porcentajeDescuento: Math.round(porcentaje),
            promocion: promo,
            regla: regla
          }
        }
      } 
      // Si aún no cumple la cantidad pero es una regla por volumen superior
      else if (cantidad < minQty) {
        proximosEscalones.push({
          cantidadFaltante: minQty - cantidad,
          cantidadMinima: minQty,
          tipoDescuento: regla.tipo_descuento,
          valorDescuento: regla.valor_descuento,
          nombrePromocion: promo.nombre
        })
      }
    }
  }

  const tienePromocion = mejorOferta.montoDescuentoUnitario > 0
  const precioFinal = Math.max(0, precioBase - mejorOferta.montoDescuentoUnitario)

  // Generar etiqueta descriptiva
  let badgeText = null
  if (tienePromocion) {
    if (mejorOferta.promocion.tipo === 'campana') {
      badgeText = `¡${mejorOferta.promocion.nombre}! -${mejorOferta.porcentajeDescuento}%`
    } else {
      badgeText = `Promo -${mejorOferta.porcentajeDescuento}%`
    }
  }

  // Ordenar próximos escalones por cercanía
  proximosEscalones.sort((a, b) => a.cantidadFaltante - b.cantidadFaltante)
  const proximoEscalon = proximosEscalones[0] || null
  const esMaximoDescuento = tienePromocion && proximosEscalones.length === 0

  return {
    tienePromocion,
    precioOriginal: precioBase,
    precioFinal: Number(precioFinal.toFixed(2)),
    montoDescuentoUnitario: Number(mejorOferta.montoDescuentoUnitario.toFixed(2)),
    porcentajeDescuento: mejorOferta.porcentajeDescuento,
    badgeText,
    nombrePromocion: mejorOferta.promocion?.nombre ?? null,
    proximoEscalon,
    esMaximoDescuento
  }
}
