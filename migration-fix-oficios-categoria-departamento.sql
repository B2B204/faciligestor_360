-- ============================================================
-- Oficios: o formulario (OficioForm.jsx) e a listagem (Oficios.jsx)
-- usam campos de classificacao "category"/"department" (com filtro
-- e busca) que nunca existiram em "oficios". Adicionando as colunas
-- para preservar a funcionalidade existente.
-- ============================================================

ALTER TABLE oficios
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;
