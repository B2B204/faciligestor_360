import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";

import { TaskTemplateItem } from "@/entities/TaskTemplateItem";
import { TASK_PRIORITIES, DEPARTMENTS } from "./taskConstants";

const emptyItem = {
  title: "",
  description: "",
  department: "",
  default_priority: "normal",
  days_offset_start: 0,
  days_offset_due: 7,
  parent_item_id: null,
  depends_on_item_id: null,
  checklist_items: [],
};

export default function TaskTemplateItemsEditor({ templateId, cnpj }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(emptyItem);
  const [newChecklistText, setNewChecklistText] = useState("");

  useEffect(() => {
    if (templateId) loadItems();
  }, [templateId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await TaskTemplateItem.filter({ template_id: templateId });
      setItems(data.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    } catch (e) {
      console.error("Erro ao carregar itens do modelo:", e);
    }
    setIsLoading(false);
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData(emptyItem);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      description: item.description || "",
      department: item.department || "",
      default_priority: item.default_priority || "normal",
      days_offset_start: item.days_offset_start ?? 0,
      days_offset_due: item.days_offset_due ?? 7,
      parent_item_id: item.parent_item_id || null,
      depends_on_item_id: item.depends_on_item_id || null,
      checklist_items: item.checklist_items || [],
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("O título do item é obrigatório.");
      return;
    }
    try {
      if (editingItem) {
        await TaskTemplateItem.update(editingItem.id, formData);
      } else {
        await TaskTemplateItem.create({ ...formData, cnpj, template_id: templateId, order_index: items.length });
      }
      setFormOpen(false);
      await loadItems();
    } catch (e) {
      console.error("Erro ao salvar item do modelo:", e);
      alert("Erro ao salvar item do modelo.");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir o item "${item.title}"?`)) return;
    await TaskTemplateItem.delete(item.id);
    await loadItems();
  };

  const handleMove = async (item, direction) => {
    const index = items.findIndex((i) => i.id === item.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const other = items[swapIndex];
    await Promise.all([
      TaskTemplateItem.update(item.id, { order_index: other.order_index }),
      TaskTemplateItem.update(other.id, { order_index: item.order_index }),
    ]);
    await loadItems();
  };

  const addChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setFormData((prev) => ({ ...prev, checklist_items: [...prev.checklist_items, newChecklistText.trim()] }));
    setNewChecklistText("");
  };

  const removeChecklistItem = (idx) => {
    setFormData((prev) => ({ ...prev, checklist_items: prev.checklist_items.filter((_, i) => i !== idx) }));
  };

  const itemTitleById = (id) => items.find((i) => i.id === id)?.title || "—";
  const parentOptions = items.filter((i) => i.id !== editingItem?.id);
  const dependencyOptions = items.filter((i) => i.id !== editingItem?.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} tarefa(s) neste modelo</p>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Adicionar Tarefa</Button>
      </div>

      {isLoading ? (
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa cadastrada neste modelo ainda.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.parent_item_id && <span className="text-muted-foreground mr-1">↳</span>}
                  {item.title}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs">D+{item.days_offset_start} → D+{item.days_offset_due}</Badge>
                  {item.department && <Badge variant="secondary" className="text-xs capitalize">{item.department}</Badge>}
                  {item.depends_on_item_id && <Badge variant="secondary" className="text-xs">após: {itemTitleById(item.depends_on_item_id)}</Badge>}
                  {item.checklist_items?.length > 0 && <Badge variant="secondary" className="text-xs">{item.checklist_items.length} checklist</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => handleMove(item, "up")}><ArrowUp className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" disabled={idx === items.length - 1} onClick={() => handleMove(item, "down")}><ArrowDown className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Tarefa do Modelo" : "Nova Tarefa do Modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Enviar contrato" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Departamento</Label>
                <Select value={formData.department || "none"} onValueChange={(v) => setFormData((p) => ({ ...p, department: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade padrão</Label>
                <Select value={formData.default_priority} onValueChange={(v) => setFormData((p) => ({ ...p, default_priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((pr) => <SelectItem key={pr.value} value={pr.value}>{pr.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início (dias após início do contrato)</Label>
                <Input type="number" value={formData.days_offset_start} onChange={(e) => setFormData((p) => ({ ...p, days_offset_start: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Prazo (dias após início do contrato)</Label>
                <Input type="number" value={formData.days_offset_due} onChange={(e) => setFormData((p) => ({ ...p, days_offset_due: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subtarefa de</Label>
                <Select value={formData.parent_item_id || "none"} onValueChange={(v) => setFormData((p) => ({ ...p, parent_item_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (tarefa principal)</SelectItem>
                    {parentOptions.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Depende de</Label>
                <Select value={formData.depends_on_item_id || "none"} onValueChange={(v) => setFormData((p) => ({ ...p, depends_on_item_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {dependencyOptions.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Checklist padrão</Label>
              <div className="space-y-1 mb-2">
                {formData.checklist_items.map((ci, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{ci}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeChecklistItem(idx)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)} placeholder="Novo item de checklist..." onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())} />
                <Button type="button" onClick={addChecklistItem}><Plus className="w-4 h-4" /></Button>
              </div>
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
