-- ============================================================
-- MIGRAÇÃO: Alertas de vencimento/reajuste em camadas (30/60/90 dias)
-- e versionamento de contratos (histórico com diff).
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- ============================================================
-- 1. ALERTS — coluna de camada (30/60/90) para escalonar urgência
-- ============================================================
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tier       INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS due_date   DATE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- 2. CONTRACT_VERSIONS — histórico de alterações do contrato (diff)
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  changes         JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{field,label,old,new}]
  snapshot        JSONB,                              -- estado completo do contrato após a alteração
  change_summary  TEXT,
  changed_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_versions_contract_id ON contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_cnpj        ON contract_versions(cnpj);

ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_versions_select" ON contract_versions;
DROP POLICY IF EXISTS "contract_versions_all" ON contract_versions;
CREATE POLICY "contract_versions_select" ON contract_versions FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "contract_versions_all" ON contract_versions FOR ALL TO authenticated USING (true);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
