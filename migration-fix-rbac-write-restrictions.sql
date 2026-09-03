-- ============================================================
-- MÉDIO: os papéis (admin/gestor/rh/financeiro/compras/comercial)
-- só existiam no frontend (src/components/permissions.jsx). A RLS
-- de todas as tabelas de negócio só verificava "mesmo cnpj" — ou
-- seja, qualquer colaborador autenticado da empresa conseguia
-- ler E ESCREVER, via chamada direta à API, dados de folha de
-- pagamento (employees: CPF, salário), financeiro (bank_accounts,
-- accounts_payable/receivable) etc., mesmo que a tela dissesse
-- que o papel dele não deveria editar aquilo.
--
-- IMPORTANTE: a leitura (SELECT) continua igual — não restringimos
-- por papel, porque src/components/permissions.jsx já declara
-- "pages: ['all']" para TODOS os papéis (hasPageAccess sempre
-- retorna true): visão cross-área é comportamento intencional do
-- produto, só a EDIÇÃO é restrita por papel (canEditPage). Esta
-- migration só reforça no banco a mesma regra de ESCRITA que
-- canEditPage já declara no frontend:
--   RH_PAGES       = Employees, AllowanceReceipts
--   FIN_PAGES      = Financial, AccountsReceivable, IndirectCosts
--   COMPRAS_PAGES  = Supplies, Patrimony, Uniforms
--   COMERCIAL_PAGES= CRM, Contracts, ReajusteContratual, SegurosLaudos
-- (admin e gestor sempre podem editar tudo, como já era)
--
-- Tabelas cujo módulo/página não bate com nenhum desses quatro
-- grupos (Measurements, Oficios, auditoria, backup) passam a
-- exigir admin/gestor para escrever, também batendo com
-- canEditPage (que retorna false pra qualquer outro papel nessas
-- páginas).
--
-- Tabelas SEM mapeamento confiável de página/módulo (posts,
-- alerts, dashboard_preferences, ai_suggestions, e as de ordem de
-- serviço "OS", que não têm uma página com nome idêntico em
-- nenhum dos quatro grupos) foram deixadas de fora de propósito —
-- continuam só cnpj-scoped, sem restrição de papel, para não
-- arriscar quebrar um fluxo que eu não consegui confirmar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_department()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM profiles WHERE id = auth.uid()
$$;

DO $$
DECLARE
  tbl TEXT;
  role_group TEXT;
  tbls TEXT[];
BEGIN
  -- RH
  role_group := 'rh';
  tbls := ARRAY['employees','allowance_receipts','employee_leaves','employee_tasks',
                'hr_checklist_templates','performance_cycles','performance_reviews'];
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
         AND current_department() IN (''admin'',''gestor'',%L)
       )', tbl, tbl, role_group
    );
  END LOOP;

  -- Financeiro
  role_group := 'financeiro';
  tbls := ARRAY['financial_entries','indirect_costs','accounts_receivable',
                'accounts_receivable_history','receivable_payments','receivable_preferences',
                'accounts_payable','payable_payments','bank_accounts','bank_transactions','invoices','invoice_items',
                'taxes','tax_excesses','cost_centers','budgets','recurring_templates','fiscal_positions'];
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
         AND current_department() IN (''admin'',''gestor'',%L)
       )', tbl, tbl, role_group
    );
  END LOOP;

  -- Compras
  role_group := 'compras';
  tbls := ARRAY['patrimonies','patrimony_movements','patrimony_depreciation_entries',
                'supplies','uniforms','uniform_deliveries','materials'];
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
         AND current_department() IN (''admin'',''gestor'',%L)
       )', tbl, tbl, role_group
    );
  END LOOP;

  -- Comercial
  role_group := 'comercial';
  tbls := ARRAY['contracts','contract_versions','repactuacoes','seguros','laudos',
                'leads','crm_contacts','crm_companies','crm_activities','deals','ligacoes'];
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
         AND current_department() IN (''admin'',''gestor'',%L)
       )', tbl, tbl, role_group
    );
  END LOOP;

  -- Só admin/gestor (páginas fora dos quatro grupos, ou tabelas de
  -- auditoria/backup que nunca deveriam ser editadas por qualquer
  -- colaborador comum)
  tbls := ARRAY['measurements','measurement_items','oficios','oficio_templates',
                'audit_reports','backup_logs','fiscal_settings'];
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
         AND current_department() IN (''admin'',''gestor'')
       )', tbl, tbl
    );
  END LOOP;
END $$;

-- Conferir depois de rodar (cada tabela acima deve aparecer com a policy
-- "_all" nova, contendo "current_department()" no qual):
-- SELECT tablename, policyname, qual FROM pg_policies
-- WHERE schemaname = 'public' AND policyname LIKE '%_all' AND qual LIKE '%current_department%'
-- ORDER BY tablename;
