import React, { useMemo } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { getPriorityMeta } from "./taskConstants";
import { getDateRange, getBarPosition, totalDays } from "./ganttDateMath";

const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 240;

// Progresso aproximado (não carrega o checklist de cada tarefa para não gerar
// dezenas de consultas extras só para desenhar o Gantt — usa o status como
// proxy simples e barato de "quanto falta").
function approxProgress(status) {
  if (status === "concluida") return 100;
  if (status === "revisao") return 80;
  if (status === "em_andamento") return 50;
  if (status === "aguardando" || status === "bloqueada") return 20;
  return 0;
}

export default function TaskGanttView({ tasks, dependencies, onOpenTask }) {
  const withDates = useMemo(() => tasks.filter((t) => t.start_date || t.due_date), [tasks]);

  const rows = useMemo(() => {
    const byId = new Map(withDates.map((t) => [t.id, t]));
    const topLevel = withDates.filter((t) => !t.parent_task_id || !byId.has(t.parent_task_id));
    const ordered = [];
    const seen = new Set();
    topLevel.forEach((t) => {
      if (seen.has(t.id)) return;
      ordered.push(t);
      seen.add(t.id);
      withDates.filter((s) => s.parent_task_id === t.id).forEach((s) => {
        if (!seen.has(s.id)) { ordered.push(s); seen.add(s.id); }
      });
    });
    withDates.forEach((t) => { if (!seen.has(t.id)) { ordered.push(t); seen.add(t.id); } });
    return ordered;
  }, [withDates]);

  const range = useMemo(() => getDateRange(withDates), [withDates]);
  const days = useMemo(() => {
    const n = totalDays(range);
    return Array.from({ length: n }, (_, i) => addDays(range.start, i));
  }, [range]);

  const positions = useMemo(() => {
    const map = new Map();
    rows.forEach((task, index) => {
      const pos = getBarPosition(task, range);
      if (pos) map.set(task.id, { ...pos, rowIndex: index });
    });
    return map;
  }, [rows, range]);

  const relevantDependencies = useMemo(
    () => (dependencies || []).filter((d) => positions.has(d.task_id) && positions.has(d.depends_on_task_id)),
    [dependencies, positions]
  );

  if (!withDates.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa com data de início ou prazo definida.
      </div>
    );
  }

  const gridWidth = days.length * DAY_WIDTH;
  const gridHeight = rows.length * ROW_HEIGHT;

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <div style={{ minWidth: gridWidth + LABEL_WIDTH }}>
        <div className="flex sticky top-0 bg-muted/50 border-b border-border z-10">
          <div style={{ width: LABEL_WIDTH }} className="shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Tarefa</div>
          <div className="flex">
            {days.map((day, i) => (
              <div
                key={i}
                style={{ width: DAY_WIDTH }}
                className={`shrink-0 text-center py-2 text-[10px] border-l border-border ${isSameDay(day, new Date()) ? "bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}
              >
                {format(day, "dd/MM")}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex">
          <div style={{ width: LABEL_WIDTH }} className="shrink-0">
            {rows.map((task) => (
              <div key={task.id} style={{ height: ROW_HEIGHT }} className="flex items-center px-3 text-sm text-foreground truncate border-b border-border/60">
                {task.parent_task_id && <span className="text-muted-foreground mr-1">↳</span>}
                <span className="truncate">{task.title}</span>
              </div>
            ))}
          </div>

          <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
            {/* Grade de fundo */}
            <div className="absolute inset-0 flex">
              {days.map((_, i) => (
                <div key={i} style={{ width: DAY_WIDTH }} className="shrink-0 border-l border-border/50" />
              ))}
            </div>
            {rows.map((_, i) => (
              <div key={i} className="absolute left-0 right-0 border-b border-border/60" style={{ top: (i + 1) * ROW_HEIGHT }} />
            ))}

            {/* Linhas de dependência */}
            <svg className="absolute inset-0 pointer-events-none" width={gridWidth} height={gridHeight}>
              <defs>
                <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-blue-500" />
                </marker>
              </defs>
              {relevantDependencies.map((dep) => {
                const from = positions.get(dep.depends_on_task_id);
                const to = positions.get(dep.task_id);
                const x1 = (from.offset + from.span) * DAY_WIDTH;
                const y1 = from.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = to.offset * DAY_WIDTH;
                const y2 = to.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = x1 + Math.max(8, (x2 - x1) / 2);
                return (
                  <polyline
                    key={dep.id}
                    points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                    className="stroke-blue-400 dark:stroke-blue-500"
                    fill="none"
                    strokeWidth="1.5"
                    markerEnd="url(#gantt-arrow)"
                  />
                );
              })}
            </svg>

            {/* Barras das tarefas */}
            {rows.map((task) => {
              const pos = positions.get(task.id);
              if (!pos) return null;
              const progress = approxProgress(task.status);
              return (
                <div
                  key={task.id}
                  onClick={() => onOpenTask?.(task)}
                  title={task.title}
                  className={`absolute rounded-md overflow-hidden shadow-sm cursor-pointer hover:opacity-90 ${getPriorityMeta(task.priority).color}`}
                  style={{
                    left: pos.offset * DAY_WIDTH + 2,
                    width: pos.span * DAY_WIDTH - 4,
                    top: pos.rowIndex * ROW_HEIGHT + 8,
                    height: ROW_HEIGHT - 16,
                  }}
                >
                  <div className="h-full bg-black/15 dark:bg-white/10" style={{ width: `${progress}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
