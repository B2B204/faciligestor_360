-- ============================================================
-- As policies criadas em migration-fix-rls-cnpj-access-requests.sql
-- usam "(SELECT email FROM auth.users WHERE id = auth.uid())" para
-- comparar o e-mail do usuário logado. A role "authenticated" não
-- tem GRANT SELECT na tabela auth.users (Supabase não concede isso
-- por padrão), então QUALQUER consulta que avalie essas policies
-- falha com "permission denied for table users" — para todo mundo,
-- admin ou não. Isso quebra: solicitar acesso a CNPJ, listar os
-- próprios acessos concedidos (CnpjSwitcher) e, por consequência,
-- todo o fluxo de cadastro/troca de múltiplos CNPJs.
--
-- Corrigido usando auth.jwt() ->> 'email', que lê o e-mail
-- diretamente do JWT da sessão sem precisar consultar auth.users.
-- ============================================================

DROP POLICY IF EXISTS cnpj_access_requests_select ON cnpj_access_requests;
DROP POLICY IF EXISTS cnpj_access_requests_insert ON cnpj_access_requests;

CREATE POLICY cnpj_access_requests_select ON cnpj_access_requests
  FOR SELECT TO authenticated
  USING (
    requester_email = (auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY cnpj_access_requests_insert ON cnpj_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS user_cnpj_access_select ON user_cnpj_access;

CREATE POLICY user_cnpj_access_select ON user_cnpj_access
  FOR SELECT TO authenticated
  USING (
    user_email = (auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

-- cnpj_access_requests_update, user_cnpj_access_insert e
-- user_cnpj_access_delete já usavam apenas "profiles" (sem tocar em
-- auth.users) e continuam corretas como estão.
