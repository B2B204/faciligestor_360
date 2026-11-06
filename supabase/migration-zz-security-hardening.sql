-- ============================================================
-- migration-zz-security-hardening.sql
--
-- Endurecimento final de segurança multiempresa. Rode DEPOIS de todo o
-- supabase-schema.sql e de qualquer outra migration. O prefixo "zz" é
-- proposital: as migrations são concatenadas em ordem alfabética, e foi
-- exatamente essa ordem que fez uma migration antiga desfazer o
-- isolamento entre empresas. Esta deve ser sempre a última.
--
-- Idempotente: pode ser executada várias vezes.
-- Substitui supabase/migration-harden-multitenant-rls.sql (que cobria só
-- parte das tabelas e não tratava cadastro, admin e storage).
--
-- Corrige:
--   1. Cadastro novo herdava cnpj/department dos metadados do signUp
--      (qualquer pessoa entrava em qualquer empresa como admin).
--   2. "Admin" valia para todas as empresas: um admin de A concedia a si
--      mesmo acesso a B (user_cnpj_access, cnpj_access_requests,
--      sync_profile_cnpj_on_approval).
--   3. Policies "FOR ALL USING (true)" que liberavam leitura/escrita de
--      qualquer empresa (contracts, supplies, OS, RH, budgets...).
--   4. company_cnpjs editável/apagável por qualquer usuário.
--   5. Escrita sem checagem de departamento (comercial editando salários).
--   6. Bucket "uploads": qualquer usuário sobrescrevia/apagava arquivos
--      de outras empresas.
--   7. Convite expirado ainda dava acesso; profiles_insert sem limite.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Funções auxiliares
-- ------------------------------------------------------------

-- E-mail do usuário autenticado, sempre em minúsculas.
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(COALESCE(
    (SELECT p.email FROM profiles p WHERE p.id = auth.uid()),
    auth.jwt() ->> 'email'
  ));
$$;

-- O usuário pertence à empresa (CNPJ ativo no perfil ou acesso aprovado)?
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_cnpj IS NOT NULL AND (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.cnpj = p_cnpj)
    OR EXISTS (
      SELECT 1 FROM user_cnpj_access u
      WHERE lower(u.user_email) = public.current_user_email() AND u.cnpj = p_cnpj
    )
  );
$$;

-- O usuário é admin DESTA empresa? (department global = 'admin' E vínculo
-- com o CNPJ). Antes bastava department = 'admin', o que valia para todas.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.department = 'admin')
     AND public.is_tenant_member(p_cnpj);
$$;

