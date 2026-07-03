-- ============================================================
-- CnpjSwitcher permitia qualquer usuario autenticado se
-- auto-atribuir a qualquer CNPJ ativo do sistema (falha de
-- controle de acesso entre empresas). Restauramos o fluxo de
-- solicitacao/aprovacao (cnpj_access_requests -> user_cnpj_access)
-- e garantimos RLS adequada nas duas tabelas:
--   - cnpj_access_requests: usuario ve/cria as proprias
--     solicitacoes; somente admin ve todas e aprova/rejeita.
--   - user_cnpj_access: usuario ve os proprios acessos concedidos
--     (necessario para o CnpjSwitcher funcionar); somente admin
--     concede (insere) ou revoga (remove) acesso.
-- ============================================================

DROP POLICY IF EXISTS cnpj_access_requests_select ON cnpj_access_requests;
DROP POLICY IF EXISTS cnpj_access_requests_insert ON cnpj_access_requests;
DROP POLICY IF EXISTS cnpj_access_requests_update ON cnpj_access_requests;

CREATE POLICY cnpj_access_requests_select ON cnpj_access_requests
  FOR SELECT TO authenticated
  USING (
    requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY cnpj_access_requests_insert ON cnpj_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY cnpj_access_requests_update ON cnpj_access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin'));

DROP POLICY IF EXISTS user_cnpj_access_select ON user_cnpj_access;
DROP POLICY IF EXISTS user_cnpj_access_insert ON user_cnpj_access;
DROP POLICY IF EXISTS user_cnpj_access_delete ON user_cnpj_access;

CREATE POLICY user_cnpj_access_select ON user_cnpj_access
  FOR SELECT TO authenticated
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY user_cnpj_access_insert ON user_cnpj_access
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin'));

CREATE POLICY user_cnpj_access_delete ON user_cnpj_access
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin'));
