-- ============================================================
-- Adequação LGPD (Lei 13.709/2018):
--   1. data_subject_requests: registro de solicitações do
--      titular dos dados (acesso, correção, exportação, exclusão).
--   2. data_access_logs: log de auditoria de acesso/edição/exclusão
--      de dados pessoais sensíveis (funcionários).
--   3. employees.lgpd_consent_at/by: registro do consentimento
--      obtido para tratamento dos dados do funcionário.
--   4. profiles.privacy_policy_accepted_at/version: aceite da
--      Política de Privacidade.
-- ============================================================

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  subject_name    TEXT NOT NULL,
  subject_document TEXT,
  subject_email   TEXT,
  employee_id     TEXT,
  request_type    TEXT NOT NULL, -- acesso | correcao | exportacao | exclusao
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente', -- pendente | em_andamento | concluido | rejeitado
  resolution_notes TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_access_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj            TEXT NOT NULL,
  actor_email     TEXT,
  action          TEXT NOT NULL, -- criacao | edicao | exclusao | exportacao
  resource_type   TEXT NOT NULL, -- employee | profile | ...
  resource_id     TEXT,
  resource_label  TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS lgpd_consent_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS lgpd_consent_by TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT;

ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_subject_requests_select ON data_subject_requests;
DROP POLICY IF EXISTS data_subject_requests_all ON data_subject_requests;
CREATE POLICY data_subject_requests_select ON data_subject_requests FOR SELECT TO authenticated
  USING (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()));
CREATE POLICY data_subject_requests_all ON data_subject_requests FOR ALL TO authenticated
  USING (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS data_access_logs_select ON data_access_logs;
DROP POLICY IF EXISTS data_access_logs_all ON data_access_logs;
CREATE POLICY data_access_logs_select ON data_access_logs FOR SELECT TO authenticated
  USING (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()));
CREATE POLICY data_access_logs_all ON data_access_logs FOR ALL TO authenticated
  USING (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()));