-- Existe convite pendente e dentro da validade para este e-mail/CNPJ/departamento?
CREATE OR REPLACE FUNCTION public.has_valid_invite(p_email text, p_cnpj text, p_department text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_invites i
    WHERE lower(i.email) = lower(p_email)
      AND i.cnpj = p_cnpj
      AND i.department IS NOT DISTINCT FROM p_department
      AND i.status = 'pendente'
      AND (i.expires_at IS NULL OR i.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_valid_invite(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_invite(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 1. Cadastro: nunca confiar nos metadados do signUp
-- ------------------------------------------------------------
-- O perfil nasce sem empresa. Ele só ganha CNPJ por:
--   a) convite válido (AcceptInvite → trigger abaixo confere o convite), ou
--   b) registro de um CNPJ ainda não usado (register_company_cnpj).
-- department = 'admin' sem CNPJ não dá acesso a nada: toda checagem de
-- admin agora exige vínculo com o CNPJ (is_tenant_admin).
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
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    NULL,
    'admin'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. Perfil: troca de cnpj/department só por fluxo legítimo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj IS DISTINCT FROM OLD.cnpj OR NEW.department IS DISTINCT FROM OLD.department THEN

    -- Convite pendente, dentro da validade, batendo com os novos valores
    IF public.has_valid_invite(OLD.email, NEW.cnpj, NEW.department) THEN
      RETURN NEW;
    END IF;

    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Alteração de department não permitida fora do fluxo de convite';
    END IF;

    -- Troca de CNPJ exige acesso já aprovado
    IF NOT EXISTS (
      SELECT 1 FROM user_cnpj_access
      WHERE lower(user_email) = lower(OLD.email) AND cnpj = NEW.cnpj
    ) THEN
      RAISE EXCEPTION 'Troca de CNPJ não permitida: acesso não aprovado para %', NEW.cnpj;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- INSERT direto no próprio perfil (fallback do front quando o trigger de
-- signup falha): sem CNPJ, ou com o CNPJ/departamento de um convite válido.
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (
      (cnpj IS NULL AND COALESCE(department, 'admin') = 'admin')
      OR public.has_valid_invite(auth.jwt() ->> 'email', cnpj, department)
    )
  );

-- ------------------------------------------------------------
-- 3. Convites
-- ------------------------------------------------------------
-- accept_invite passa a respeitar a validade do convite.
CREATE OR REPLACE FUNCTION public.accept_invite(p_code TEXT)
RETURNS SETOF user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    UPDATE user_invites
    SET status = 'aceito', updated_at = now()
    WHERE invite_code = p_code
      AND status = 'pendente'
      AND lower(email) = lower(auth.jwt() ->> 'email')
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING *;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

-- Código de convite gerado no servidor quando o front não mandar um.
ALTER TABLE user_invites
  ALTER COLUMN invite_code SET DEFAULT ('INV-' || upper(replace(gen_random_uuid()::text, '-', '')));

-- Convite sem validade passa a valer 7 dias por padrão.
ALTER TABLE user_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- ------------------------------------------------------------
-- 4. Registro de CNPJ novo (substitui o "auto-conceder" do front)
-- ------------------------------------------------------------
-- Um admin pode registrar um CNPJ que AINDA NÃO pertence a ninguém no
-- sistema. Se o CNPJ já tem dono, é preciso pedir acesso (fica pendente
-- até um admin daquela empresa aprovar).
CREATE OR REPLACE FUNCTION public.register_company_cnpj(
  p_cnpj text,
  p_display_name text DEFAULT NULL,
  p_notify_accounting boolean DEFAULT true
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_department text;
  v_current_cnpj text;
  v_cnpj text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF length(v_cnpj) <> 14 THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;

  SELECT lower(email), department, cnpj INTO v_email, v_department, v_current_cnpj
    FROM profiles WHERE id = v_uid FOR UPDATE;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Perfil do usuário não encontrado'; END IF;
  IF v_department IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Somente administradores podem registrar um CNPJ';
  END IF;

  -- Já é meu: nada a fazer além de garantir as linhas auxiliares.
  IF NOT public.is_tenant_member(v_cnpj) THEN
    -- Tem dono? Então não pode ser registrado por outra pessoa.
    IF EXISTS (SELECT 1 FROM profiles WHERE cnpj = v_cnpj)
       OR EXISTS (SELECT 1 FROM user_cnpj_access WHERE cnpj = v_cnpj)
       OR EXISTS (SELECT 1 FROM company_cnpjs WHERE cnpj = v_cnpj)
    THEN
      RAISE EXCEPTION 'CNPJ_JA_REGISTRADO'
        USING HINT = 'Este CNPJ já pertence a outra conta. Solicite acesso a um administrador dela.';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_cnpj_access WHERE lower(user_email) = v_email AND cnpj = v_cnpj) THEN
    INSERT INTO user_cnpj_access (user_email, cnpj) VALUES (v_email, v_cnpj);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM company_cnpjs WHERE cnpj = v_cnpj) THEN
    INSERT INTO company_cnpjs (cnpj, display_name, is_active, notify_accounting, created_by)
    VALUES (v_cnpj, p_display_name, true, COALESCE(p_notify_accounting, true), v_email);
  END IF;

  -- Primeiro CNPJ da conta vira o ativo.
  IF v_current_cnpj IS NULL OR btrim(v_current_cnpj) = '' THEN
    UPDATE profiles SET cnpj = v_cnpj, updated_at = now() WHERE id = v_uid;
  END IF;

  RETURN v_cnpj;
END;
$$;

