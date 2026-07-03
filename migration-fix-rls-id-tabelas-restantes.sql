-- ============================================================
-- Auditoria completa de RLS/id em todas as tabelas (a pedido do
-- usuario: "administrador deve ter acesso a todas as informacoes").
-- Corrige as 6 tabelas que ainda estavam com RLS habilitado e
-- ZERO policies (ninguem, nem admin, conseguia ler/escrever) e
-- sem DEFAULT na coluna id (criacao de registro novo falhava).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'ai_suggestions', 'backup_logs', 'measurement_items',
    'patrimony_movements', 'uniform_deliveries', 'uniforms'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- RLS: policy de select por cnpj + policy permissiva para escrita
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

    -- id sem DEFAULT (coluna e TEXT, nao UUID)
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text', t);
  END LOOP;
END $$;

-- Conferir depois de rodar:
-- SELECT c.relname, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) qtd_policies,
--        (SELECT column_default FROM information_schema.columns ic WHERE ic.table_schema='public' AND ic.table_name=c.relname AND ic.column_name='id') id_default
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relname IN (
--   'ai_suggestions','backup_logs','measurement_items',
--   'patrimony_movements','uniform_deliveries','uniforms'
-- );
