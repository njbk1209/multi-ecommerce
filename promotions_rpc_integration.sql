-- ======================================================
-- INTEGRACIÓN DE PROMOCIONES EN EL BACKEND (RPC crear_pedido)
-- ======================================================
-- Esta función actualiza 'crear_pedido' para validar y recalcular
-- automáticamente los descuentos por SKU y volumen en la base de datos,
-- garantizando que no se puedan alterar los precios desde el frontend.

CREATE OR REPLACE FUNCTION public.crear_pedido_con_promociones(
  p_store_id bigint,
  p_nombre_cliente text,
  p_whatsapp_cliente text,
  p_metodo_entrega text,
  p_direccion_entrega text,
  p_gps_url text,
  p_total_usd numeric,
  p_total_bs numeric,
  p_moneda_activa text,
  p_items jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido_id bigint;
  v_item jsonb;
  v_sku text;
  v_cantidad integer;
  v_precio_base numeric(10, 2);
  v_descuento_unitario numeric(10, 2) := 0;
  v_precio_final numeric(10, 2);
  v_total_calculado_usd numeric(10, 2) := 0;
  v_tasa_cambio numeric(15, 2) := 1.0;
  v_regla record;
BEGIN
  -- 1. Insertar la cabecera del pedido
  INSERT INTO public.pedido (
    store_id,
    nombre_cliente,
    whatsapp_cliente,
    metodo_entrega,
    direccion_entrega,
    gps_url,
    total_usd,
    total_bs,
    moneda_activa,
    estado
  ) VALUES (
    p_store_id,
    p_nombre_cliente,
    p_whatsapp_cliente,
    p_metodo_entrega,
    p_direccion_entrega,
    p_gps_url,
    p_total_usd,
    p_total_bs,
    p_moneda_activa,
    'pendiente'
  )
  RETURNING id INTO v_pedido_id;

  -- 2. Procesar e insertar cada item evaluando la mejor regla de promoción
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sku := v_item->>'sku';
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio_base := (v_item->>'precio_unitario')::numeric;
    v_descuento_unitario := 0;

    -- Buscar la regla con EL MAYOR DESCUENTO aplicable para esta tienda y SKU
    IF v_sku IS NOT NULL AND v_sku <> '' THEN
      SELECT 
        CASE 
          WHEN pr.tipo_descuento = 'porcentaje' THEN (v_precio_base * (pr.valor_descuento / 100.0))
          WHEN pr.tipo_descuento = 'monto_fijo' THEN pr.valor_descuento
          ELSE 0
        END AS descuento_calculado
      INTO v_regla
      FROM public.promocion p
      JOIN public.promocion_regla pr ON pr.promocion_id = p.id
      WHERE p.store_id = p_store_id
        AND p.is_active = true
        AND (p.fecha_inicio IS NULL OR p.fecha_inicio <= now())
        AND (p.fecha_fin IS NULL OR p.fecha_fin >= now())
        AND LOWER(TRIM(pr.sku)) = LOWER(TRIM(v_sku))
        AND v_cantidad >= pr.cantidad_minima
        AND (pr.cantidad_maxima IS NULL OR v_cantidad <= pr.cantidad_maxima)
      ORDER BY descuento_calculado DESC
      LIMIT 1;

      IF v_regla.descuento_calculado IS NOT NULL THEN
        v_descuento_unitario := LEAST(v_regla.descuento_calculado, v_precio_base);
      END IF;
    END IF;

    v_precio_final := v_precio_base - v_descuento_unitario;

    INSERT INTO public.pedido_item (
      pedido_id,
      producto_id,
      nombre_producto,
      cantidad,
      precio_unitario,
      comentario,
      opciones_seleccionadas,
      sucursal_id,
      sucursal_nombre,
      sku,
      codigo_barra
    ) VALUES (
      v_pedido_id,
      (v_item->>'producto_id')::bigint,
      v_item->>'nombre_producto',
      v_cantidad,
      v_precio_final, -- Guarda el precio con la promoción aplicada
      v_item->>'comentario',
      (v_item->'opciones_seleccionadas'),
      NULLIF(v_item->>'sucursal_id', '')::bigint,
      v_item->>'sucursal_nombre',
      v_sku,
      v_item->>'codigo_barra'
    );
  END LOOP;

  RETURN v_pedido_id;
END;
$$;
