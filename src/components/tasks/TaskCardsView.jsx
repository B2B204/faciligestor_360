import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckSquare, ListTree } from "lucide-react";
import { format, isPast } from "date-fns";
import { getStatusMeta, getPriorityMeta } from "./taskConstants";

function initials(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

export default function TaskCardsView({ tasks, onOpenTask }) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        Nenhuma tarefa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tasks.map((task) => {
        const late = task.due_date && isPast(new Date(task.due_date)) && !["concluida", "cancelada"].includes(task.status);
        return (
          <Card
            key={task.id}
            className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onOpenTask(task)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-foreground text-sm line-clamp-2">{task.title}</h3>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(task.assignee_email)}</AvatarFallback>
                </Avatar>
              </div>

              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
              )}

              {task.contract_name && (
                <p className="text-xs text-muted-foreground truncate">{task.contract_name}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge className={`${getStatusMeta(task.status).color} border-0 text-xs`}>{getStatusMeta(task.status).label}</Badge>
                <Badge className={`${getPriorityMeta(task.priority).color} border-0 text-xs`}>{getPriorityMeta(task.priority).label}</Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                <span className={late ? "text-red-600 font-semibold" : ""}>
                  {task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "Sem prazo"}
                </span>
                <div className="flex items-center gap-2">
                  {task.checklist_count > 0 && (
                    <span className="flex items-center gap-0.5"><CheckSquare className="w-3 h-3" />{task.checklist_count}</span>
                  )}
                  {task.subtask_count > 0 && (
                    <span className="flex items-center gap-0.5"><ListTree className="w-3 h-3" />{task.subtask_count}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
