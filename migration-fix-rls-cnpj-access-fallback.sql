-- ============================================================
-- CORREÇÃO: usuários "sem informação" mesmo pertencendo ao mesmo CNPJ
--
-- Relatado: alguns usuários com acesso aprovado a um CNPJ (mesmo CNPJ
-- dos demais) não viam absolutamente nada do sistema. A causa raiz é
-- que as políticas RLS de dados de negócio filtram por
--   cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
-- e my_profile_cnpj() lê apenas profiles.cnpj. Quando um perfil tem
-- cnpj vazio/NULL (cadastro legado, onboarding incompleto ou falha de
-- sync_profile_cnpj_on_approval), a subquery não retorna nada e o
-- usuário fica cego para todos os dados — mesmo com acesso aprovado em
-- user_cnpj_access.
--
-- Correção em três partes:
--   1) my_profile_cnpj() agora cai em user_cnpj_access quando o
--      profile.cnpj estiver vazio (acesso já aprovado é tão válido
--      quanto o profile.cnpj).
--   2) user_cnpj_access_select inclui a coluna cnpj (já tinha) —
--      sem garantia de que a coluna exista, o CnpjSwitcher e o
--      backfill não funcionam.
--   3) Backfill: preenche profiles.cnpj para quem tem acesso aprovado
--      em user_cnpj_access e ainda não tem cnpj no perfil, e cria
--      team_members ausentes para todos os perfis que têm cnpj.
-- ============================================================

-- 1) my_profile_cnpj(): fallback para user_cnpj_access
CREATE OR REPLACE FUNCTION my_profile_cnpj()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()),
    (SELECT u.cnpj FROM user_cnpj_access u
     WHERE u.user_email = (SELECT p.email FROM profiles p WHERE p.id = auth.uid())
     ORDER BY u.created_at
     LIMIT 1)
  );
$$;

-- 2) Garante que user_cnpj_access tenha a coluna cnpj (pode faltar em
--    instâncias antigas que criaram a tabela sem ela).
ALTER TABLE user_cnpj_access ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 3) Backfill: sincroniza profiles.cnpj a partir de acessos aprovados
--    (quem já tem acesso mas o perfil ficou sem cnpj).
UPDATE profiles p
SET cnpj = u.cnpj
FROM user_cnpj_access u
WHERE p.email = u.user_email
  AND (p.cnpj IS NULL OR btrim(p.cnpj) = '');

-- 4) Backfill: team_members ausentes para qualquer perfil que já tem cnpj
--    (idempotente — o migration-backfill-team-members.sql já faz isso
--    para profiles com cnpj, mas repetimos aqui para cobrir o caso em
--    que o profile.cnpj foi preenchido no passo acima).
INSERT INTO team_members (cnpj, full_name, email, department, status, created_by)
SELECT
  p.cnpj,
  COALESCE(p.full_name, p.email),
  p.email,
  COALESCE(NULLIF(p.department, ''), 'operador'),
  'ativo',
  'backfill-cnpj-fallback'
FROM profiles p
WHERE p.cnpj IS NOT NULL
  AND p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.cnpj = p.cnpj AND tm.email = p.email
  );

-- Conferir depois de rodar:
-- SELECT id, email, department, cnpj FROM profiles
-- WHERE department = 'admin' AND (cnpj IS NULL OR btrim(cnpj) = '');