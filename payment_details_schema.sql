-- ======================================================
-- ESTRUCTURA SQL PARA REGISTRO DE DETALLES Y COMPROBANTES DE PAGO EN PEDIDOS
-- Ejecuta estas sentencias en el SQL Editor de Supabase
-- ======================================================

-- 1. Agregar columna 'detalles_pago' de tipo jsonb a la tabla 'pedido'
ALTER TABLE public.pedido
ADD COLUMN IF NOT EXISTS detalles_pago jsonb DEFAULT '{}'::jsonb;

-- 2. Crear índice GIN para optimizar consultas de búsquedas por método de pago o referencia
CREATE INDEX IF NOT EXISTS idx_pedido_detalles_pago ON public.pedido USING GIN (detalles_pago);
