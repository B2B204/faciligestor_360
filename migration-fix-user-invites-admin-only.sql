-- ============================================================
-- CORREÇÃO CRÍTICA: "user_invites_all" (FOR ALL, herdada da
-- migration-fix-rls-isolamento-entre-empresas.sql) só exige
-- "cnpj IN (SELECT p.cnpj FROM profiles WHERE p.id = auth.uid())"
-- — ou seja, qualquer colaborador autenticado da empresa pode
-- INSERIR um convite com department = 'admin' para o e-mail que
-- quiser (inclusive um segundo e-mail próprio), sem qualquer
-- checagem de que quem está convidando já é admin.
--
-- A UI (UserInviteModal.jsx) esconde o botão de convite de quem
-- não é admin, mas isso é só client-side — a proteção real
-- precisa estar na RLS. Combinado com AcceptInvite.jsx (que
-- aceita o convite e vincula o department dele ao perfil), isso
-- permitia auto-provisionar uma conta admin sem aprovação.
--
-- Substitui a policy única "_all" por policies específicas:
-- SELECT/INSERT/UPDATE/DELETE exigem tanto o mesmo cnpj quanto
-- department = 'admin' de quem está autenticado. A leitura pública
-- do convite durante o aceite (usuário ainda sem sessão) continua
-- funcionando por validate_invite(), que já é SECURITY DEFINER e
-- não depende desta policy.
-- ============================================================

DROP POLICY IF EXISTS "user_invites_all" ON user_invites;
DROP POLICY IF EXISTS "user_invites_select" ON user_invites;
DROP POLICY IF EXISTS "user_invites_insert" ON user_invites;
DROP POLICY IF EXISTS "user_invites_update" ON user_invites;
DROP POLICY IF EXISTS "user_invites_delete" ON user_invites;

CREATE POLICY "user_invites_select" ON user_invites FOR SELECT TO authenticated
  USING (
    cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY "user_invites_insert" ON user_invites FOR INSERT TO authenticated
  WITH CHECK (
    cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY "user_invites_update" ON user_invites FOR UPDATE TO authenticated
  USING (
    cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

CREATE POLICY "user_invites_delete" ON user_invites FOR DELETE TO authenticated
  USING (
    cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
  );

-- AcceptInvite.jsx fazia "UserInvite.update(invite.id, {status:'aceito'})"
-- logo após o próprio usuário convidado (ainda não-admin) se autenticar —
-- isso quebraria sob a policy de UPDATE acima (ele não é admin do cnpj do
-- convite). Substituímos por uma função SECURITY DEFINER, no mesmo padrão
-- de validate_invite(): só marca "aceito" o convite cujo e-mail bate com o
-- do usuário autenticado, e só se ainda estiver "pendente".
CREATE OR REPLACE FUNCTION public.accept_invite(p_code TEXT)
RETURNS SETOF user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
BEGIN
  RETURN QUERY
    UPDATE user_invites
    SET status = 'aceito', updated_at = now()
    WHERE invite_code = p_code
      AND status = 'pendente'
      AND email = v_email
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

-- Conferir depois de rodar (não deve retornar nenhuma linha):
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename = 'user_invites' AND policyname = 'user_invites_all';
