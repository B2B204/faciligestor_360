-- ============================================================
-- CRM (Leads): o frontend usa "assigned_to" para a feature de
-- "so ver meus leads" e "converted_to_deal"/"deal_id" para nao
-- duplicar a conversao de um lead em negocio. Nenhuma dessas
-- colunas existe em "leads" hoje. Por decisao do usuario, a
-- correcao e ADICIONAR as colunas faltantes ao banco, preservando
-- a UI/logica existente.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS converted_to_deal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_id TEXT;
