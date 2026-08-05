import { TaskActivityLog } from '@/entities/TaskActivityLog';

// Registra o histórico de uma tarefa (quem criou/alterou/concluiu/excluiu).
// Nunca deve interromper a operação principal — uma falha ao logar não pode
// impedir o usuário de salvar a tarefa.
export async function logTaskActivity({ cnpj, taskId, action, fieldChanged, oldValue, newValue, actorEmail }) {
  if (!cnpj || !taskId) return;
  try {
    await TaskActivityLog.create({
      cnpj,
      task_id: taskId,
      action,
      field_changed: fieldChanged || null,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
      actor_email: actorEmail || null,
    });
  } catch (err) {
    console.warn('[taskActivityLogger] falha ao registrar atividade:', err);
  }
}
