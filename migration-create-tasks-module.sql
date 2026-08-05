-- ============================================================
-- MÓDULO DE GESTÃO DE TAREFAS (Fase 1)
--
-- Cria a estrutura de dados do módulo de tarefas estilo ClickUp:
-- modelos de tarefas (task_templates), tarefas (tasks) com
-- subtarefas/dependências, checklist, comentários, anexos e
-- histórico de atividade. Também liga contratos a um modelo de
-- tarefas opcional (contracts.task_template_id), para que a
-- criação de um contrato possa instanciar automaticamente o
-- conjunto de tarefas do modelo escolhido.
--
-- Segue o mesmo padrão multi-tenant (cnpj + RLS) já usado em
-- todas as demais tabelas de negócio do sistema.
-- ============================================================

-- 1) Modelos de tarefas -----------------------------------------------------

CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- ex: implantacao, financeiro, rh, comercial, engenharia, facilities
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  default_priority TEXT NOT NULL DEFAULT 'normal', -- muito_alta | alta | normal | baixa | sem_prioridade
  default_assignee_role TEXT, -- department/role sugerido como responsável padrão
  days_offset_start INTEGER NOT NULL DEFAULT 0, -- dias após o início do contrato
  days_offset_due INTEGER NOT NULL DEFAULT 7,
  order_index INTEGER NOT NULL DEFAULT 0,
  parent_item_id UUID REFERENCES task_template_items(id) ON DELETE CASCADE,
  depends_on_item_id UUID REFERENCES task_template_items(id) ON DELETE SET NULL,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_template_items_template ON task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_task_template_items_parent ON task_template_items(parent_item_id);

-- 2) Tarefas -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer', -- a_fazer | em_andamento | aguardando | bloqueada | revisao | concluida | cancelada
  priority TEXT NOT NULL DEFAULT 'normal', -- muito_alta | alta | normal | baixa | sem_prioridade
  department TEXT,
  contract_id TEXT, -- contracts.id é TEXT (ids legados da migração base44); sem FK, mesmo padrão de cost_centers.contract_id, etc.
  project_name TEXT,
  list_name TEXT,
  assignee_email TEXT,
  observer_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  approver_email TEXT,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES task_template_items(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_cnpj_status ON tasks(cnpj, status);
CREATE INDEX IF NOT EXISTS idx_tasks_cnpj_assignee ON tasks(cnpj, assignee_email);
CREATE INDEX IF NOT EXISTS idx_tasks_cnpj_contract ON tasks(cnpj, contract_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cnpj_due_date ON tasks(cnpj, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task ON task_checklist_items(task_id);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

CREATE TABLE IF NOT EXISTS task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created | updated | status_changed | assignee_changed | due_date_changed | completed | deleted | commented
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_log_task ON task_activity_log(task_id);

-- 3) Integração com Contratos --------------------------------------------------

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL;

-- 4) RLS -----------------------------------------------------------------------

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'task_templates', 'task_template_items', 'tasks', 'task_dependencies',
    'task_checklist_items', 'task_comments', 'task_attachments', 'task_activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
       )',
      t || '_select', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Conferir depois de rodar:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'task%';
