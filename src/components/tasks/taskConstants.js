export const TASK_STATUSES = [
  { value: "a_fazer", label: "A Fazer", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "aguardando", label: "Aguardando", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "bloqueada", label: "Bloqueada", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "revisao", label: "Revisão", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "concluida", label: "Concluída", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "cancelada", label: "Cancelada", color: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
];

export const TASK_PRIORITIES = [
  { value: "muito_alta", label: "Muito Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "baixa", label: "Baixa", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "sem_prioridade", label: "Sem Prioridade", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
];

export function getStatusMeta(value) {
  return TASK_STATUSES.find((s) => s.value === value) || TASK_STATUSES[0];
}

export function getPriorityMeta(value) {
  return TASK_PRIORITIES.find((p) => p.value === value) || TASK_PRIORITIES[2];
}

export const DEPARTMENTS = [
  { value: "admin", label: "Administração" },
  { value: "gestor", label: "Gestão" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "compras", label: "Compras" },
  { value: "comercial", label: "Comercial" },
];
