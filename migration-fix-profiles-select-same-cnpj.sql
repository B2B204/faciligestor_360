-- ============================================================
-- CORREÇÃO: profiles_select não permitia que usuários da mesma
-- empresa (mesmo CNPJ) lessem os perfis uns dos outros.
--
-- Causa raiz: a policy original era:
--   CREATE POLICY "profiles_select" ON profiles
--     FOR SELECT USING (auth.uid() = id);
--
-- Isso fazia com que User.filter({ cnpj: '...' }) retornasse
-- apenas o próprio usuário, quebrando:
--   - Herança de plano (não-admin não via o plano do admin)
--   - Contagem de licenças (sempre = 1)
--   - Lista de membros da equipe
--   - Reconhecimentos (não exibia colegas)
--   - CRM/Deals (lista de responsáveis incompleta)
--   - Ofícios (mapa de nomes incompleto)
--
-- A correção permite leitura entre colegas do mesmo CNPJ.
-- A policy de UPDATE permanece inalterada (auth.uid() = id),
-- então ninguém pode alterar o perfil de outro usuário.
--
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem efeitos colaterais.)
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- VERIFICAÇÃO: após rodar, confirme que a policy foi aplicada:
--
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'profiles' AND policyname = 'profiles_select';
--
-- Esperado: cmd = 'SELECT', qual contendo 'cnpj IN (SELECT ...'
-- ============================================================
