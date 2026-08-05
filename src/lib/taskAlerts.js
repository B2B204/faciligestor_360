import { Alert } from '@/entities/Alert';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';

const DUE_TIERS = [3, 1, 0]; // dias restantes: 3 dias, amanhã, hoje/atrasada

function existingKey(type, entityId) {
  return `${type}|${entityId}`;
}

// Gera alertas de prazo (a vencer/atrasada) para tarefas, no mesmo padrão
// idempotente de generateOperationalAlerts (dedupe por tipo+entidade).
// Visível para toda a empresa (sem `recipients`) — é informação de gestão.
export async function generateTaskDueAlerts({ cnpj, tasks }) {
  if (!cnpj || !tasks?.length) return { created: 0 };

  const today = startOfDay(new Date());
  const existingAlerts = await Alert.filter({ cnpj });
  const existingSet = new Set(existingAlerts.map((a) => existingKey(a.type, a.entity_id)));
  const toCreate = [];

  tasks.forEach((task) => {
    if (!task.due_date) return;
    if (['concluida', 'cancelada'].includes(task.status)) return;

    const due = startOfDay(new Date(task.due_date));
    const daysLeft = differenceInCalendarDays(due, today);

    let type = null;
    let message = null;
    if (daysLeft < 0) {
      type = 'task_overdue';
      message = `Tarefa "${task.title}" está atrasada desde ${format(due, 'dd/MM/yyyy')}.`;
    } else if (DUE_TIERS.includes(daysLeft)) {
      type = 'task_due_soon';
      message = daysLeft === 0
        ? `Tarefa "${task.title}" vence hoje (${format(due, 'dd/MM/yyyy')}).`
        : `Tarefa "${task.title}" vence em ${daysLeft} dia(s) (${format(due, 'dd/MM/yyyy')}).`;
    }

    if (!type) return;
    const key = existingKey(type, task.id);
    if (existingSet.has(key)) return;
    existingSet.add(key);
    toCreate.push({
      cnpj,
      type,
      entity_id: task.id,
      entity_type: 'Task',
      due_date: format(due, 'yyyy-MM-dd'),
      status: 'pending',
      message,
      recipients: [],
    });
  });

  for (const alert of toCreate) {
    await Alert.create(alert);
  }
  return { created: toCreate.length };
}

// Notificação pessoal ao responsável de uma tarefa quando ele é atribuído/trocado.
export async function notifyAssigneeChanged({ cnpj, task, newAssigneeEmail, actorEmail }) {
  if (!cnpj || !newAssigneeEmail) return;
  try {
    await Alert.create({
      cnpj,
      type: 'task_assigned',
      entity_id: task.id,
      entity_type: 'Task',
      due_date: task.due_date || null,
      status: 'pending',
      message: `${actorEmail || 'Alguém'} atribuiu a tarefa "${task.title}" para você.`,
      recipients: [newAssigneeEmail],
    });
  } catch (err) {
    console.warn('[taskAlerts] falha ao notificar novo responsável:', err);
  }
}

// Notificação pessoal para usuários mencionados (@usuario) em um comentário.
export async function notifyMentions({ cnpj, task, comment, teamMembers, actorEmail }) {
  if (!cnpj || !comment?.body) return;
  try {
    const mentions = [...comment.body.matchAll(/@([\w.]+)/g)].map((m) => m[1].toLowerCase());
    if (!mentions.length) return;

    const matchedEmails = (teamMembers || [])
      .filter((m) => mentions.includes((m.email || '').split('@')[0].toLowerCase()))
      .map((m) => m.email)
      .filter((email) => email && email !== actorEmail);

    for (const email of [...new Set(matchedEmails)]) {
      await Alert.create({
        cnpj,
        type: 'task_commented',
        entity_id: task.id,
        entity_type: 'Task',
        due_date: null,
        status: 'pending',
        message: `${actorEmail || 'Alguém'} mencionou você em um comentário na tarefa "${task.title}".`,
        recipients: [email],
      });
    }
  } catch (err) {
    console.warn('[taskAlerts] falha ao notificar menções:', err);
  }
}
