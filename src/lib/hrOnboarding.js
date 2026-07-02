import { HrChecklistTemplate } from '@/entities/HrChecklistTemplate';
import { EmployeeTask } from '@/entities/EmployeeTask';

/**
 * Gera as tarefas de admissão (onboarding) ou demissão (offboarding) para um
 * funcionário a partir dos modelos ativos cadastrados. Idempotente: não gera
 * novamente se o funcionário já possuir tarefas desse tipo.
 */
export async function generateEmployeeTasks({ employeeId, cnpj, type, userEmail }) {
  if (!employeeId || !cnpj || !type) return { generated: 0 };

  const existing = await EmployeeTask.filter({ cnpj, employee_id: employeeId, type });
  if (existing.length > 0) return { generated: 0, alreadyExisted: true };

  const templates = await HrChecklistTemplate.filter({ cnpj, type, is_active: true });
  if (templates.length === 0) return { generated: 0 };

  const sorted = [...templates].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const rows = sorted.map((tpl) => ({
    cnpj,
    employee_id: employeeId,
    type,
    title: tpl.title,
    category: tpl.category || null,
    sort_order: tpl.sort_order || 0,
    is_done: false,
    created_by: userEmail,
  }));

  await EmployeeTask.bulkCreate(rows);
  return { generated: rows.length };
}
