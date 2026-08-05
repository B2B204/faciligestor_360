import { differenceInCalendarDays, addDays, startOfDay } from "date-fns";

// Calcula a janela de datas (início/fim) que cobre todas as tarefas com
// start_date/due_date, com uma margem de alguns dias para as barras não
// ficarem coladas nas bordas do gráfico.
export function getDateRange(tasks, marginDays = 3) {
  const dates = [];
  tasks.forEach((t) => {
    if (t.start_date) dates.push(new Date(t.start_date));
    if (t.due_date) dates.push(new Date(t.due_date));
  });

  const today = startOfDay(new Date());
  if (!dates.length) {
    return { start: addDays(today, -marginDays), end: addDays(today, 14 + marginDays) };
  }

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  return { start: addDays(startOfDay(min), -marginDays), end: addDays(startOfDay(max), marginDays) };
}

// Posição/largura de uma barra (em "dias" a partir do início da janela),
// para ser multiplicada pela largura em px de cada dia (dayWidth) no componente.
export function getBarPosition(task, rangeStart) {
  const start = task.start_date ? new Date(task.start_date) : task.due_date ? new Date(task.due_date) : null;
  const end = task.due_date ? new Date(task.due_date) : start;
  if (!start) return null;

  const offset = Math.max(0, differenceInCalendarDays(startOfDay(start), rangeStart));
  const span = Math.max(1, differenceInCalendarDays(startOfDay(end), startOfDay(start)) + 1);
  return { offset, span };
}

export function totalDays(range) {
  return Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
}
