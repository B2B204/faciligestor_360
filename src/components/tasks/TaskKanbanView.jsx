import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { format, isPast } from "date-fns";
import { TASK_STATUSES, getPriorityMeta } from "./taskConstants";
import { Task } from "@/entities/Task";

export default function TaskKanbanView({ tasks, onOpenTask, onTaskMoved }) {
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const task = tasks.find((t) => t.id === draggableId);
    if (!task || task.status === destination.droppableId) return;

    try {
      await Task.update(draggableId, { status: destination.droppableId });
      onTaskMoved?.(draggableId, destination.droppableId);
    } catch (e) {
      console.error("Erro ao mover tarefa:", e);
      alert("Erro ao mover tarefa.");
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status.value);
          return (
            <div key={status.value} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-semibold text-sm text-foreground">{status.label}</h3>
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </div>
              <Droppable droppableId={status.value}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[120px] p-2 rounded-lg border border-border transition-colors ${snapshot.isDraggingOver ? "bg-muted" : "bg-muted/30"}`}
                  >
                    {columnTasks.map((task, index) => {
                      const late = task.due_date && isPast(new Date(task.due_date)) && !["concluida", "cancelada"].includes(task.status);
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => onOpenTask(task)}
                              className={`bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${dragSnapshot.isDragging ? "shadow-lg ring-2 ring-blue-400" : ""}`}
                            >
                              <p className="text-sm font-medium text-foreground line-clamp-2">{task.title}</p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge className={`${getPriorityMeta(task.priority).color} border-0 text-xs`}>{getPriorityMeta(task.priority).label}</Badge>
                                {task.due_date && (
                                  <span className={`text-xs ${late ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                                    {format(new Date(task.due_date), "dd/MM")}
                                  </span>
                                )}
                              </div>
                              {task.assignee_email && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{task.assignee_email}</p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
