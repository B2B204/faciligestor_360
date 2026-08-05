import { TaskAutomationRule } from '@/entities/TaskAutomationRule';
import { Task } from '@/entities/Task';
import { Alert } from '@/entities/Alert';
import { logTaskActivity } from '@/lib/taskActivityLogger';
import { format, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';

function ruleMatchesTask(rule, task) {
  const cfg = rule.trigger_config || {};
  if (cfg.contract_id && cfg.contract_id !== task.contract_id) return false;
  if (cfg.department && cfg.department !== task.department) return false;
  return true;
}

async function executeAction(rule, task, cnpj, actorEmail) {
  const cfg = rule.action_config || {};
  if (rule.action_type === 'create_task') {
    const created = await Task.create({
      cnpj,
      title: cfg.title || `Tarefa gerada por automação: ${rule.name}`,
      department: cfg.department || task.department || null,
      contract_id: task.contract_id || null,
      project_name: task.project_name || null,
      list_name: task.list_name || null,
      assignee_email: cfg.assignee_email || null,
      status: 'a_fazer',
      priority: 'normal',
      due_date: format(addDays(new Date(), cfg.days_offset_due ?? 7), 'yyyy-MM-dd'),
    });
    await logTaskActivity({ cnpj, taskId: created.id, action: 'created', actorEmail, newValue: `Criada pela automação "${rule.name}"` });
    return created;
  }

  if (rule.action_type === 'notify_alert') {
    const recipients = cfg.recipient_role === 'assignee' && task.assignee_email ? [task.assignee_email] : [];
    await Alert.create({
      cnpj,
      type: 'task_automation',
      entity_id: task.id,
      entity_type: 'Task',
      due_date: task.due_date || null,
      status: 'pending',
      message: cfg.message || `Automação "${rule.name}" disparada pela tarefa "${task.title}".`,
      recipients,
    });
  }
}

// Roda logo após uma tarefa mudar de status (chamado a partir do fluxo de
// edição da tarefa), executando as regras cujo trigger_config.to_status bate
// com o novo status.
export async function runStatusChangeAutomations({ cnpj, task, newStatus, actorEmail }) {
  if (!cnpj) return;
  try {
    const rules = await TaskAutomationRule.filter({ cnpj, trigger_type: 'status_changed', is_active: true });
    const matching = rules.filter((r) => (r.trigger_config?.to_status === newStatus) && ruleMatchesTask(r, task));
    for (const rule of matching) {
      await executeAction(rule, { ...task, status: newStatus }, cnpj, actorEmail);
    }
  } catch (err) {
    console.warn('[taskAutomationEngine] falha ao rodar automações de status:', err);
  }
}

// Roda ao carregar a lista de tarefas: aplica regras due_date_passed às
// tarefas vencidas ainda não notificadas por essa regra (dedupe simples via
// tabela de alerts, mesma checagem usada em taskAlerts.generateTaskDueAlerts).
export async function runDueDateAutomations({ cnpj, tasks }) {
  if (!cnpj || !tasks?.length) return;
  try {
    const rules = await TaskAutomationRule.filter({ cnpj, trigger_type: 'due_date_passed', is_active: true });
    if (!rules.length) return;

    const today = startOfDay(new Date());
    const overdueTasks = tasks.filter((t) => {
      if (!t.due_date || ['concluida', 'cancelada'].includes(t.status)) return false;
      return differenceInCalendarDays(startOfDay(new Date(t.due_date)), today) < 0;
    });
    if (!overdueTasks.length) return;

    const existingAlerts = await Alert.filter({ cnpj, type: 'task_automation' });
    const existingKeys = new Set(existingAlerts.map((a) => `${a.entity_id}`));

    for (const rule of rules) {
      for (const task of overdueTasks) {
        if (!ruleMatchesTask(rule, task)) continue;
        if (existingKeys.has(task.id)) continue;
        await executeAction(rule, task, cnpj, null);
        existingKeys.add(task.id);
      }
    }
  } catch (err) {
    console.warn('[taskAutomationEngine] falha ao rodar automações de prazo:', err);
  }
}
