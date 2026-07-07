-- ============================================================
-- CORREÇÃO CRÍTICA: as políticas "_all" (INSERT/UPDATE/DELETE)
-- de praticamente todas as tabelas de negócio estavam com
-- USING (true) — ou seja, qualquer usuário autenticado, de
-- QUALQUER empresa, conseguia ler e escrever dados de QUALQUER
-- outra empresa (o Postgres combina políticas permissivas com
-- OR, então essa policy "_all: true" anulava a policy "_select"
-- que já restringia por cnpj).
--
-- Esta migration troca "_all: true" por "_all: cnpj do usuário",
-- igualando a política de escrita à de leitura: cada usuário só
-- vê e só grava dados da própria empresa (mesmo cnpj), e todos
-- os usuários da MESMA empresa continuam vendo os mesmos dados.
--
-- Também remove policies "_all: true" remanescentes em
-- cnpj_access_requests e user_cnpj_access, que anulavam as
-- políticas granulares já corrigidas em
-- migration-fix-rls-cnpj-access-requests.sql.
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'accounts_payable', 'accounts_receivable', 'accounts_receivable_history',
    'ai_suggestions', 'alerts', 'allowance_receipts', 'audit_reports',
    'backup_logs', 'bank_accounts', 'bank_transactions', 'budgets',
    'contract_versions', 'contracts', 'cost_centers', 'crm_activities',
    'crm_companies', 'crm_contacts', 'dashboard_preferences', 'deals',
    'employee_leaves', 'employee_tasks', 'employees', 'financial_entries',
    'fiscal_positions', 'fiscal_settings', 'hr_checklist_templates',
    'indirect_costs', 'invoice_items', 'invoices', 'laudos', 'leads',
    'ligacoes', 'materials', 'measurement_items', 'measurements',
    'oficio_templates', 'oficios', 'patrimonies',
    'patrimony_depreciation_entries', 'patrimony_movements',
    'payable_payments', 'performance_cycles', 'performance_reviews',
    'posts', 'receivable_payments', 'receivable_preferences',
    'recurring_templates', 'repactuacoes', 'seguros',
    'service_order_checklists', 'service_order_materials',
    'service_order_time_logs', 'service_orders', 'supplies',
    'tax_excesses', 'taxes', 'team_members', 'uniform_deliveries',
    'uniforms', 'user_invites'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS cnpj_access_requests_all ON cnpj_access_requests;
DROP POLICY IF EXISTS user_cnpj_access_all ON user_cnpj_access;

-- Conferir depois de rodar:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE schemaname = 'public' AND cmd = 'ALL' AND qual = 'true';
-- (deve retornar só company_cnpjs_all, que é intencional)
