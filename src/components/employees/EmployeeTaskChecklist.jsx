import React, { useMemo } from 'react';
import { EmployeeTask } from '@/entities/EmployeeTask';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';

export default function EmployeeTaskChecklist({ tasks, user, onChanged }) {
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [tasks]
  );

  const toggle = async (task) => {
    await EmployeeTask.update(task.id, {
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
      done_by: !task.is_done ? user?.email : null,
    });
    onChanged?.();
  };

  const remove = async (task) => {
    await EmployeeTask.delete(task.id);
    onChanged?.();
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Nenhuma tarefa neste checklist.</p>;
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((task) => (
        <div key={task.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <Checkbox checked={!!task.is_done} onCheckedChange={() => toggle(task)} />
            <span className={`text-sm ${task.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.title}
            </span>
            {task.category && (
              <span className="text-xs text-muted-foreground">· {task.category}</span>
            )}
          </label>
          <button onClick={() => remove(task)} className="text-red-500 hover:text-red-600 shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
