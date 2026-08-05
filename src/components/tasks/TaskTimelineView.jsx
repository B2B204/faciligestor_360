import React, { useMemo } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPriorityMeta } from "./taskConstants";
import { getDateRange, getBarPosition, totalDays } from "./ganttDateMath";

const DAY_WIDTH = 32;

export default function TaskTimelineView({ tasks, onOpenTask }) {
  const withDates = useMemo(() => tasks.filter((t) => t.start_date || t.due_date), [tasks]);
  const range = useMemo(() => getDateRange(withDates), [withDates]);
  const days = useMemo(() => {
    const n = totalDays(range);
    return Array.from({ length: n }, (_, i) => addDays(range.start, i));
  }, [range]);

  if (!withDates.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa com data de início ou prazo definida.
      </div>
    );
  }

  const gridWidth = days.length * DAY_WIDTH;

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <div style={{ minWidth: gridWidth + 220 }}>
        {/* Cabeçalho de datas */}
        <div className="flex sticky top-0 bg-muted/50 border-b border-border z-10">
          <div className="w-56 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Tarefa</div>
          <div className="flex">
            {days.map((day, i) => (
              <div
                key={i}
                style={{ width: DAY_WIDTH }}
                className={`shrink-0 text-center py-2 text-[10px] border-l border-border ${isSameDay(day, new Date()) ? "bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}
              >
                <div>{format(day, "dd")}</div>
                <div className="uppercase">{format(day, "EEEEE", { locale: ptBR })}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Linhas de tarefas */}
        {withDates.map((task) => {
          const pos = getBarPosition(task, range);
          if (!pos) return null;
          return (
            <div key={task.id} className="flex border-b border-border last:border-b-0 hover:bg-muted/20">
              <div className="w-56 shrink-0 px-3 py-2 text-sm text-foreground truncate flex items-center gap-1.5">
                {task.parent_task_id && <span className="text-muted-foreground">↳</span>}
                {task.title}
              </div>
              <div className="relative flex" style={{ width: gridWidth, height: 40 }}>
                {days.map((_, i) => (
                  <div key={i} style={{ width: DAY_WIDTH }} className="shrink-0 border-l border-border/50" />
                ))}
                <div
                  onClick={() => onOpenTask?.(task)}
                  className={`absolute top-1.5 h-6 rounded-md ${getPriorityMeta(task.priority).color} flex items-center px-1.5 text-[10px] font-medium truncate shadow-sm cursor-pointer hover:opacity-80`}
                  style={{ left: pos.offset * DAY_WIDTH + 2, width: pos.span * DAY_WIDTH - 4 }}
                  title={task.title}
                >
                  {task.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
