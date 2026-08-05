import React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isPast } from "date-fns";
import { getStatusMeta, getPriorityMeta } from "./taskConstants";

export default function TaskListView({ tasks, onOpenTask }) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Tarefa</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Prioridade</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Responsável</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Departamento</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">Prazo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const late = task.due_date && isPast(new Date(task.due_date)) && !["concluida", "cancelada"].includes(task.status);
            return (
              <TableRow key={task.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpenTask(task)}>
                <TableCell className="font-medium text-foreground">
                  {task.parent_task_id && <span className="text-muted-foreground mr-1">↳</span>}
                  {task.title}
                  {task.contract_name && <div className="text-xs text-muted-foreground">{task.contract_name}</div>}
                </TableCell>
                <TableCell><Badge className={`${getStatusMeta(task.status).color} border-0`}>{getStatusMeta(task.status).label}</Badge></TableCell>
                <TableCell><Badge className={`${getPriorityMeta(task.priority).color} border-0`}>{getPriorityMeta(task.priority).label}</Badge></TableCell>
                <TableCell className="text-sm text-foreground">{task.assignee_email || "—"}</TableCell>
                <TableCell className="text-sm text-foreground capitalize">{task.department || "—"}</TableCell>
                <TableCell className={`text-sm ${late ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  {task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
