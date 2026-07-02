-- ============================================================
-- CENTROS DE CUSTO
-- Cadastro de centros de custo (filial, obra, projeto, contrato,
-- setor etc.) para classificar despesas em Contas a Pagar.
-- ============================================================

CREATE TABLE IF NOT EXISTS cost_centers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_by  TEXT,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_cnpj ON cost_centers(cnpj);

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_centers_select ON cost_centers;
DROP POLICY IF EXISTS cost_centers_all ON cost_centers;

CREATE POLICY cost_centers_select ON cost_centers FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY cost_centers_all ON cost_centers FOR ALL TO authenticated USING (true);

-- Vincula a despesa (Contas a Pagar) ao centro de custo.
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS cost_center_id TEXT;
