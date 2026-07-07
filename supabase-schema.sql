-- ============================================================
-- FaciliGestor360 - Schema Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Função helper para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PROFILES (estende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  photo_url     TEXT,
  department    TEXT DEFAULT 'admin',  -- admin | gestor | financeiro | rh | comercial | compras
  cnpj          TEXT,
  plan          TEXT DEFAULT 'none',
  plan_status   TEXT DEFAULT 'demo',  -- active | demo | inactive
  phone         TEXT,
  tax_regime    TEXT DEFAULT 'simples_nacional',
  company_logo_url TEXT,
  company_name  TEXT,
  company_address TEXT,
  cargo         TEXT,
  matricula     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-criar profile ao registrar usuário (com fallback para não bloquear o signup).
-- search_path fixado em "public": a role supabase_auth_admin (que o
-- GoTrue usa para inserir em auth.users) roda com search_path=auth,
-- e sem isso o "INSERT INTO profiles" abaixo procura a tabela no
-- schema errado, falha, e o EXCEPTION engole o erro em silêncio —
-- o usuário é criado mas nunca ganha profile/cnpj.
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
  RAISE WARNING 'handle_new_user falhou para %: %', NEW.id, SQLERRM; -- Não bloquear criação do usuário se o profile falhar
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- COMPANY CNPJS
-- ============================================================
CREATE TABLE IF NOT EXISTS company_cnpjs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                TEXT NOT NULL,
  display_name        TEXT,
  is_active           BOOLEAN DEFAULT true,
  notify_accounting   BOOLEAN DEFAULT true,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS company_cnpjs_updated_at ON company_cnpjs;
CREATE TRIGGER company_cnpjs_updated_at BEFORE UPDATE ON company_cnpjs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  name            TEXT,
  client_name     TEXT,
  contract_number TEXT,
  status          TEXT DEFAULT 'ativo',
  start_date      DATE,
  end_date        DATE,
  duration_months INTEGER,
  service_type    TEXT,
  monthly_value   NUMERIC(15,2),
  description     TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  responsible     TEXT,
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  deleted_by      TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  TEXT NOT NULL,
  contract_id           TEXT,
  name                  TEXT NOT NULL,
  cpf                   TEXT,
  rg                    TEXT,
  email                 TEXT,
  whatsapp              TEXT,
  role                  TEXT,
  status                TEXT DEFAULT 'ativo',
  admission_date        DATE,
  dismissal_date        DATE,
  unidade               TEXT,
  salary                NUMERIC(15,2),
  pis                   TEXT,
  ctps                  TEXT,
  bank                  TEXT,
  bank_agency           TEXT,
  bank_account          TEXT,
  uniform_shirt_size    TEXT,
  uniform_pants_size    TEXT,
  uniform_boot_size     TEXT,
  uniform_jacket_size   TEXT,
  photo_url             TEXT,
  observations          TEXT,
  is_ferista            BOOLEAN DEFAULT false,
  created_by            TEXT,
  updated_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FINANCIAL ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  type            TEXT,  -- receita | despesa
  category        TEXT,
  description     TEXT,
  amount          NUMERIC(15,2),
  date            DATE,
  competence_month TEXT,
  notes           TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS financial_entries_updated_at ON financial_entries;
CREATE TRIGGER financial_entries_updated_at BEFORE UPDATE ON financial_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TAX EXCESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_excesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  year            INTEGER,
  month           INTEGER,
  amount          NUMERIC(15,2),
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TAXES & MATERIALS (usados em Reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS taxes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT,
  rate        NUMERIC(10,4),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT,
  unit        TEXT,
  unit_price  NUMERIC(15,2),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MEASUREMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  reference_month TEXT,
  status          TEXT DEFAULT 'rascunho',
  total_value     NUMERIC(15,2),
  notes           TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS measurement_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  measurement_id  TEXT,
  description     TEXT,
  quantity        NUMERIC(15,4),
  unit            TEXT,
  unit_price      NUMERIC(15,2),
  total           NUMERIC(15,2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDIRECT COSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS indirect_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  category        TEXT,
  description     TEXT,
  amount          NUMERIC(15,2),
  competence_month TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ACCOUNTS RECEIVABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                      TEXT NOT NULL,
  contract_id               TEXT,
  customer_name             TEXT,
  document_number           TEXT,
  status                    TEXT DEFAULT 'aberto',
  issue_date                DATE,
  competence_month          TEXT,
  due_date                  DATE,
  billing_method            TEXT,
  face_value                NUMERIC(15,2),
  open_amount               NUMERIC(15,2),
  discount_amount           NUMERIC(15,2) DEFAULT 0,
  interest_amount           NUMERIC(15,2) DEFAULT 0,
  monetary_correction_amount NUMERIC(15,2) DEFAULT 0,
  paid_amount               NUMERIC(15,2) DEFAULT 0,
  payment_date              DATE,
  settlement_date           DATE,
  bank_account_id           TEXT,
  observations              TEXT,
  receiving_bank_code       TEXT,
  receiving_bank_name       TEXT,
  receiving_bank_agency     TEXT,
  receiving_bank_account    TEXT,
  receiving_bank_pix_key    TEXT,
  deleted_at                TIMESTAMPTZ,
  deleted_by                TEXT,
  created_by                TEXT,
  updated_by                TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts_receivable_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  TEXT NOT NULL,
  receivable_id         TEXT,
  action                TEXT,
  previous_status       TEXT,
  new_status            TEXT,
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receivable_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  receivable_id     TEXT,
  amount            NUMERIC(15,2),
  payment_date      DATE,
  method            TEXT,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receivable_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  user_email      TEXT,
  preferences     JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ACCOUNTS PAYABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts_payable (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  supplier_name   TEXT,
  supplier_cnpj   TEXT,
  document_number TEXT,
  status          TEXT DEFAULT 'aberto',
  issue_date      DATE,
  due_date        DATE,
  competence_month TEXT,
  face_value      NUMERIC(15,2),
  open_amount     NUMERIC(15,2),
  paid_amount     NUMERIC(15,2) DEFAULT 0,
  payment_date    DATE,
  category        TEXT,
  invoice_id      TEXT,
  bank_account_id TEXT,
  contract_id     TEXT,
  observations    TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BANK ACCOUNTS & TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  bank_name       TEXT,
  account_name    TEXT,
  account_number  TEXT,
  initial_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  bank_account_id TEXT,
  bank_name       TEXT,
  account         TEXT,
  statement_date  DATE,
  trn_type        TEXT,
  posted_date     DATE,
  amount          NUMERIC(15,2),
  fitid           TEXT,
  name            TEXT,
  memo            TEXT,
  matched_entity  TEXT DEFAULT 'none',
  matched_id      TEXT,
  import_batch_id TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVOICES (Notas Fiscais)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  type            TEXT,
  number          TEXT,
  series          TEXT,
  issue_date      DATE,
  total_amount    NUMERIC(15,2),
  access_key      TEXT,
  cnpj_issuer     TEXT,
  cnpj_recipient  TEXT,
  environment     TEXT DEFAULT 'homologacao',
  xml_file_uri    TEXT,
  status          TEXT DEFAULT 'uploaded',
  observations    TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  invoice_id  TEXT,
  description TEXT,
  quantity    NUMERIC(15,4),
  unit        TEXT,
  unit_price  NUMERIC(15,2),
  total       NUMERIC(15,2),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REPACTUACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS repactuacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  reference_date  DATE,
  index_used      TEXT,
  percentage      NUMERIC(10,4),
  old_value       NUMERIC(15,2),
  new_value       NUMERIC(15,2),
  status          TEXT DEFAULT 'pendente',
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEGUROS & LAUDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS seguros (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  type            TEXT,
  insurer         TEXT,
  policy_number   TEXT,
  start_date      DATE,
  end_date        DATE,
  value           NUMERIC(15,2),
  status          TEXT DEFAULT 'ativo',
  file_url        TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laudos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  type            TEXT,
  description     TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  status          TEXT DEFAULT 'valido',
  file_url        TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- POSTS / RECONHECIMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  content     TEXT,
  image_url   TEXT,
  type        TEXT DEFAULT 'recado',
  likes       INTEGER DEFAULT 0,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAM MEMBERS & USER INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  full_name   TEXT,
  email       TEXT,
  department  TEXT,
  status      TEXT DEFAULT 'ativo',
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj          TEXT NOT NULL,
  full_name     TEXT,
  email         TEXT,
  department    TEXT,
  status        TEXT DEFAULT 'pendente',
  invite_code   TEXT UNIQUE,
  invited_by    TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- OFICIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS oficios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                TEXT NOT NULL,
  numero_oficio       TEXT,
  year                INTEGER,
  tipo_oficio         TEXT,
  contract_id         TEXT,
  destinatario        TEXT,
  assunto             TEXT,
  corpo_oficio        TEXT,
  data_emissao        DATE,
  status              TEXT DEFAULT 'rascunho',
  assinante_nome      TEXT,
  cargo_assinante     TEXT,
  assinante_matricula TEXT,
  signer_employee_id  TEXT,
  category            TEXT,
  department          TEXT,
  approval_status     TEXT DEFAULT 'pendente',
  approved_by         TEXT,
  approval_date       TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oficio_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT,
  tipo_oficio TEXT,
  content     TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PATRIMONY
-- ============================================================
CREATE TABLE IF NOT EXISTS patrimonies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  name            TEXT,
  code            TEXT,
  category        TEXT,
  description     TEXT,
  acquisition_date DATE,
  acquisition_value NUMERIC(15,2),
  current_value   NUMERIC(15,2),
  location        TEXT,
  status          TEXT DEFAULT 'ativo',
  photo_url       TEXT,
  qr_code         TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patrimony_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  patrimony_id    TEXT,
  type            TEXT,
  from_location   TEXT,
  to_location     TEXT,
  date            DATE,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SUPPLIES (Compras)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  description     TEXT,
  supplier        TEXT,
  quantity        NUMERIC(15,4),
  unit            TEXT,
  unit_price      NUMERIC(15,2),
  total           NUMERIC(15,2),
  purchase_date   DATE,
  status          TEXT DEFAULT 'pendente',
  category        TEXT,
  invoice_url     TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- UNIFORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS uniforms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  contract_id TEXT,
  name        TEXT,
  type        TEXT,
  size        TEXT,
  quantity    INTEGER DEFAULT 0,
  min_stock   INTEGER DEFAULT 0,
  unit_cost   NUMERIC(15,2),
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uniform_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj          TEXT NOT NULL,
  uniform_id    TEXT,
  employee_id   TEXT,
  quantity      INTEGER,
  delivery_date DATE,
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ALLOWANCE RECEIPTS (VA/VT)
-- ============================================================
CREATE TABLE IF NOT EXISTS allowance_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  employee_id     TEXT,
  employee_name   TEXT,
  type            TEXT,  -- va | vt
  reference_month TEXT,
  value           NUMERIC(15,2),
  days            INTEGER,
  status          TEXT DEFAULT 'pendente',
  signed_url      TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CRM
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT,
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  status      TEXT DEFAULT 'novo',
  source      TEXT,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  company_id  TEXT,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  role        TEXT,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT,
  cnpj_client TEXT,
  sector      TEXT,
  status      TEXT,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  contact_id  TEXT,
  company_id  TEXT,
  deal_id     TEXT,
  type        TEXT,
  description TEXT,
  date        DATE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  company_id  TEXT,
  contact_id  TEXT,
  title       TEXT,
  value       NUMERIC(15,2),
  status      TEXT DEFAULT 'em_andamento',
  stage       TEXT,
  probability INTEGER,
  expected_close DATE,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  type        TEXT,
  title       TEXT,
  message     TEXT,
  severity    TEXT DEFAULT 'info',
  status      TEXT DEFAULT 'ativo',
  entity_type TEXT,
  entity_id   TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DASHBOARD PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  user_email  TEXT,
  preferences JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SERVICE ORDERS (OS)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  contract_id     TEXT,
  number          TEXT,
  title           TEXT,
  description     TEXT,
  status          TEXT DEFAULT 'aberto',
  priority        TEXT DEFAULT 'normal',
  type            TEXT,
  location        TEXT,
  assigned_to     TEXT,
  open_date       DATE,
  due_date        DATE,
  close_date      DATE,
  estimated_hours NUMERIC(10,2),
  actual_hours    NUMERIC(10,2),
  notes           TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FISCAL SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  TEXT NOT NULL,
  environment           TEXT DEFAULT 'homologacao',
  prod_pfx_uri          TEXT,
  prod_pfx_password     TEXT,
  prod_pfx_uploaded_at  TIMESTAMPTZ,
  hml_pfx_uri           TEXT,
  hml_pfx_password      TEXT,
  hml_pfx_uploaded_at   TIMESTAMPTZ,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj          TEXT NOT NULL,
  run_at        TIMESTAMPTZ,
  issues        JSONB,
  total_issues  INTEGER DEFAULT 0,
  summary       JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CNPJ ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS cnpj_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email TEXT,
  cnpj            TEXT,
  reason          TEXT,
  status          TEXT DEFAULT 'pending',
  decided_by      TEXT,
  decided_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_cnpj_access (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email          TEXT,
  cnpj                TEXT,
  notify_accounting   BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security) - Políticas de Segurança
-- IMPORTANTE: Habilitar RLS em todas as tabelas
-- ============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_cnpjs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_excesses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE indirect_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE repactuacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros               ENABLE ROW LEVEL SECURITY;
ALTER TABLE laudos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE oficios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE oficio_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimonies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimony_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniforms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniform_deliveries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_receipts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnpj_access_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cnpj_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials             ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles: usuário vê/edita apenas seu próprio perfil
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Para company_cnpjs: todos autenticados podem ler (necessário para CnpjSwitcher)
DROP POLICY IF EXISTS "company_cnpjs_select" ON company_cnpjs;
DROP POLICY IF EXISTS "company_cnpjs_all" ON company_cnpjs;
CREATE POLICY "company_cnpjs_select" ON company_cnpjs FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_cnpjs_all"    ON company_cnpjs FOR ALL TO authenticated USING (true);

-- Para team_members: ler por cnpj ou por email do próprio usuário
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_all" ON team_members;
CREATE POLICY "team_members_select" ON team_members FOR SELECT TO authenticated
  USING (
    cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
    OR email = (SELECT p.email FROM profiles p WHERE p.id = auth.uid())
  );
CREATE POLICY "team_members_all" ON team_members FOR ALL TO authenticated USING (true);

-- Para user_invites: ler por cnpj do usuário atual
DROP POLICY IF EXISTS "user_invites_select" ON user_invites;
DROP POLICY IF EXISTS "user_invites_all" ON user_invites;
CREATE POLICY "user_invites_select" ON user_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_invites_all"    ON user_invites FOR ALL TO authenticated USING (true);

-- Política genérica para tabelas multi-tenant (baseada em cnpj do profile do usuário)
-- Aplica-se a: contracts, employees, financial_entries, etc.
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'contracts','employees','financial_entries','tax_excesses','measurements',
    'measurement_items','indirect_costs','accounts_receivable','accounts_receivable_history',
    'receivable_payments','receivable_preferences','accounts_payable','bank_accounts',
    'bank_transactions','invoices','invoice_items','repactuacoes','seguros','laudos',
    'posts','oficios','oficio_templates','patrimonies','patrimony_movements','supplies',
    'uniforms','uniform_deliveries','allowance_receipts','leads','crm_contacts',
    'crm_companies','crm_activities','deals','alerts','dashboard_preferences',
    'service_orders','fiscal_settings','audit_reports','taxes','materials'
  ];
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

-- Política para cnpj_access_requests e user_cnpj_access
DROP POLICY IF EXISTS "cnpj_access_requests_all" ON cnpj_access_requests;
DROP POLICY IF EXISTS "user_cnpj_access_all" ON user_cnpj_access;
CREATE POLICY "cnpj_access_requests_all" ON cnpj_access_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "user_cnpj_access_all"     ON user_cnpj_access     FOR ALL TO authenticated USING (true);

-- ============================================================
-- STORAGE: Bucket para uploads
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "uploads_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete" ON storage.objects;
CREATE POLICY "uploads_select" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "uploads_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "uploads_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'uploads');
CREATE POLICY "uploads_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uploads');
