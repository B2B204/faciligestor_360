-- ============================================================
-- MIGRAÇÃO: RH — Onboarding/Offboarding (checklist de admissão e
-- demissão), Férias/Ausências integradas a calendário, e Avaliação
-- de Desempenho 360°.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- ============================================================
-- 1. HR_CHECKLIST_TEMPLATES — modelos padrão de tarefas
--    (aplicados automaticamente ao admitir/desligar um funcionário)
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('onboarding', 'offboarding')),
  title       TEXT NOT NULL,
  category    TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. EMPLOYEE_TASKS — instâncias reais do checklist por funcionário
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj         TEXT NOT NULL,
  employee_id  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('onboarding', 'offboarding')),
  title        TEXT NOT NULL,
  category     TEXT,
  sort_order   INTEGER DEFAULT 0,
  is_done      BOOLEAN DEFAULT false,
  done_at      TIMESTAMPTZ,
  done_by      TEXT,
  due_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee ON employee_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_cnpj     ON employee_tasks(cnpj);

-- ============================================================
-- 3. EMPLOYEE_LEAVES — férias e ausências (integradas ao calendário)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_leaves (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj         TEXT NOT NULL,
  employee_id  TEXT NOT NULL,
  employee_name TEXT,
  leave_type   TEXT NOT NULL DEFAULT 'ferias' CHECK (leave_type IN ('ferias', 'atestado', 'falta_justificada', 'falta_injustificada', 'licenca', 'outros')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  notes        TEXT,
  approved_by  TEXT,
  approved_at  TIMESTAMPTZ,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_cnpj_dates ON employee_leaves(cnpj, start_date, end_date);

-- ============================================================
-- 4. PERFORMANCE_CYCLES — ciclos de avaliação de desempenho
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        TEXT NOT NULL,
  name        TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. PERFORMANCE_REVIEWS — avaliações 360° (auto/gestor/par/subordinado)
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj           TEXT NOT NULL,
  cycle_id       TEXT NOT NULL,
  employee_id    TEXT NOT NULL,
  employee_name  TEXT,
  reviewer_email TEXT NOT NULL,
  reviewer_name  TEXT,
  reviewer_type  TEXT NOT NULL DEFAULT 'par' CHECK (reviewer_type IN ('self', 'gestor', 'par', 'subordinado')),
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
  scores         JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_score  NUMERIC(4,2),
  comments       TEXT,
  submitted_at   TIMESTAMPTZ,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_cycle    ON performance_reviews(cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer ON performance_reviews(reviewer_email);

-- ============================================================
-- RLS — habilita e cria políticas por cnpj (mesmo padrão do sistema)
-- ============================================================
ALTER TABLE hr_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leaves        ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_cycles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'hr_checklist_templates', 'employee_tasks', 'employee_leaves',
    'performance_cycles', 'performance_reviews'
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

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
