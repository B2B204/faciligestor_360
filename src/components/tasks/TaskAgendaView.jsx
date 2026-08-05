import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isTomorrow, isThisWeek, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusMeta, getPriorityMeta, TASK_PRIORITIES } from "./taskConstants";

const priorityOrder = TASK_PRIORITIES.reduce((acc, p, idx) => ({ ...acc, [p.value]: idx }), {});

function groupKeyFor(task) {
  if (!task.due_date) return "sem_prazo";
  const date = startOfDay(new Date(task.due_date));
  if (isPast(date) && !isToday(date)) return "atrasadas";
  if (isToday(date)) return "hoje";
  if (isTomorrow(date)) return "amanha";
  if (isThisWeek(date, { weekStartsOn: 0 })) return "semana";
  return "depois";
}

const GROUP_META = {
  atrasadas: { label: "Atrasadas", color: "text-red-600" },
  hoje: { label: "Hoje", color: "text-foreground" },
  amanha: { label: "Amanhã", color: "text-foreground" },
  semana: { label: "Esta Semana", color: "text-foreground" },
  depois: { label: "Mais Adiante", color: "text-muted-foreground" },
  sem_prazo: { label: "Sem Prazo", color: "text-muted-foreground" },
};

const GROUP_ORDER = ["atrasadas", "hoje", "amanha", "semana", "depois", "sem_prazo"];

export default function TaskAgendaView({ tasks, onOpenTask }) {
  const groups = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = groupKeyFor(t);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    map.forEach((list) => list.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)));
    return GROUP_ORDER.filter((key) => map.has(key)).map((key) => ({ key, tasks: map.get(key) }));
  }, [tasks]);

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${GROUP_META[group.key].color}`}>
            {GROUP_META[group.key].label} <span className="text-muted-foreground font-normal normal-case">({group.tasks.length})</span>
          </h3>
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenTask(task)}
                className="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-card hover:shadow-sm cursor-pointer transition-shadow"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.contract_name ? `${task.contract_name} · ` : ""}
                    {task.due_date ? format(new Date(task.due_date), "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Sem prazo"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`${getPriorityMeta(task.priority).color} border-0 text-xs`}>{getPriorityMeta(task.priority).label}</Badge>
                  <Badge className={`${getStatusMeta(task.status).color} border-0 text-xs`}>{getStatusMeta(task.status).label}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
