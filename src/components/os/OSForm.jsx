import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Contract } from "@/entities/Contract";
import { ServiceOrder } from "@/entities/ServiceOrder";
import { Employee } from "@/entities/Employee";
import { User } from "@/entities/User";
import { UploadFile } from "@/integrations/Core";
import { Badge } from "@/components/ui/badge";

const priorities = ["Baixa","Média","Alta","Crítica"];
const statuses = ["Aberta","Em Andamento","Aguardando Aprovação","Concluída","Cancelada"];
const serviceTypes = ["manutencao","limpeza","eletrica","hidraulica","ar_condicionado","administrativo","outros"];

export default function OSForm({ os, onSaved, onCancel }) {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState(os?.attachments || []);
  const [form, setForm] = useState({
    os_number: os?.os_number || "",
    contract_id: os?.contract_id || "",
    unit_name: os?.unit_name || "",
    service_type: os?.service_type || "manutencao",
    priority: os?.priority || "Média",
    status: os?.status || "Aberta",
    requester_name: os?.requester_name || "",
    requester_email: os?.requester_email || "",
    requester_phone: os?.requester_phone || "",
    description: os?.description || "",
    opened_at: os?.opened_at || new Date().toISOString().slice(0,16),
    due_at: os?.due_at || ""
  });
  const [assignee, setAssignee] = useState({
    assignee_id: os?.assignee_id || "",
    assignee_name: os?.assignee_name || ""
  });

  useEffect(() => {
    (async ()=> {
      const u = await User.me();
      setUser(u);
      const cs = await Contract.filter({ cnpj: u.cnpj, status: "ativo" });
      setContracts(cs);
      const emps = await Employee.filter({ cnpj: u.cnpj });
      setEmployees(emps);
      if (!os) {
        const year = new Date().getFullYear();
        const all = await ServiceOrder.filter({ cnpj: u.cnpj });
        const seqs = all
          .map(o => o.os_number)
          .filter(n => typeof n === "string" && n.endsWith(`/${year}`))
          .map(n => {
            const m = n.match(/^OS-(\d{4})\//);
            return m ? parseInt(m[1], 10) : 0;
          });
        const next = (Math.max(0, ...seqs) + 1);
        const num = `OS-${String(next).padStart(4, "0")}/${year}`;
        setForm(f => ({ ...f, os_number: num }));
      }
    })();
  }, [os]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await UploadFile({ file });
    setAttachments(prev => [...prev, file_url]);
  };

  const canSave = useMemo(() => {
    const req = ["os_number","contract_id","unit_name","service_type","priority","status","requester_name","opened_at","requester_email","requester_phone","description"];
    return req.every(k => String(form[k] || "").trim().length > 0);
  }, [form]);

  const onSubmit = async (nextStatus) => {
    if (!user || !canSave) return;
    setIsSaving(true);
    const selectedContract = contracts.find(c => c.id === form.contract_id);
    const payload = {
      ...form,
      opened_at: form.opened_at?.length === 16 ? `${form.opened_at}:00` : form.opened_at,
      due_at: form.due_at ? (form.due_at.length === 16 ? `${form.due_at}:00` : form.due_at) : undefined,
      attachments,
      assignee_id: assignee.assignee_id || undefined,
      assignee_name: assignee.assignee_name || (employees.find(e=>e.id===assignee.assignee_id)?.name),
      contract_number: selectedContract?.contract_number,
      last_updated_by: user.email,
      last_updated_at: new Date().toISOString(),
      cnpj: user.cnpj
    };
    if (nextStatus) payload.status = nextStatus;

    if (os) {
      await ServiceOrder.update(os.id, payload);
    } else {
      await ServiceOrder.create(payload);
    }
    setIsSaving(false);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Número da OS</Label>
          <Input value={form.os_number} onChange={(e)=>setForm({...form, os_number: e.target.value})} />
          <p className="text-xs text-gray-500 mt-1">Pode editar manualmente a numeração sugerida.</p>
        </div>
        <div>
          <Label>Contrato</Label>
          <Select value={form.contract_id} onValueChange={(v)=>setForm({...form, contract_id: v})}>
            <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
            <SelectContent>
              {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unidade / Local</Label>
          <Input value={form.unit_name} onChange={(e)=>setForm({...form, unit_name: e.target.value})} />
        </div>
        <div>
          <Label>Tipo de serviço</Label>
          <Select value={form.service_type} onValueChange={(v)=>setForm({...form, service_type: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {serviceTypes.map(v=> (<SelectItem key={v} value={v}>{v.replace("_"," ")}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data/hora de abertura</Label>
          <Input type="datetime-local" value={form.opened_at} onChange={(e)=>setForm({...form, opened_at: e.target.value})} />
        </div>
        <div>
          <Label>Prazo estimado</Label>
          <Input type="datetime-local" value={form.due_at || ""} onChange={(e)=>setForm({...form, due_at: e.target.value})} />
        </div>
        <div>
          <Label>Prioridade</Label>
          <Select value={form.priority} onValueChange={(v)=>setForm({...form, priority: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map(v=> (<SelectItem key={v} value={v}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map(v=> (<SelectItem key={v} value={v}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Solicitante (nome)</Label>
          <Input value={form.requester_name} onChange={(e)=>setForm({...form, requester_name: e.target.value})} />
        </div>
        <div>
          <Label>Solicitante (e-mail)</Label>
          <Input type="email" value={form.requester_email} onChange={(e)=>setForm({...form, requester_email: e.target.value})} />
        </div>
        <div>
          <Label>Solicitante (WhatsApp/telefone)</Label>
          <Input value={form.requester_phone} onChange={(e)=>setForm({...form, requester_phone: e.target.value})} />
        </div>
        <div>
          <Label>Responsável</Label>
          <Select
            value={assignee.assignee_id}
            onValueChange={(v)=>setAssignee({ assignee_id: v, assignee_name: employees.find(e=>e.id===v)?.name || "" })}
          >
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {assignee.assignee_name && <p className="text-xs text-gray-500 mt-1">Selecionado: {assignee.assignee_name}</p>}
        </div>
      </div>

      <div>
        <Label>Descrição detalhada</Label>
        <Textarea className="h-28" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} />
      </div>

      <div>
        <Label>Anexos</Label>
        <div className="flex items-center gap-2">
          <Input type="file" onChange={handleUpload} />
          <span className="text-xs text-gray-500">Imagens, PDFs, vídeos curtos</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((url, i)=>(
            <Badge key={i} variant="secondary" className="truncate max-w-[220px]">{url.split('/').pop()}</Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!canSave || isSaving} onClick={()=>onSubmit()} className="bg-blue-600 hover:bg-blue-700">
          {isSaving ? "Salvando..." : (os ? "Atualizar OS" : "Criar OS")}
        </Button>
        <Button disabled={!canSave || isSaving} onClick={()=>onSubmit("Em Andamento")} variant="outline">
          {isSaving ? "Salvando..." : "Salvar e Iniciar"}
        </Button>
      </div>
    </div>
  );
}