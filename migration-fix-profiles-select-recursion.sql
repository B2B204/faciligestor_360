-- ============================================================
-- CORREÇÃO CRÍTICA: profiles_select causava recursão infinita
--
-- Causa raiz: a policy criada em
-- migration-fix-profiles-select-same-cnpj.sql consultava a
-- própria tabela "profiles" dentro do USING:
--
--   CREATE POLICY "profiles_select" ON profiles
--     FOR SELECT USING (
--       auth.uid() = id
--       OR cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
--     );
--
-- No Postgres, quando uma RLS policy referencia a própria tabela
-- que protege, a policy é reaplicada recursivamente à subquery,
-- gerando o erro:
--   "infinite recursion detected in policy for relation \"profiles\""
--
-- Isso quebrava TODA leitura de perfil após o login: o app tentava
-- carregar o perfil, recebia esse erro, tratava como "sessão
-- expirada" e redirecionava de volta para /login — que, ao
-- verificar a sessão (ainda válida), tentava navegar de volta para
-- a página original, causando um loop infinito de redirecionamento
-- (tela de login "carregando" sem nunca entrar).
--
-- A correção usa uma função SECURITY DEFINER (que ignora RLS) para
-- obter o CNPJ do usuário logado, evitando a autorreferência.
--
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem efeitos colaterais.)
-- ============================================================

CREATE OR REPLACE FUNCTION my_profile_cnpj()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cnpj FROM profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR cnpj = my_profile_cnpj()
  );

-- ============================================================
-- VERIFICAÇÃO: após rodar, confirme que a policy foi aplicada:
--
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'profiles' AND policyname = 'profiles_select';
--
-- Esperado: qual contendo 'my_profile_cnpj()'
--
-- Teste rápido (deve retornar sem erro de recursão):
-- SELECT * FROM profiles WHERE id = auth.uid();
-- ============================================================
