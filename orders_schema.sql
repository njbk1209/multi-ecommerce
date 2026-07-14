-- ==========================================
-- ESTRUCTURA DE TABLAS PARA PEDIDOS / ORDENES
-- ==========================================

-- 1. Tabla principal de Pedidos
CREATE TABLE IF NOT EXISTS public.pedido (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  store_id bigint NOT NULL,
  nombre_cliente text NOT NULL,
  whatsapp_cliente text NOT NULL,
  metodo_entrega text NOT NULL, -- 'pickup' (Retiro) o 'shipping' (Envío)
  direccion_entrega text,
  gps_url text,
  total_usd numeric(10, 2) NOT NULL,
  total_bs numeric(15, 2) NOT NULL,
  moneda_activa text NOT NULL, -- 'USD' o 'BS'
  estado text NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'preparando', 'completado', 'cancelado'
  CONSTRAINT pedido_pkey PRIMARY KEY (id),
  CONSTRAINT pedido_store_fkey FOREIGN KEY (store_id) REFERENCES public.store(id) ON DELETE CASCADE
);

-- 2. Tabla de Items / Productos del Pedido
CREATE TABLE IF NOT EXISTS public.pedido_item (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pedido_id bigint NOT NULL,
  producto_id bigint,
  nombre_producto text NOT NULL,
  cantidad integer NOT NULL,
  precio_unitario numeric(10, 2) NOT NULL,
  comentario text,
  opciones_seleccionadas jsonb, -- Guarda modificadores seleccionados en formato JSON: [{nombre: 'Mediana', modificador_precio: 2.50}]
  CONSTRAINT pedido_item_pkey PRIMARY KEY (id),
  CONSTRAINT pedido_item_pedido_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedido(id) ON DELETE CASCADE,
  CONSTRAINT pedido_item_producto_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id) ON DELETE SET NULL
);

-- ==========================================
-- SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==========================================

ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores para evitar errores de duplicidad
DROP POLICY IF EXISTS "Permitir lectura de pedidos a usuarios autenticados" ON public.pedido;
DROP POLICY IF EXISTS "Permitir lectura de items a usuarios autenticados" ON public.pedido_item;
DROP POLICY IF EXISTS "Permitir actualización de pedidos a usuarios autenticados" ON public.pedido;
DROP POLICY IF EXISTS "Permitir inserts públicos en pedido" ON public.pedido;
DROP POLICY IF EXISTS "Permitir inserts públicos en pedido_item" ON public.pedido_item;

-- Crear políticas de lectura y edición para dueños autenticados
CREATE POLICY "Permitir lectura de pedidos a usuarios autenticados" 
ON public.pedido 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir lectura de items a usuarios autenticados" 
ON public.pedido_item 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir actualización de pedidos a usuarios autenticados" 
ON public.pedido 
FOR UPDATE 
TO authenticated 
USING (true);

-- ==========================================
-- FUNCIÓN RPC PARA TRANSACCIONAR EL PEDIDO
-- ==========================================
-- Esta función corre con SECURITY DEFINER (bypass de RLS), permitiendo a
-- clientes anónimos crear un pedido completo en una sola transacción segura.

CREATE OR REPLACE FUNCTION public.crear_pedido(
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
  v_item json;
BEGIN
  -- 1. Insertar cabecera del pedido
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

  -- 2. Insertar cada uno de los items asociados
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pedido_item (
      pedido_id,
      producto_id,
      nombre_producto,
      cantidad,
      precio_unitario,
      comentario,
      opciones_seleccionadas
    ) VALUES (
      v_pedido_id,
      (v_item->>'producto_id')::bigint,
      v_item->>'nombre_producto',
      (v_item->>'cantidad')::integer,
      (v_item->>'precio_unitario')::numeric,
      v_item->>'comentario',
      (v_item->'opciones_seleccionadas')
    );
  END LOOP;

  RETURN v_pedido_id;
END;
$$;
