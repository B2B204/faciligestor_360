-- ============================================================
-- Corrige RLS: 15 tabelas estavam com Row Level Security
-- HABILITADO mas SEM NENHUMA POLICY, o que bloqueia leitura/escrita
-- para qualquer usuário autenticado (só o service_role/postgres
-- consegue ver, por isso o import via SQL Editor funcionou mas o
-- app não mostrava nada). Segue o mesmo padrão já usado em
-- "employees" (policy de SELECT por cnpj + policy permissiva para
-- INSERT/UPDATE/DELETE).
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'contracts', 'patrimonies', 'seguros', 'repactuacoes', 'alerts',
    'deals', 'oficios', 'oficio_templates', 'laudos', 'ligacoes',
    'posts', 'user_invites', 'team_members', 'allowance_receipts',
    'dashboard_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()))',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true)',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Conferir depois de rodar:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN (
--   'contracts','patrimonies','seguros','repactuacoes','alerts',
--   'deals','oficios','oficio_templates','laudos','ligacoes',
--   'posts','user_invites','team_members','allowance_receipts',
--   'dashboard_preferences'
-- ) ORDER BY tablename, cmd;
