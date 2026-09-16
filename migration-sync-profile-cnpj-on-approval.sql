-- ============================================================
-- CORREÇÃO: usuários que entram por "solicitação aprovada"
-- (CompanySettings.jsx / Profile.jsx handleApproveCnpjRequest)
-- tinham criadas as linhas em team_members e user_cnpj_access, mas
-- o profile.cnpj em profiles NUNCA era atualizado para o CNPJ
-- aprovado. Consequências:
--
--   1) RLS falha: profiles_select usa my_profile_cnpj() (lê do
--      profile) — se profile.cnpj for NULL ou outro CNPJ, o usuário
--      não vê os colegas do mesmo CNPJ.
--   2) getCurrentUserCnpj() (entity.js) lê do profile, então dados
--      criados por esse usuário vão para o CNPJ antigo.
--   3) O CnpjSwitcher mostra o CNPJ antigo como "selecionado".
--
-- O trigger prevent_profile_privilege_escalation já permite
-- atualizar profile.cnpj quando há acesso aprovado em
-- user_cnpj_access, mas o frontend não estava chamando essa
-- atualização. Esta migration adiciona uma função SECURITY DEFINER
-- que o frontend pode chamar para sincronizar o profile após a
-- aprovação, sem precisar de permissão de UPDATE direta (RLS).
-- ============================================================

CREATE OR REPLACE FUNCTION sync_profile_cnpj_on_approval(p_email text, p_cnpj text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET cnpj = p_cnpj, updated_at = now()
  WHERE email = p_email
    AND (cnpj IS NULL OR cnpj <> p_cnpj);
END;
$$;