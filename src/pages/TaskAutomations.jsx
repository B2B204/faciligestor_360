import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Zap, ArrowRight } from "lucide-react";

import { TaskAutomationRule } from "@/entities/TaskAutomationRule";
import { User } from "@/entities/User";
import { TASK_STATUSES, DEPARTMENTS } from "@/components/tasks/taskConstants";

const emptyRule = {
  name: "",
  is_active: true,
  trigger_type: "status_changed",
  trigger_config: { to_status: "concluida", department: "" },
  action_type: "create_task",
  action_config: { title: "", department: "", assignee_email: "", days_offset_due: 7, recipient_role: "assignee", message: "" },
};

const TRIGGER_LABELS = {
  status_changed: "Quando o status mudar para",
  due_date_passed: "Quando o prazo vencer",
};

const ACTION_LABELS = {
  create_task: "Criar nova tarefa",
  notify_alert: "Notificar",
};

export default function TaskAutomationsPage() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState(emptyRule);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const data = await TaskAutomationRule.filter({ cnpj: currentUser.cnpj });
      setRules(data);
    } catch (e) {
      console.error("Erro ao carregar automações:", e);
    }
    setIsLoading(false);
  };

  const openNew = () => {
    setEditingRule(null);
    setFormData(emptyRule);
    setFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || "",
      is_active: rule.is_active !== false,
      trigger_type: rule.trigger_type || "status_changed",
      trigger_config: rule.trigger_config || {},
      action_type: rule.action_type || "create_task",
      action_config: rule.action_config || {},
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("O nome da automação é obrigatório.");
      return;
    }
    try {
      if (editingRule) {
        await TaskAutomationRule.update(editingRule.id, formData);
      } else {
        await TaskAutomationRule.create({ ...formData, cnpj: user.cnpj });
      }
      setFormOpen(false);
      await loadData();
    } catch (e) {
      console.error("Erro ao salvar automação:", e);
      alert("Erro ao salvar automação.");
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Excluir a automação "${rule.name}"?`)) return;
    await TaskAutomationRule.delete(rule.id);
    await loadData();
  };

  const handleToggleActive = async (rule) => {
    await TaskAutomationRule.update(rule.id, { is_active: !rule.is_active });
    await loadData();
  };

  const summarize = (rule) => {
    const triggerDesc = rule.trigger_type === "status_changed"
      ? `${TRIGGER_LABELS.status_changed} "${TASK_STATUSES.find((s) => s.value === rule.trigger_config?.to_status)?.label || rule.trigger_config?.to_status}"`
      : TRIGGER_LABELS.due_date_passed;
    const actionDesc = rule.action_type === "create_task"
      ? `${ACTION_LABELS.create_task}: "${rule.action_config?.title || "(sem título)"}"`
      : `${ACTION_LABELS.notify_alert} ${rule.action_config?.recipient_role === "assignee" ? "o responsável" : "o gestor"}`;
    return { triggerDesc, actionDesc };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6" /> Automações de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure regras "quando X acontecer, faça Y" para automatizar sua operação
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Automação
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <Zap className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma automação cadastrada</h3>
          <p className="text-muted-foreground text-sm mb-4">Ex: "quando concluir tarefa, criar a próxima" ou "quando vencer prazo, notificar o gestor".</p>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Automação</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const { triggerDesc, actionDesc } = summarize(rule);
            return (
              <Card key={rule.id} className="bg-card border-border shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{rule.name}</h3>
                      {!rule.is_active && <Badge variant="outline">Inativa</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span>{triggerDesc}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{actionDesc}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.is_active} onCheckedChange={() => handleToggleActive(rule)} />
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(rule)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Automação" : "Nova Automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Criar tarefa de nota fiscal ao concluir pagamento" />
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-xs uppercase text-muted-foreground">Quando (gatilho)</Label>
              <Select value={formData.trigger_type} onValueChange={(v) => setFormData((p) => ({ ...p, trigger_type: v, trigger_config: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="status_changed">Status de uma tarefa mudar</SelectItem>
                  <SelectItem value="due_date_passed">Prazo de uma tarefa vencer</SelectItem>
                </SelectContent>
              </Select>

              {formData.trigger_type === "status_changed" && (
                <div>
                  <Label>Novo status</Label>
                  <Select
                    value={formData.trigger_config?.to_status || "concluida"}
                    onValueChange={(v) => setFormData((p) => ({ ...p, trigger_config: { ...p.trigger_config, to_status: v } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Restringir a um departamento (opcional)</Label>
                <Select
                  value={formData.trigger_config?.department || "none"}
                  onValueChange={(v) => setFormData((p) => ({ ...p, trigger_config: { ...p.trigger_config, department: v === "none" ? "" : v } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer departamento</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-xs uppercase text-muted-foreground">Então (ação)</Label>
              <Select value={formData.action_type} onValueChange={(v) => setFormData((p) => ({ ...p, action_type: v, action_config: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_task">Criar uma nova tarefa</SelectItem>
                  <SelectItem value="notify_alert">Enviar uma notificação</SelectItem>
                </SelectContent>
              </Select>

              {formData.action_type === "create_task" && (
                <>
                  <div>
                    <Label>Título da nova tarefa</Label>
                    <Input
                      value={formData.action_config?.title || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, action_config: { ...p.action_config, title: e.target.value } }))}
                      placeholder="Ex: Emitir nota fiscal"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Departamento responsável</Label>
                      <Select
                        value={formData.action_config?.department || "none"}
                        onValueChange={(v) => setFormData((p) => ({ ...p, action_config: { ...p.action_config, department: v === "none" ? "" : v } }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Herdar da tarefa de origem</SelectItem>
                          {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prazo (dias a partir de hoje)</Label>
                      <Input
                        type="number"
                        value={formData.action_config?.days_offset_due ?? 7}
                        onChange={(e) => setFormData((p) => ({ ...p, action_config: { ...p.action_config, days_offset_due: Number(e.target.value) } }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.action_type === "notify_alert" && (
                <>
                  <div>
                    <Label>Notificar</Label>
                    <Select
                      value={formData.action_config?.recipient_role || "assignee"}
                      onValueChange={(v) => setFormData((p) => ({ ...p, action_config: { ...p.action_config, recipient_role: v } }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assignee">O responsável pela tarefa</SelectItem>
                        <SelectItem value="gestor">Toda a gestão (alerta geral)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mensagem</Label>
                    <Textarea
                      value={formData.action_config?.message || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, action_config: { ...p.action_config, message: e.target.value } }))}
                      placeholder="Ex: Prazo da tarefa vencido, verificar andamento."
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
