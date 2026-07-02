-- ============================================================
-- CORREÇÃO: reforça a política de leitura (RLS) da tabela supplies.
-- Sintoma: a compra é criada com sucesso (recibo é gerado), mas some
-- da listagem — indício de que a policy de SELECT por cnpj não está
-- aplicada corretamente nesta tabela.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplies_select" ON supplies;
DROP POLICY IF EXISTS "supplies_all" ON supplies;

CREATE POLICY "supplies_select" ON supplies FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "supplies_all" ON supplies FOR ALL TO authenticated USING (true);

-- ============================================================
-- Diagnóstico opcional — rode manualmente para conferir se a compra
-- que você acabou de criar está mesmo no banco e com qual cnpj:
--
-- SELECT id, cnpj, organization, created_at FROM supplies ORDER BY created_at DESC LIMIT 5;
-- SELECT id, email, cnpj FROM profiles WHERE email = 'SEU_EMAIL_AQUI';
-- ============================================================
