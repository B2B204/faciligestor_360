import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { TASK_STATUSES, TASK_PRIORITIES, DEPARTMENTS } from "./taskConstants";

const emptyTask = {
  title: "",
  description: "",
  status: "a_fazer",
  priority: "normal",
  department: "",
  contract_id: null,
  project_name: "",
  list_name: "",
  assignee_email: "",
  approver_email: "",
  start_date: "",
  due_date: "",
};

export default function TaskForm({ task, contracts, teamMembers, onChange }) {
  const [formData, setFormData] = useState(emptyTask);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "a_fazer",
        priority: task.priority || "normal",
        department: task.department || "",
        contract_id: task.contract_id || null,
        project_name: task.project_name || "",
        list_name: task.list_name || "",
        assignee_email: task.assignee_email || "",
        approver_email: task.approver_email || "",
        start_date: task.start_date || "",
        due_date: task.due_date || "",
      });
    } else {
      setFormData(emptyTask);
    }
  }, [task]);

  const update = (patch) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Ex: Enviar contrato assinado"
        />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Detalhes sobre a tarefa..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Prioridade</Label>
          <Select value={formData.priority} onValueChange={(v) => update({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Departamento</Label>
          <Select value={formData.department || "none"} onValueChange={(v) => update({ department: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contrato vinculado</Label>
          <Select value={formData.contract_id || "none"} onValueChange={(v) => update({ contract_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {(contracts || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Responsável</Label>
          <Select value={formData.assignee_email || "none"} onValueChange={(v) => update({ assignee_email: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Não atribuído" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não atribuído</SelectItem>
              {(teamMembers || []).map((m) => (
                <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Aprovador</Label>
          <Select value={formData.approver_email || "none"} onValueChange={(v) => update({ approver_email: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {(teamMembers || []).map((m) => (
                <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="project_name">Projeto</Label>
          <Input id="project_name" value={formData.project_name} onChange={(e) => update({ project_name: e.target.value })} placeholder="Ex: Implantação" />
        </div>
        <div>
          <Label htmlFor="list_name">Lista</Label>
          <Input id="list_name" value={formData.list_name} onChange={(e) => update({ list_name: e.target.value })} placeholder="Ex: Documentação" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Data de início</Label>
          <Input type="date" id="start_date" value={formData.start_date} onChange={(e) => update({ start_date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="due_date">Prazo</Label>
          <Input type="date" id="due_date" value={formData.due_date} onChange={(e) => update({ due_date: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