REVOKE ALL ON FUNCTION public.register_company_cnpj(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_company_cnpj(text, text, boolean) TO authenticated;

-- Aprovação de acesso: só admin DA empresa do CNPJ.
CREATE OR REPLACE FUNCTION public.sync_profile_cnpj_on_approval(p_email text, p_cnpj text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_cnpj text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_admin(v_target_cnpj) THEN
    RAISE EXCEPTION 'Somente administradores desta empresa podem aprovar acesso ao CNPJ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_cnpj_access
    WHERE lower(user_email) = lower(p_email) AND cnpj = v_target_cnpj
  ) THEN
    RAISE EXCEPTION 'Acesso ao CNPJ ainda não foi concedido';
  END IF;

  UPDATE profiles
  SET cnpj = v_target_cnpj, updated_at = now()
  WHERE lower(email) = lower(p_email)
    AND (cnpj IS NULL OR btrim(cnpj) = '');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_cnpj_on_approval(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_cnpj_on_approval(text, text) TO authenticated;

-- ------------------------------------------------------------
-- 5. Tabelas de controle de acesso (policies refeitas do zero)
-- ------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_cnpj_access', 'cnpj_access_requests', 'company_cnpjs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE user_cnpj_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnpj_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_cnpjs        ENABLE ROW LEVEL SECURITY;

-- user_cnpj_access: vejo os meus acessos; admin da empresa vê/gerencia os dela.
CREATE POLICY user_cnpj_access_select ON user_cnpj_access FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_user_email() OR public.is_tenant_admin(cnpj));
CREATE POLICY user_cnpj_access_insert ON user_cnpj_access FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(cnpj));
CREATE POLICY user_cnpj_access_update ON user_cnpj_access FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(cnpj)) WITH CHECK (public.is_tenant_admin(cnpj));
CREATE POLICY user_cnpj_access_delete ON user_cnpj_access FOR DELETE TO authenticated
  USING (public.is_tenant_admin(cnpj));

-- cnpj_access_requests: qualquer um pede para si (sempre pendente);
-- só admin da empresa do CNPJ decide.
CREATE POLICY cnpj_access_requests_select ON cnpj_access_requests FOR SELECT TO authenticated
  USING (lower(requester_email) = public.current_user_email() OR public.is_tenant_admin(cnpj));
CREATE POLICY cnpj_access_requests_insert ON cnpj_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    lower(requester_email) = public.current_user_email()
    AND COALESCE(status, 'pendente') IN ('pendente', 'pending')
    AND decided_by IS NULL
  );
CREATE POLICY cnpj_access_requests_update ON cnpj_access_requests FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(cnpj)) WITH CHECK (public.is_tenant_admin(cnpj));
CREATE POLICY cnpj_access_requests_delete ON cnpj_access_requests FOR DELETE TO authenticated
  USING (
    public.is_tenant_admin(cnpj)
    OR (lower(requester_email) = public.current_user_email() AND COALESCE(status, 'pendente') IN ('pendente', 'pending'))
  );

-- company_cnpjs: membro lê os da própria empresa; admin da empresa edita.
-- Inserção de CNPJ NOVO só por register_company_cnpj().
CREATE POLICY company_cnpjs_select ON company_cnpjs FOR SELECT TO authenticated
  USING (public.is_tenant_member(cnpj));
CREATE POLICY company_cnpjs_insert ON company_cnpjs FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(cnpj));
CREATE POLICY company_cnpjs_update ON company_cnpjs FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(cnpj)) WITH CHECK (public.is_tenant_admin(cnpj));
CREATE POLICY company_cnpjs_delete ON company_cnpjs FOR DELETE TO authenticated
  USING (public.is_tenant_admin(cnpj));

