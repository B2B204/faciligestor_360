-- ============================================================
-- MIGRAÇÃO: Entrega de EPI — Certificado de Aprovação (CA) no
-- catálogo e termo de ciência (NR-6) na entrega.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS ca_number TEXT;

ALTER TABLE uniform_deliveries ADD COLUMN IF NOT EXISTS is_epi BOOLEAN DEFAULT false;
ALTER TABLE uniform_deliveries ADD COLUMN IF NOT EXISTS epi_acknowledgment BOOLEAN DEFAULT false;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
