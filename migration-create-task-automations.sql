-- ============================================================
-- AUTOMAÇÕES DO MÓDULO DE TAREFAS (Fase 3)
--
-- Regras reativas configuráveis pelo usuário: "quando o status de
-- uma tarefa mudar para X, crie a tarefa Y" ou "quando o prazo de
-- uma tarefa vencer, notifique o gestor". Disparadas pelo próprio
-- frontend (troca de status, carregamento da página de tarefas) —
-- não há cron/Edge Function agendada nesta fase.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL, -- status_changed | due_date_passed
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL, -- create_task | notify_alert
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_automation_rules_cnpj_active ON task_automation_rules(cnpj, is_active);

ALTER TABLE task_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_automation_rules_select ON task_automation_rules;
CREATE POLICY task_automation_rules_select ON task_automation_rules FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS task_automation_rules_all ON task_automation_rules;
CREATE POLICY task_automation_rules_all ON task_automation_rules FOR ALL TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
