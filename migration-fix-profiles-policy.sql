-- ============================================================
-- CORREÇÃO: Política de leitura da tabela profiles (evita loop de login)
--
-- Execute este script no SQL Editor do painel do Supabase
-- (https://supabase.com/dashboard/project/_/sql)
-- ============================================================

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

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR cnpj = my_profile_cnpj()
  );
