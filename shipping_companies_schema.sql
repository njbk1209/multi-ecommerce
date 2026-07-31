-- ==========================================
-- ESTRUCTURA DE TABLAS PARA COMPAÑÍAS DE ENVÍO
-- ==========================================

-- 1. Tabla de Compañías de Envío (Afiliación)
CREATE TABLE IF NOT EXISTS public.compania_envio (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  store_id bigint NOT NULL,
  nombre text NOT NULL,
  contacto text,
  telefono text,
  activa boolean NOT NULL DEFAULT true,
  CONSTRAINT compania_envio_pkey PRIMARY KEY (id),
  CONSTRAINT compania_envio_store_fkey FOREIGN KEY (store_id) REFERENCES public.store(id) ON DELETE CASCADE
);

-- 2. Alteración de la tabla pedido para vincular la empresa transportista
ALTER TABLE public.pedido 
  ADD COLUMN IF NOT EXISTS compania_envio_id bigint REFERENCES public.compania_envio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compania_envio_nombre text;

-- ==========================================
-- SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==========================================

ALTER TABLE public.compania_envio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de companias a usuarios autenticados" ON public.compania_envio;
DROP POLICY IF EXISTS "Permitir insercion y edicion de companias a usuarios autenticados" ON public.compania_envio;

CREATE POLICY "Permitir lectura de companias a usuarios autenticados" 
ON public.compania_envio 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insercion y edicion de companias a usuarios autenticados" 
ON public.compania_envio 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
