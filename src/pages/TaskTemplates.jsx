import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ClipboardCheck, ListChecks } from "lucide-react";

import { TaskTemplate } from "@/entities/TaskTemplate";
import { User } from "@/entities/User";
import TaskTemplateItemsEditor from "@/components/tasks/TaskTemplateItemsEditor";

const CATEGORIES = [
  { value: "implantacao", label: "Implantação" },
  { value: "financeiro", label: "Financeiro" },
  { value: "rh", label: "RH" },
  { value: "comercial", label: "Comercial" },
  { value: "engenharia", label: "Engenharia" },
  { value: "facilities", label: "Facilities" },
  { value: "outros", label: "Outros" },
];

const emptyTemplate = { name: "", description: "", category: "implantacao", is_active: true };

export default function TaskTemplatesPage() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState(emptyTemplate);

  const [itemsTemplate, setItemsTemplate] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const data = await TaskTemplate.filter({ cnpj: currentUser.cnpj });
      setTemplates(data);
    } catch (e) {
      console.error("Erro ao carregar modelos de tarefas:", e);
    }
    setIsLoading(false);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setFormData(emptyTemplate);
    setFormOpen(true);
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || "",
      description: template.description || "",
      category: template.category || "implantacao",
      is_active: template.is_active !== false,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("O nome do modelo é obrigatório.");
      return;
    }
    try {
      if (editingTemplate) {
        await TaskTemplate.update(editingTemplate.id, formData);
      } else {
        await TaskTemplate.create({ ...formData, cnpj: user.cnpj });
      }
      setFormOpen(false);
      await loadData();
    } catch (e) {
      console.error("Erro ao salvar modelo:", e);
      alert("Erro ao salvar modelo.");
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Excluir o modelo "${template.name}"? As tarefas dos itens deste modelo não serão excluídas.`)) return;
    try {
      await TaskTemplate.delete(template.id);
      await loadData();
    } catch (e) {
      console.error("Erro ao excluir modelo:", e);
      alert("Erro ao excluir modelo.");
    }
  };

  const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || value;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" /> Modelos de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre modelos reutilizáveis para gerar automaticamente as tarefas de um contrato
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Modelo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum modelo cadastrado</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie modelos como "Implantação", "Financeiro" ou "RH" para automatizar a criação de tarefas.</p>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Modelo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="bg-card border-border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <Badge variant="secondary" className="mt-1 capitalize">{categoryLabel(template.category)}</Badge>
                  </div>
                  {!template.is_active && <Badge variant="outline">Inativo</Badge>}
                </div>
                {template.description && <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setItemsTemplate(template)}>
                    <ListChecks className="w-4 h-4 mr-1" /> Tarefas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(template)}><Edit className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(template)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Modelo" : "Novo Modelo de Tarefas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Modelo Implantação" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemsTemplate} onOpenChange={(v) => !v && setItemsTemplate(null)}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>Tarefas do Modelo — {itemsTemplate?.name}</DialogTitle>
          </DialogHeader>
          {itemsTemplate && <TaskTemplateItemsEditor templateId={itemsTemplate.id} cnpj={user?.cnpj} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