-- ------------------------------------------------------------
-- 6. Todas as tabelas de negócio: isolamento por CNPJ + papel
-- ------------------------------------------------------------
-- Percorre TODA tabela do schema public que tenha coluna "cnpj" (exceto as
-- de controle acima e profiles/user_invites, que têm regras próprias),
-- apaga TODAS as policies dela — inclusive as "USING (true)" com qualquer
-- nome — e recria quatro policies por empresa.
--
-- Leitura: qualquer membro da empresa.
-- Escrita: membro da empresa; nas tabelas sensíveis, só admin/gestor e o
-- departamento responsável (mesmos grupos de migration-fix-rbac-write-
-- restrictions, que tinha sido sobrescrita).
DO $$
DECLARE
  tbl text;
  pol record;
  write_check text;
  excluded text[] := ARRAY['profiles', 'user_invites', 'user_cnpj_access',
                           'cnpj_access_requests', 'company_cnpjs'];
  rh text[] := ARRAY['employees','allowance_receipts','employee_leaves','employee_tasks',
                     'hr_checklist_templates','performance_cycles','performance_reviews'];
  financeiro text[] := ARRAY['financial_entries','indirect_costs','accounts_receivable',
                     'accounts_receivable_history','receivable_payments','receivable_preferences',
                     'accounts_payable','payable_payments','bank_accounts','bank_transactions',
                     'invoices','invoice_items','taxes','tax_excesses','cost_centers','budgets',
                     'recurring_templates','fiscal_positions'];
  compras text[] := ARRAY['patrimonies','patrimony_movements','patrimony_depreciation_entries',
                     'supplies','uniforms','uniform_deliveries','materials'];
  comercial text[] := ARRAY['contracts','contract_versions','repactuacoes','seguros','laudos',
                     'leads','crm_contacts','crm_companies','crm_activities','deals','ligacoes'];
  gestao text[] := ARRAY['measurements','measurement_items','oficios','oficio_templates',
                     'audit_reports','backup_logs','fiscal_settings'];
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'cnpj'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> ALL (excluded)
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    write_check := 'cnpj = public.my_profile_cnpj()';
    IF tbl = ANY (rh) THEN
      write_check := write_check || ' AND public.current_department() IN (''admin'',''gestor'',''rh'')';
    ELSIF tbl = ANY (financeiro) THEN
      write_check := write_check || ' AND public.current_department() IN (''admin'',''gestor'',''financeiro'')';
    ELSIF tbl = ANY (compras) THEN
      write_check := write_check || ' AND public.current_department() IN (''admin'',''gestor'',''compras'')';
    ELSIF tbl = ANY (comercial) THEN
      write_check := write_check || ' AND public.current_department() IN (''admin'',''gestor'',''comercial'')';
    ELSIF tbl = ANY (gestao) THEN
      write_check := write_check || ' AND public.current_department() IN (''admin'',''gestor'')';
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (cnpj = public.my_profile_cnpj())',
      tbl || '_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      tbl || '_insert', tbl, write_check);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      tbl || '_update', tbl, write_check, write_check);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
      tbl || '_delete', tbl, write_check);
  END LOOP;
END $$;

-- Aviso: tabela com RLS desligado ou policy aberta que ficou de fora
-- (por exemplo, sem coluna cnpj). Aparece em "Messages" no SQL Editor.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd <> 'SELECT'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    RAISE WARNING 'Policy ainda aberta: %.% (%)', r.tablename, r.policyname, r.cmd;
  END LOOP;
  FOR r IN
    SELECT c.relname AS tablename FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    RAISE WARNING 'Tabela sem RLS: %', r.tablename;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7. Storage: bucket "uploads" isolado por pasta = CNPJ
-- ------------------------------------------------------------
-- Novos arquivos vão para "<cnpj>/<arquivo>" (ver src/integrations/Core.js).
-- A leitura continua pública porque URLs antigas já foram salvas nos
-- registros; escrita, troca e exclusão só na pasta da própria empresa.
-- Arquivos antigos (pasta "uploads/") ficam só-leitura.
DROP POLICY IF EXISTS "uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete" ON storage.objects;
CREATE POLICY "uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = public.my_profile_cnpj());
CREATE POLICY "uploads_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = public.my_profile_cnpj())
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = public.my_profile_cnpj());
CREATE POLICY "uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = public.my_profile_cnpj());

COMMIT;

-- ============================================================
-- DEPOIS DE RODAR
-- ============================================================
-- 1) Nenhuma linha esperada (policies de escrita abertas):
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND cmd <> 'SELECT'
--      AND (qual = 'true' OR with_check = 'true');
--
-- 2) Revise quem é admin. Toda conta criada antes desta migration nasceu
--    como 'admin'. Liste e corrija quem não deveria ser:
--    SELECT email, cnpj, department, created_at FROM profiles
--    WHERE department = 'admin' ORDER BY cnpj, created_at;
--    (Para rebaixar, desligue o trigger antes:
--     ALTER TABLE profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;
--     UPDATE profiles SET department = 'operador' WHERE email = '...';
--     ALTER TABLE profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;)
--
-- 3) Revise acessos concedidos a CNPJs de outras empresas:
--    SELECT u.user_email, u.cnpj, p.cnpj AS cnpj_do_perfil
--    FROM user_cnpj_access u LEFT JOIN profiles p ON lower(p.email) = lower(u.user_email)
--    ORDER BY u.cnpj;
--
-- 4) Teste com duas contas de empresas diferentes: SELECT/UPDATE/DELETE
--    não podem enxergar IDs da outra, e INSERT com o CNPJ da outra deve
--    falhar com erro de RLS.
