-- ============================================================
-- Financeiro/DRE (Financial.jsx): o formulario de lancamento
-- financeiro (DRE detalhado por contrato/mes) usa dezenas de
-- campos que nunca existiram em "financial_entries" (a tabela
-- foi originalmente pensada como um razao generico linha-a-linha:
-- type/category/description/amount/date). Por decisao do usuario,
-- a correcao e ADICIONAR as colunas faltantes ao banco,
-- preservando a UI/logica existente.
-- ============================================================

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS reference_month TEXT,
  -- Receita
  ADD COLUMN IF NOT EXISTS gross_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_revenue NUMERIC(14,2) DEFAULT 0,
  -- Impostos/retencoes
  ADD COLUMN IF NOT EXISTS inss_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inss_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irrf_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irrf_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iss_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iss_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pis_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pis_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS csll_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS csll_value NUMERIC(14,2) DEFAULT 0,
  -- Conta vinculada
  ADD COLUMN IF NOT EXISTS linked_account_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linked_account_value NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculated_from TEXT DEFAULT 'percent',
  -- Custos operacionais
  ADD COLUMN IF NOT EXISTS payroll_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_charges_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs NUMERIC(14,2) DEFAULT 0,
  -- Materiais/insumos
  ADD COLUMN IF NOT EXISTS cleaning_products NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipment_tools NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uniforms_epis NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disposable_materials NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_materials NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_materials NUMERIC(14,2) DEFAULT 0,
  -- Totais/resultado
  ADD COLUMN IF NOT EXISTS total_costs NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_result NUMERIC(14,2) DEFAULT 0;

-- As colunas genericas (type/category/description/amount/date) nao sao
-- preenchidas pelo formulario de DRE detalhado; garantir que nao bloqueiem
-- o insert caso estejam como NOT NULL.
ALTER TABLE financial_entries ALTER COLUMN type DROP NOT NULL;
ALTER TABLE financial_entries ALTER COLUMN category DROP NOT NULL;
ALTER TABLE financial_entries ALTER COLUMN description DROP NOT NULL;
ALTER TABLE financial_entries ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE financial_entries ALTER COLUMN date DROP NOT NULL;
