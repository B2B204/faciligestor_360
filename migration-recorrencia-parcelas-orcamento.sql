-- ============================================================
-- MIGRAÇÃO: Recorrência de Lançamentos, Pagamentos Parciais (Payable)
-- e Orçamento (Orçado x Realizado)
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

-- ============================================================
-- 1. RECURRING_TEMPLATES — templates para geração automática
--    de contas a pagar/receber recorrentes (aluguel, mensalidades, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  name              TEXT NOT NULL,
  party_name        TEXT, -- nome do cliente (receivable) ou fornecedor (payable)
  party_cnpj        TEXT,
  contract_id       TEXT,
  category          TEXT,
  amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  day_of_month      SMALLINT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  start_month       TEXT NOT NULL, -- 'YYYY-MM', primeiro mês de geração
  end_month         TEXT,          -- 'YYYY-MM', opcional, último mês de geração
  bank_account_id   TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_generated_month TEXT, -- 'YYYY-MM' do último lançamento gerado
  notes             TEXT,
  created_by        TEXT,
  updated_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_templates_cnpj ON recurring_templates(cnpj);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON recurring_templates(is_active) WHERE is_active = true;

-- ============================================================
-- 2. PAYABLE_PAYMENTS — histórico de baixas parciais de Contas a Pagar
--    (espelha receivable_payments, que já existe para Contas a Receber)
-- ============================================================
CREATE TABLE IF NOT EXISTS payable_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  payable_id        TEXT NOT NULL,
  amount            NUMERIC(15,2) NOT NULL,
  payment_date      DATE NOT NULL,
  method             TEXT,
  bank_account_id   TEXT,
  proof_url         TEXT,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payable_payments_payable_id ON payable_payments(payable_id);
CREATE INDEX IF NOT EXISTS idx_payable_payments_cnpj ON payable_payments(cnpj);

-- ============================================================
-- 3. BUDGETS — orçado x realizado por categoria/centro de custo/mês
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  category          TEXT NOT NULL,
  cost_center       TEXT, -- ex: contract_id ou nome de centro de custo livre
  competence_month  TEXT NOT NULL, -- 'YYYY-MM'
  budgeted_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        TEXT,
  updated_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cnpj, category, cost_center, competence_month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_cnpj_month ON budgets(cnpj, competence_month);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets             ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['recurring_templates', 'payable_payments', 'budgets'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %s FOR SELECT TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
       )',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
