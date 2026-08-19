import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Save, Trash2, Plus, Paperclip, X, Link2, Download } from "lucide-react";
import { format } from "date-fns";

import { Task } from "@/entities/Task";
import { TaskChecklistItem } from "@/entities/TaskChecklistItem";
import { TaskComment } from "@/entities/TaskComment";
import { TaskAttachment } from "@/entities/TaskAttachment";
import { TaskActivityLog } from "@/entities/TaskActivityLog";
import { TaskDependency } from "@/entities/TaskDependency";
import { UploadFile } from "@/integrations/Core";
import { logTaskActivity } from "@/lib/taskActivityLogger";
import { runStatusChangeAutomations } from "@/lib/taskAutomationEngine";
import { notifyAssigneeChanged, notifyMentions } from "@/lib/taskAlerts";
import TaskForm from "./TaskForm";
import { getStatusMeta, getPriorityMeta } from "./taskConstants";

export default function TaskDetailDialog({
  open, onOpenChange, task, parentTaskId, contracts, teamMembers, allTasks, user, onSaved, onDeleted
}) {
  const [formData, setFormData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [depToAdd, setDepToAdd] = useState("");

  const isEditing = !!task?.id;

  // Colunas DATE/TIMESTAMP e FKs rejeitam string vazia no Postgres; converte
  // os "" vindos do formulário em null para não falhar ao salvar.
  const sanitize = (data) => {
    const clean = { ...data };
    if (clean.start_date === "") clean.start_date = null;
    if (clean.due_date === "") clean.due_date = null;
    if (clean.contract_id === "") clean.contract_id = null;
    if (clean.assignee_email === "") clean.assignee_email = null;
    if (clean.approver_email === "") clean.approver_email = null;
    if (clean.department === "") clean.department = null;
    if (clean.parent_task_id === "") clean.parent_task_id = null;
    return clean;
  };

  const loadRelated = useCallback(async () => {
    if (!isEditing) return;
    try {
      const [subs, chk, com, att, hist, deps] = await Promise.all([
        Task.filter({ parent_task_id: task.id }),
        TaskChecklistItem.filter({ task_id: task.id }),
        TaskComment.filter({ task_id: task.id }),
        TaskAttachment.filter({ task_id: task.id }),
        TaskActivityLog.filter({ task_id: task.id }),
        TaskDependency.filter({ task_id: task.id }),
      ]);
      setSubtasks(subs);
      setChecklist(chk.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setComments(com.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setAttachments(att);
      setHistory(hist.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setDependencies(deps);
    } catch (e) {
      console.error("Erro ao carregar dados da tarefa:", e);
    }
  }, [isEditing, task]);

  useEffect(() => {
    if (open) {
      loadRelated();
    } else {
      setFormData(null);
      setSubtasks([]); setChecklist([]); setComments([]); setAttachments([]); setHistory([]); setDependencies([]);
    }
  }, [open, loadRelated]);

  const handleSave = async () => {
    if (!formData?.title?.trim()) {
      alert("O título da tarefa é obrigatório.");
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        const patch = sanitize(formData);
        const changes = [];
        if (task.status !== patch.status) changes.push(["status", task.status, patch.status, "status_changed"]);
        if ((task.due_date || null) !== patch.due_date) changes.push(["due_date", task.due_date, patch.due_date, "due_date_changed"]);
        if ((task.assignee_email || null) !== patch.assignee_email) changes.push(["assignee_email", task.assignee_email, patch.assignee_email, "assignee_changed"]);

        if (patch.status === "concluida" && task.status !== "concluida") {
          patch.completed_at = new Date().toISOString();
        }

        await Task.update(task.id, patch);

        for (const [field, oldV, newV, action] of changes) {
          await logTaskActivity({ cnpj: user.cnpj, taskId: task.id, action, fieldChanged: field, oldValue: oldV, newValue: newV, actorEmail: user.email });
        }
        if (!changes.length) {
          await logTaskActivity({ cnpj: user.cnpj, taskId: task.id, action: "updated", actorEmail: user.email });
        }

        if (task.status !== patch.status) {
          await runStatusChangeAutomations({ cnpj: user.cnpj, task: { ...task, ...patch }, newStatus: patch.status, actorEmail: user.email });
        }
        if ((task.assignee_email || null) !== patch.assignee_email && patch.assignee_email) {
          await notifyAssigneeChanged({ cnpj: user.cnpj, task: { ...task, ...patch }, newAssigneeEmail: patch.assignee_email, actorEmail: user.email });
        }
      } else {
        const created = await Task.create({
          ...sanitize(formData),
          cnpj: user.cnpj,
          parent_task_id: parentTaskId || null,
        });
        await logTaskActivity({ cnpj: user.cnpj, taskId: created.id, action: "created", actorEmail: user.email });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao salvar tarefa:", e);
      alert("Erro ao salvar tarefa.");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!window.confirm("Tem certeza que deseja excluir esta tarefa? Subtarefas também serão excluídas.")) return;
    try {
      await logTaskActivity({ cnpj: user.cnpj, taskId: task.id, action: "deleted", actorEmail: user.email });
      await Task.delete(task.id);
      onDeleted?.();
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao excluir tarefa:", e);
      alert("Erro ao excluir tarefa.");
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistTitle.trim() || !isEditing) return;
    const item = await TaskChecklistItem.create({
      cnpj: user.cnpj, task_id: task.id, title: newChecklistTitle.trim(), order_index: checklist.length,
    });
    setChecklist((prev) => [...prev, item]);
    setNewChecklistTitle("");
  };

  const handleToggleChecklistItem = async (item) => {
    await TaskChecklistItem.update(item.id, { is_done: !item.is_done });
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
  };

  const handleDeleteChecklistItem = async (item) => {
    await TaskChecklistItem.delete(item.id);
    setChecklist((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !isEditing) return;
    const comment = await TaskComment.create({
      cnpj: user.cnpj, task_id: task.id, author_email: user.email, body: newComment.trim(),
    });
    setComments((prev) => [...prev, comment]);
    setNewComment("");
    await logTaskActivity({ cnpj: user.cnpj, taskId: task.id, action: "commented", actorEmail: user.email });
    await notifyMentions({ cnpj: user.cnpj, task, comment, teamMembers, actorEmail: user.email });
  };

  const handleUploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isEditing) return;
    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      const attachment = await TaskAttachment.create({
        cnpj: user.cnpj, task_id: task.id, file_url, file_name: file.name, file_type: file.type, uploaded_by: user.email,
      });
      setAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      console.error("Erro ao anexar arquivo:", err);
      alert("Erro ao anexar arquivo.");
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const handleDeleteAttachment = async (att) => {
    await TaskAttachment.delete(att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !isEditing) return;
    const sub = await Task.create({
      cnpj: user.cnpj,
      title: newSubtaskTitle.trim(),
      parent_task_id: task.id,
      contract_id: task.contract_id || null,
      status: "a_fazer",
      priority: "normal",
    });
    setSubtasks((prev) => [...prev, sub]);
    setNewSubtaskTitle("");
  };

  const handleAddDependency = async () => {
    if (!depToAdd || !isEditing) return;
    const dep = await TaskDependency.create({ cnpj: user.cnpj, task_id: task.id, depends_on_task_id: depToAdd });
    setDependencies((prev) => [...prev, dep]);
    setDepToAdd("");
  };

  const handleRemoveDependency = async (dep) => {
    await TaskDependency.delete(dep.id);
    setDependencies((prev) => prev.filter((d) => d.id !== dep.id));
  };

  const taskTitleById = (id) => (allTasks || []).find((t) => t.id === id)?.title || "—";
  const dependencyOptions = (allTasks || []).filter(
    (t) => t.id !== task?.id && !dependencies.some((d) => d.depends_on_task_id === t.id)
  );

  const doneCount = checklist.filter((c) => c.is_done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {isEditing ? "Editar Tarefa" : "Nova Tarefa"}
            {isEditing && (
              <>
                <Badge className={`${getStatusMeta(task.status).color} border-0`}>{getStatusMeta(task.status).label}</Badge>
                <Badge className={`${getPriorityMeta(task.priority).color} border-0`}>{getPriorityMeta(task.priority).label}</Badge>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            {isEditing && <TabsTrigger value="subtarefas">Subtarefas ({subtasks.length})</TabsTrigger>}
            {isEditing && <TabsTrigger value="checklist">Checklist ({doneCount}/{checklist.length})</TabsTrigger>}
            {isEditing && <TabsTrigger value="dependencias">Dependências ({dependencies.length})</TabsTrigger>}
            {isEditing && <TabsTrigger value="comentarios">Comentários ({comments.length})</TabsTrigger>}
            {isEditing && <TabsTrigger value="anexos">Anexos ({attachments.length})</TabsTrigger>}
            {isEditing && <TabsTrigger value="historico">Histórico</TabsTrigger>}
          </TabsList>

          <TabsContent value="detalhes" className="pt-4">
            <TaskForm task={task} contracts={contracts} teamMembers={teamMembers} onChange={setFormData} />
          </TabsContent>

          {isEditing && (
            <TabsContent value="subtarefas" className="pt-4 space-y-3">
              {subtasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma subtarefa ainda.</p>}
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm text-foreground">{s.title}</span>
                  <Badge className={`${getStatusMeta(s.status).color} border-0`}>{getStatusMeta(s.status).label}</Badge>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Nova subtarefa..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()} />
                <Button type="button" onClick={handleAddSubtask}><Plus className="w-4 h-4" /></Button>
              </div>
            </TabsContent>
          )}

          {isEditing && (
            <TabsContent value="checklist" className="pt-4 space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <Checkbox checked={item.is_done} onCheckedChange={() => handleToggleChecklistItem(item)} />
                  <span className={`flex-1 text-sm ${item.is_done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.title}</span>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => handleDeleteChecklistItem(item)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Novo item de checklist..." value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()} />
                <Button type="button" onClick={handleAddChecklistItem}><Plus className="w-4 h-4" /></Button>
              </div>
            </TabsContent>
          )}

          {isEditing && (
            <TabsContent value="dependencias" className="pt-4 space-y-3">
              <p className="text-xs text-muted-foreground">Esta tarefa não pode ser considerada concluída antes das tarefas abaixo:</p>
              {dependencies.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma dependência.</p>}
              {dependencies.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm text-foreground flex items-center gap-2"><Link2 className="w-3.5 h-3.5" />{taskTitleById(dep.depends_on_task_id)}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveDependency(dep)}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={depToAdd} onValueChange={setDepToAdd}>
                  <SelectTrigger><SelectValue placeholder="Selecionar tarefa..." /></SelectTrigger>
                  <SelectContent>
                    {dependencyOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleAddDependency} disabled={!depToAdd}><Plus className="w-4 h-4" /></Button>
              </div>
            </TabsContent>
          )}

          {isEditing && (
            <TabsContent value="comentarios" className="pt-4 space-y-3">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="border-b pb-2">
                    <p className="text-sm font-medium text-foreground">{c.author_email}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {c.body.split(/(@\w[\w.]*)/g).map((part, i) =>
                        part.startsWith("@") ? <span key={i} className="text-blue-600 font-medium">{part}</span> : part
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea placeholder="Escreva um comentário... use @usuario para mencionar" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} />
                <Button type="button" onClick={handleAddComment} className="self-end">Enviar</Button>
              </div>
            </TabsContent>
          )}

          {isEditing && (
            <TabsContent value="anexos" className="pt-4 space-y-3">
              {attachments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="text-sm text-foreground flex items-center gap-2"><Paperclip className="w-3.5 h-3.5" />{a.file_name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={a.file_url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(a)}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50">
                <Paperclip className="w-4 h-4" />
                {isUploading ? "Enviando..." : "Clique para anexar arquivo (PDF, Word, Excel, imagem, vídeo, ZIP)"}
                <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={isUploading} />
              </label>
            </TabsContent>
          )}

          {isEditing && (
            <TabsContent value="historico" className="pt-4 space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground">Sem histórico.</p>}
              {history.map((h) => (
                <div key={h.id} className="text-sm border-b pb-2">
                  <p className="text-foreground">
                    <span className="font-medium">{h.actor_email || "Sistema"}</span> — {h.action}
                    {h.field_changed && ` (${h.field_changed}: ${h.old_value || "—"} → ${h.new_value || "—"})`}
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-between pt-4 border-t mt-4">
          <div>
            {isEditing && (
              <Button type="button" variant="ghost" className="text-red-600 hover:text-red-600" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" /> {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
