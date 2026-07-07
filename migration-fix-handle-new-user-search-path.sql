-- ============================================================
-- CORREÇÃO CRÍTICA: o trigger "on_auth_user_created" (função
-- handle_new_user) que cria a linha em "profiles" para todo
-- usuário novo estava falhando silenciosamente.
--
-- Causa: a role "supabase_auth_admin" (usada pelo GoTrue/Supabase
-- Auth para inserir em auth.users) tem search_path=auth fixado a
-- nível de role. Como a função era SECURITY DEFINER mas não fixava
-- seu próprio search_path, ao rodar disparada por essa role ela
-- também herdava search_path=auth — então "INSERT INTO profiles"
-- (sem qualificar o schema) tentava inserir dentro do schema
-- "auth", falhava com "relation profiles does not exist", e o
-- EXCEPTION WHEN OTHERS engolia o erro silenciosamente. Resultado:
-- o usuário conseguia se cadastrar/aceitar convite normalmente,
-- mas nunca ganhava uma linha em "profiles" — logo nunca tinha
-- cnpj, e tudo que ele cadastrava ficava com cnpj NULL, invisível
-- para os colegas de empresa (e para ele mesmo, via RLS).
--
-- Foi assim que aconteceu com maria.moura@gpsfacility.com e
-- saullo.souza@gpsfacility.com — corrigido manualmente via backfill
-- em 2026-07-07, mas o trigger precisa ficar corrigido para não
-- repetir com o próximo convite aceito.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cnpj, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'cnpj',
    COALESCE(NEW.raw_user_meta_data->>'department', 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não engolir mais o erro em silêncio: fica registrado nos logs
  -- do Postgres (Supabase Dashboard > Logs > Postgres Logs).
  RAISE WARNING 'handle_new_user falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill (idempotente): cria a linha em profiles para qualquer
-- usuário de auth.users que ainda não tenha uma, usando o cnpj/nome
-- salvos nos metadados do signup.
INSERT INTO public.profiles (id, email, full_name, cnpj, department)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.email),
       u.raw_user_meta_data->>'cnpj',
       COALESCE(u.raw_user_meta_data->>'department', 'admin')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Conferir depois de rodar:
-- SELECT u.email, p.id IS NOT NULL AS tem_profile, p.cnpj
-- FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id;
