import React, { useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format, isPast } from "date-fns";
import { getStatusMeta, getPriorityMeta, TASK_STATUSES, TASK_PRIORITIES } from "./taskConstants";

const GROUP_OPTIONS = [
  { value: "none", label: "Sem agrupamento" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Prioridade" },
  { value: "department", label: "Departamento" },
  { value: "assignee_email", label: "Responsável" },
];

const SORT_COLUMNS = [
  { key: "title", label: "Tarefa" },
  { key: "contract_name", label: "Contrato" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Prioridade" },
  { key: "due_date", label: "Prazo" },
  { key: "created_at", label: "Criada em" },
];

const statusOrder = TASK_STATUSES.reduce((acc, s, idx) => ({ ...acc, [s.value]: idx }), {});
const priorityOrder = TASK_PRIORITIES.reduce((acc, p, idx) => ({ ...acc, [p.value]: idx }), {});

function groupLabel(groupBy, value) {
  if (!value) return "—";
  if (groupBy === "status") return getStatusMeta(value).label;
  if (groupBy === "priority") return getPriorityMeta(value).label;
  return value;
}

export default function TaskTableView({ tasks, onOpenTask }) {
  const [groupBy, setGroupBy] = useState("none");
  const [sortKey, setSortKey] = useState("due_date");
  const [sortDir, setSortDir] = useState("asc");

  const sortedTasks = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "status") { av = statusOrder[a.status] ?? 99; bv = statusOrder[b.status] ?? 99; }
      if (sortKey === "priority") { av = priorityOrder[a.priority] ?? 99; bv = priorityOrder[b.priority] ?? 99; }
      if (sortKey === "due_date" || sortKey === "created_at") {
        av = av ? new Date(av).getTime() : Infinity;
        bv = bv ? new Date(bv).getTime() : Infinity;
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av == null) av = "";
      if (bv == null) bv = "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: null, tasks: sortedTasks }];
    const map = new Map();
    sortedTasks.forEach((t) => {
      const key = t[groupBy] || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return Array.from(map.entries()).map(([key, tasks]) => ({ key, tasks }));
  }, [sortedTasks, groupBy]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Agrupar por</span>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {SORT_COLUMNS.map((col) => (
                <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort(col.key)}>
                  <span className="flex items-center gap-1">{col.label} <SortIcon column={col.key} /></span>
                </TableHead>
              ))}
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <React.Fragment key={group.key ?? "all"}>
                {group.key !== null && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={SORT_COLUMNS.length + 1} className="font-semibold text-xs text-foreground py-2">
                      {groupLabel(groupBy, group.key)} <span className="text-muted-foreground font-normal">({group.tasks.length})</span>
                    </TableCell>
                  </TableRow>
                )}
                {group.tasks.map((task) => {
                  const late = task.due_date && isPast(new Date(task.due_date)) && !["concluida", "cancelada"].includes(task.status);
                  return (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpenTask(task)}>
                      <TableCell className="font-medium text-foreground">
                        {task.parent_task_id && <span className="text-muted-foreground mr-1">↳</span>}
                        {task.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{task.contract_name || "—"}</TableCell>
                      <TableCell><Badge className={`${getStatusMeta(task.status).color} border-0`}>{getStatusMeta(task.status).label}</Badge></TableCell>
                      <TableCell><Badge className={`${getPriorityMeta(task.priority).color} border-0`}>{getPriorityMeta(task.priority).label}</Badge></TableCell>
                      <TableCell className={`text-sm ${late ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        {task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.created_at ? format(new Date(task.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{task.assignee_email || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
