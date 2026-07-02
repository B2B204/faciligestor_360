-- ============================================================
-- CORREÇÃO: a coluna "id" da tabela supplies está sem valor padrão
-- (gen_random_uuid()), causando o erro:
--   null value in column "id" of relation "supplies" violates not-null constraint
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- Garante que a extensão que fornece gen_random_uuid() está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE supplies ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Colunas usadas pela tela de Compras que podem estar faltando (idempotente)
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS hide_values_on_receipt BOOLEAN DEFAULT false;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nf_imports             JSONB DEFAULT '[]';
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nf_number               TEXT DEFAULT '';
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nf_series               TEXT DEFAULT '';
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nf_access_key           TEXT DEFAULT '';
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS nf_issue_date           DATE;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS receipt_id              TEXT DEFAULT '';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
