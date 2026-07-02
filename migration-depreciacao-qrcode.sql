-- ============================================================
-- MIGRAÇÃO: Depreciação automática de ativos (linear/degressiva)
-- e código de rastreamento (QR Code) para o Patrimônio.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- ============================================================
-- 1. PATRIMONIES — parâmetros de depreciação + código de rastreamento
-- ============================================================
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS qr_code                    TEXT;
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS depreciation_method        TEXT DEFAULT 'none';
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS useful_life_months         INTEGER;
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS residual_value             NUMERIC(15,2) DEFAULT 0;
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS declining_balance_rate     NUMERIC(6,2);
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS accumulated_depreciation   NUMERIC(15,2) DEFAULT 0;
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS current_book_value         NUMERIC(15,2);
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS last_depreciation_month    TEXT;
ALTER TABLE patrimonies ADD COLUMN IF NOT EXISTS depreciation_indirect_cost_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patrimonies_cnpj_qr_code
  ON patrimonies(cnpj, qr_code) WHERE qr_code IS NOT NULL;

-- ============================================================
-- 2. PATRIMONY_DEPRECIATION_ENTRIES — lançamentos mensais (ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS patrimony_depreciation_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj               TEXT NOT NULL,
  patrimony_id       TEXT NOT NULL,
  competence_month   TEXT NOT NULL,
  method             TEXT,
  amount             NUMERIC(15,2) NOT NULL,
  accumulated_before NUMERIC(15,2),
  accumulated_after  NUMERIC(15,2),
  book_value_before  NUMERIC(15,2),
  book_value_after   NUMERIC(15,2),
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cnpj, patrimony_id, competence_month)
);

CREATE INDEX IF NOT EXISTS idx_patrimony_depr_entries_patrimony ON patrimony_depreciation_entries(patrimony_id);
CREATE INDEX IF NOT EXISTS idx_patrimony_depr_entries_cnpj      ON patrimony_depreciation_entries(cnpj);

ALTER TABLE patrimony_depreciation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patrimony_depreciation_entries_select" ON patrimony_depreciation_entries;
DROP POLICY IF EXISTS "patrimony_depreciation_entries_all" ON patrimony_depreciation_entries;
CREATE POLICY "patrimony_depreciation_entries_select" ON patrimony_depreciation_entries FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "patrimony_depreciation_entries_all" ON patrimony_depreciation_entries FOR ALL TO authenticated USING (true);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
