-- ============================================================
-- MIGRAÇÃO: Regras Fiscais (Fiscal Positions) — mapeamento automático
-- de impostos por tipo de operação/cliente, aplicado a Contas a Receber.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- ============================================================
-- 1. FISCAL_POSITIONS — regras de mapeamento de impostos
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_positions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  service_type          TEXT DEFAULT 'todos',   -- bate com contracts.service_type, ou 'todos'
  client_type           TEXT DEFAULT 'todos',   -- 'pj' | 'pf' | 'orgao_publico' | 'todos'
  is_default            BOOLEAN DEFAULT false,  -- usada quando nenhuma outra regra mais específica casar
  priority              INTEGER DEFAULT 100,    -- menor = avaliada primeiro
  rate_iss              NUMERIC(6,3) DEFAULT 0,
  rate_pis              NUMERIC(6,3) DEFAULT 0,
  rate_cofins           NUMERIC(6,3) DEFAULT 0,
  rate_csll             NUMERIC(6,3) DEFAULT 0,
  rate_inss             NUMERIC(6,3) DEFAULT 0,
  rate_irrf             NUMERIC(6,3) DEFAULT 0,
  retain_at_source      BOOLEAN DEFAULT false,  -- se true, os impostos calculados são retidos do valor a receber
  is_active             BOOLEAN DEFAULT true,
  notes                 TEXT,
  created_by            TEXT,
  updated_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_positions_cnpj ON fiscal_positions(cnpj);

-- ============================================================
-- 2. CONTRACTS — tipo de cliente, necessário para o mapeamento
-- ============================================================
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'pj';

-- ============================================================
-- 3. ACCOUNTS_RECEIVABLE — retenção calculada e rastreabilidade da regra
-- ============================================================
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS tax_retained_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS tax_breakdown        JSONB;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS fiscal_position_id   TEXT;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE fiscal_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_positions_select" ON fiscal_positions;
DROP POLICY IF EXISTS "fiscal_positions_all" ON fiscal_positions;
CREATE POLICY "fiscal_positions_select" ON fiscal_positions FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "fiscal_positions_all" ON fiscal_positions FOR ALL TO authenticated USING (true);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
