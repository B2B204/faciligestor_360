-- ============================================================
-- O supabase-schema.sql original criava policies permissivas
-- "cnpj_access_requests_all" e "user_cnpj_access_all" (FOR ALL
-- USING (true)) nessas duas tabelas. A migration posterior
-- (migration-fix-rls-cnpj-access-requests.sql), que restringe o
-- fluxo para exigir aprovação de admin, criou policies mais
-- específicas mas NUNCA removeu essas antigas — e no Postgres,
-- policies permissivas se combinam com OR, então a policy antiga
-- "USING (true)" continuava valendo por cima de tudo: qualquer
-- usuário autenticado ainda conseguia se autoconceder acesso a
-- qualquer CNPJ inserindo direto em user_cnpj_access (ex.: via
-- console do navegador), sem passar pela aprovação do admin.
-- Removendo as policies antigas para que só as restritas valham.
-- ============================================================

DROP POLICY IF EXISTS "cnpj_access_requests_all" ON cnpj_access_requests;
DROP POLICY IF EXISTS "user_cnpj_access_all" ON user_cnpj_access;

-- cnpj_access_requests nunca teve uma policy de DELETE própria (só
-- dependia da "_all" permissiva acima, agora removida) — sem isso o
-- admin não conseguiria mais limpar solicitações duplicadas/antigas
-- pela tela de Configurações da Empresa.
DROP POLICY IF EXISTS cnpj_access_requests_delete ON cnpj_access_requests;
CREATE POLICY cnpj_access_requests_delete ON cnpj_access_requests
  FOR DELETE TO authenticated
  USING (
    requester_email = (auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

-- Conferir depois de rodar (não deve retornar nenhuma linha):
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename IN ('cnpj_access_requests', 'user_cnpj_access')
--   AND policyname LIKE '%_all';
