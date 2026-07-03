-- ============================================================
-- Corrige RLS: "accounts_receivable" e "measurements" estavam
-- com Row Level Security HABILITADO mas SEM NENHUMA POLICY,
-- bloqueando leitura/escrita para qualquer usuário autenticado
-- (mesmo problema já corrigido antes em outras 15 tabelas).
-- Isso, somado ao bug de ordenação (created_at vs created_date),
-- fazia o Dashboard não trazer nenhum dado real.
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['accounts_receivable', 'measurements'];
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
-- WHERE tablename IN ('accounts_receivable', 'measurements')
-- ORDER BY tablename, cmd;
