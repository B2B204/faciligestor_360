-- ============================================================
-- Uniformes - Controle de Estoque: o frontend (UniformForm,
-- aba "Controle de Estoque" em Uniforms.jsx) usa campos de
-- quantidade/estoque minimo/localizacao que nunca existiram em
-- "uniforms". Por decisao do usuario, a correcao e ADICIONAR as
-- colunas faltantes ao banco, preservando a UI/logica existente.
-- ============================================================

ALTER TABLE uniforms
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_location TEXT;
