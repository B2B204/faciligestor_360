import { TaskTemplateItem } from '@/entities/TaskTemplateItem';
import { Task } from '@/entities/Task';
import { TaskDependency } from '@/entities/TaskDependency';
import { logTaskActivity } from '@/lib/taskActivityLogger';

function addDays(dateStr, days) {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setDate(base.getDate() + (days || 0));
  return base.toISOString().split('T')[0];
}

// Cria as tarefas de um contrato a partir de um modelo de tarefas: lê os
// itens do modelo, cria uma tarefa real para cada um (calculando prazos a
// partir da data de início do contrato) e depois resolve as relações de
// subtarefa/dependência entre eles, já que essas relações apontam para
// outros itens do próprio modelo (que só viram IDs reais de tarefa após
// serem criados).
export async function instantiateTemplateForContract({ contractId, templateId, contractStartDate, cnpj, actorEmail }) {
  if (!templateId || !cnpj) return [];

  const items = await TaskTemplateItem.filter({ template_id: templateId });
  if (!items.length) return [];

  items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const itemIdToTaskId = new Map();
  const createdTasks = [];

  // 1ª passada: cria todas as tarefas (subtarefas ainda sem parent_task_id resolvido)
  for (const item of items) {
    const task = await Task.create({
      cnpj,
      title: item.title,
      description: item.description || null,
      status: 'a_fazer',
      priority: item.default_priority || 'normal',
      department: item.department || null,
      contract_id: contractId,
      template_item_id: item.id,
      start_date: addDays(contractStartDate, item.days_offset_start),
      due_date: addDays(contractStartDate, item.days_offset_due),
    });
    itemIdToTaskId.set(item.id, task.id);
    createdTasks.push(task);

    if (Array.isArray(item.checklist_items) && item.checklist_items.length) {
      const { TaskChecklistItem } = await import('@/entities/TaskChecklistItem');
      await Promise.all(item.checklist_items.map((title, idx) =>
        TaskChecklistItem.create({ cnpj, task_id: task.id, title, order_index: idx })
      ));
    }

    await logTaskActivity({ cnpj, taskId: task.id, action: 'created', actorEmail, newValue: 'Criada via modelo de tarefas' });
  }

  // 2ª passada: resolve subtarefas (parent_item_id) e dependências (depends_on_item_id)
  for (const item of items) {
    const taskId = itemIdToTaskId.get(item.id);

    if (item.parent_item_id && itemIdToTaskId.has(item.parent_item_id)) {
      await Task.update(taskId, { parent_task_id: itemIdToTaskId.get(item.parent_item_id) });
    }

    if (item.depends_on_item_id && itemIdToTaskId.has(item.depends_on_item_id)) {
      await TaskDependency.create({
        cnpj,
        task_id: taskId,
        depends_on_task_id: itemIdToTaskId.get(item.depends_on_item_id),
      });
    }
  }

  return createdTasks;
}
