-- Defesa final para isolamento multiempresa.
-- Execute depois do supabase-schema.sql e das migrações legadas.
-- Idempotente: recria apenas as políticas operacionais listadas abaixo.

BEGIN;

DO $$
DECLARE
  tbl text;
  scoped_tables text[] := ARRAY[
    'contracts','employees','financial_entries','tax_excesses','measurements',
    'measurement_items','indirect_costs','accounts_receivable','accounts_receivable_history',
    'receivable_payments','receivable_preferences','accounts_payable','bank_accounts',
    'bank_transactions','invoices','invoice_items','repactuacoes','seguros','laudos',
    'posts','oficios','oficio_templates','patrimonies','patrimony_movements','supplies',
    'uniforms','uniform_deliveries','allowance_receipts','leads','crm_contacts',
    'crm_companies','crm_activities','deals','alerts','dashboard_preferences',
    'service_orders','fiscal_settings','audit_reports','taxes','materials',
    'contract_versions','cost_centers','patrimony_depreciation_entries'
  ];
BEGIN
  FOREACH tbl IN ARRAY scoped_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_all', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (cnpj = public.my_profile_cnpj())',
      tbl || '_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (cnpj = public.my_profile_cnpj())',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (cnpj = public.my_profile_cnpj()) WITH CHECK (cnpj = public.my_profile_cnpj())',
      tbl || '_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (cnpj = public.my_profile_cnpj())',
      tbl || '_delete', tbl
    );
  END LOOP;
END $$;

COMMIT;

-- Verificação manual recomendada antes da produção:
-- 1. autentique dois usuários de CNPJs diferentes;
-- 2. confirme que SELECT/UPDATE/DELETE não enxergam IDs do outro tenant;
-- 3. tente INSERT com o CNPJ do outro tenant e espere violação de RLS.
