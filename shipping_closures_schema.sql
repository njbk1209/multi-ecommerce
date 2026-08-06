-- ======================================================
-- ESTRUCTURA SQL PARA DATOS DE PAGO MÓVIL Y CIERRES DE ENVÍO
-- Ejecuta estas sentencias en el SQL Editor de Supabase
-- ======================================================

-- 1. Extensión de la tabla 'compania_envio' para registrar los datos bancarios / Pago Móvil de la empresa
ALTER TABLE public.compania_envio
ADD COLUMN IF NOT EXISTS banco text,
ADD COLUMN IF NOT EXISTS cedula_rif text,
ADD COLUMN IF NOT EXISTS telefono_pago_movil text;

-- 2. Creación de la tabla 'cierre_envio' para los reportes de cierres y pagos de viajes
CREATE TABLE IF NOT EXISTS public.cierre_envio (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  store_id bigint NOT NULL,
  compania_envio_id bigint NOT NULL,
  compania_envio_nombre text NOT NULL,
  fecha_cierre timestamp with time zone NOT NULL DEFAULT now(),
  total_viajes integer NOT NULL DEFAULT 0,
  monto_total_usd numeric(10, 2) NOT NULL DEFAULT 0.00,
  monto_total_bs numeric(12, 2) NOT NULL DEFAULT 0.00,
  tasa_cambio numeric(10, 2) NOT NULL DEFAULT 1.00,
  banco_pago text,
  cedula_rif_pago text,
  telefono_pago text,
  comprobante_url text,
  estado text NOT NULL DEFAULT 'pagado', -- 'pendiente', 'pagado'
  pedidos_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  pedidos_resumen jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT cierre_envio_pkey PRIMARY KEY (id),
  CONSTRAINT cierre_envio_store_fkey FOREIGN KEY (store_id) REFERENCES public.store(id) ON DELETE CASCADE,
  CONSTRAINT cierre_envio_compania_fkey FOREIGN KEY (compania_envio_id) REFERENCES public.compania_envio(id) ON DELETE CASCADE
);

-- Indexación para optimizar consultas de cierres por tienda y compañía
CREATE INDEX IF NOT EXISTS idx_cierre_envio_store ON public.cierre_envio(store_id);
CREATE INDEX IF NOT EXISTS idx_cierre_envio_compania ON public.cierre_envio(compania_envio_id);

-- RLS (Row Level Security)
ALTER TABLE public.cierre_envio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de cierres de envio" ON public.cierre_envio;
DROP POLICY IF EXISTS "Permitir edicion de cierres de envio a usuarios autenticados" ON public.cierre_envio;

CREATE POLICY "Permitir lectura de cierres de envio"
ON public.cierre_envio FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir edicion de cierres de envio a usuarios autenticados"
ON public.cierre_envio FOR ALL TO authenticated USING (true);
