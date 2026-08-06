-- ======================================================
-- ESTRUCTURA DE TABLAS PARA PROMOCIONES Y DESCUENTOS POR SKU/VOLUMEN
-- ======================================================

-- 1. Tabla Principal de Promociones (Cabecera de Campaña o Regla)
CREATE TABLE IF NOT EXISTS public.promocion (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  store_id bigint NOT NULL,
  nombre text NOT NULL,                      -- Ej: 'Descuento por Volumen RTR', 'Especial Día del Padre'
  descripcion text,                          -- Ej: 'Descuentos especiales por la compra de más de 10 unidades'
  tipo text NOT NULL DEFAULT 'volumen',       -- 'volumen', 'campana'
  fecha_inicio timestamp with time zone,     -- Inicio de vigencia (opcional)
  fecha_fin timestamp with time zone,        -- Fin de vigencia (opcional)
  prioridad integer NOT NULL DEFAULT 0,      -- Prioridad en caso de varias promos (mayor entero = mayor prioridad)
  es_acumulable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT promocion_pkey PRIMARY KEY (id),
  CONSTRAINT promocion_store_fkey FOREIGN KEY (store_id) REFERENCES public.store(id) ON DELETE CASCADE
);

-- 2. Tabla Detalle de Reglas por SKU / Categoría / Cantidad
CREATE TABLE IF NOT EXISTS public.promocion_regla (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  promocion_id bigint NOT NULL,
  sku text,                                  -- Código SKU específico (ej: 'RTR-044-RE')
  category_id bigint,                        -- Opcional: ID de categoría si aplica a toda la categoría
  cantidad_minima integer NOT NULL DEFAULT 1, -- Cantidad mínima para aplicar el escalón (ej: 10, 20)
  cantidad_maxima integer,                   -- Cantidad máxima (ej: 19) o NULL si no tiene límite superior
  tipo_descuento text NOT NULL,              -- 'porcentaje' (ej: 10 = 10% off) o 'monto_fijo' (ej: 2.50 = $2.50 off)
  valor_descuento numeric(10, 2) NOT NULL,   -- Valor del porcentaje o monto fijo en USD
  CONSTRAINT promocion_regla_pkey PRIMARY KEY (id),
  CONSTRAINT promocion_regla_promocion_fkey FOREIGN KEY (promocion_id) REFERENCES public.promocion(id) ON DELETE CASCADE,
  CONSTRAINT promocion_regla_category_fkey FOREIGN KEY (category_id) REFERENCES public.category(id) ON DELETE SET NULL
);

-- Indexación para optimizar consultas rápidas por SKU y tienda
CREATE INDEX IF NOT EXISTS idx_promocion_store ON public.promocion(store_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promocion_regla_sku ON public.promocion_regla(sku);
CREATE INDEX IF NOT EXISTS idx_promocion_regla_promo ON public.promocion_regla(promocion_id);

-- RLS (Row Level Security)
ALTER TABLE public.promocion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocion_regla ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de promociones a publico" ON public.promocion;
DROP POLICY IF EXISTS "Permitir lectura de reglas a publico" ON public.promocion_regla;
DROP POLICY IF EXISTS "Permitir edicion de promociones a usuarios autenticados" ON public.promocion;
DROP POLICY IF EXISTS "Permitir edicion de reglas a usuarios autenticados" ON public.promocion_regla;

CREATE POLICY "Permitir lectura de promociones a publico"
ON public.promocion FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Permitir lectura de reglas a publico"
ON public.promocion_regla FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir edicion de promociones a usuarios autenticados"
ON public.promocion FOR ALL TO authenticated USING (true);

CREATE POLICY "Permitir edicion de reglas a usuarios autenticados"
ON public.promocion_regla FOR ALL TO authenticated USING (true);

-- ======================================================
-- DATOS DE EJEMPLO / DEMO DE DÍA DEL PADRE Y VOLUMEN POR SKU
-- ======================================================
-- Reemplazar el store_id '1' con el ID de tu tienda en Supabase:

/*
-- Demo 1: Promo Volumen por SKU (10 unidades -> 10%, 20 unidades -> 15%)
INSERT INTO public.promocion (store_id, nombre, descripcion, tipo, is_active)
VALUES (1, 'Descuento por Volumen SKU RTR-044-RE', 'Descuento escalonado al comprar al mayor', 'volumen', true);

-- Supongamos que el ID insertado de promocion es 1:
INSERT INTO public.promocion_regla (promocion_id, sku, cantidad_minima, cantidad_maxima, tipo_descuento, valor_descuento)
VALUES 
(1, 'RTR-044-RE', 10, 19, 'porcentaje', 10.00),
(1, 'RTR-044-RE', 20, NULL, 'porcentaje', 15.00);

-- Demo 2: Campaña Día del Padre (Aplica 20% de descuento a un SKU del 1 al 21 de Junio)
INSERT INTO public.promocion (store_id, nombre, descripcion, tipo, fecha_inicio, fecha_fin, is_active)
VALUES (1, 'Campaña Día del Padre', 'Descuento especial por el mes de los padres', 'campana', '2026-06-01 00:00:00+00', '2026-06-21 23:59:59+00', true);

INSERT INTO public.promocion_regla (promocion_id, sku, cantidad_minima, tipo_descuento, valor_descuento)
VALUES (2, 'PADRE-SKU-01', 1, 'porcentaje', 20.00);
*/
