import React, { useEffect, useMemo, useState } from "react";
import { ServiceOrder } from "@/entities/ServiceOrder";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User";
import OSForm from "@/components/os/OSForm";
import OSStats from "@/components/os/OSStats";
import ChecklistManager from "@/components/os/ChecklistManager";
import MaterialsManager from "@/components/os/MaterialsManager";
import TimeLogManager from "@/components/os/TimeLogManager";
import ExecutionPanel from "@/components/os/ExecutionPanel";
import OSPreview from "@/components/os/OSPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, ListChecks, MapPin } from "lucide-react";

export default function OSPage() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [filterContract, setFilterContract] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showChecklist, setShowChecklist] = useState(null);
  const [showMaterials, setShowMaterials] = useState(null);
  const [showTimeLog, setShowTimeLog] = useState(null);
  const [showPreview, setShowPreview] = useState(null);
  const [showExecution, setShowExecution] = useState(null);

  const load = async () => {
    const u = await User.me(); setUser(u);
    const cs = await Contract.filter({ cnpj: u.cnpj });
    setContracts(cs);
    const data = await ServiceOrder.filter({ cnpj: u.cnpj }, "-created_date");
    setList(data.map(o => ({
      ...o,
      contract_name: cs.find(c=>c.id===o.contract_id)?.name || "",
      contract_number: o.contract_number || cs.find(c=>c.id===o.contract_id)?.contract_number
    })));
  };

  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=> {
    return list.filter(o=>{
      const s = search.trim().toLowerCase();
      const okSearch = !s || [o.os_number, o.contract_name, o.unit_name, o.description].some(v=> (v||"").toLowerCase().includes(s));
      const okContract = filterContract==="all" || o.contract_id===filterContract;
      const okStatus = filterStatus==="all" || o.status===filterStatus;
      const okPriority = filterPriority==="all" || o.priority===filterPriority;
      const okType = filterType==="all" || o.service_type===filterType;
      const okUnit = !filterUnit || (o.unit_name||"").toLowerCase().includes(filterUnit.toLowerCase());
      const okFrom = !from || (o.opened_at && o.opened_at.slice(0,10) >= from);
      const okTo = !to || (o.opened_at && o.opened_at.slice(0,10) <= to);
      return okSearch && okContract && okStatus && okPriority && okType && okUnit && okFrom && okTo;
    });
  }, [list, search, filterContract, filterStatus, filterPriority, filterType, filterUnit, from, to]);

  const totals = useMemo(()=> {
    const open = filtered.filter(o=>o.status==="Aberta").length;
    const progress = filtered.filter(o=>o.status==="Em Andamento").length;
    const closed = filtered.filter(o=>o.status==="Concluída").length;
    const slaVals = filtered.filter(o=>o.status==="Concluída" && o.opened_at && o.closed_at)
      .map(o=> (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime())/(1000*60*60*24));
    const avgSLA = slaVals.length ? (slaVals.reduce((a,b)=>a+b,0)/slaVals.length) : 0;
    return { open, progress, closed, avgSLA };
  }, [filtered]);

  const fmtMoney = (v)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Buscar</label>
          <Input placeholder="Nº OS, contrato, unidade, descrição..." value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>
        <div className="w-full md:w-52">
          <label className="text-sm font-medium">Contrato</label>
          <Select value={filterContract} onValueChange={setFilterContract}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {contracts.map(c=>(<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <label className="text-sm font-medium">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Aberta">Aberta</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Aguardando Aprovação">Aguardando Aprovação</SelectItem>
              <SelectItem value="Concluída">Concluída</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <label className="text-sm font-medium">Prioridade</label>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Baixa">Baixa</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Crítica">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-48">
          <label className="text-sm font-medium">Tipo</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="manutencao">Manutenção</SelectItem>
              <SelectItem value="limpeza">Limpeza</SelectItem>
              <SelectItem value="eletrica">Elétrica</SelectItem>
              <SelectItem value="hidraulica">Hidráulica</SelectItem>
              <SelectItem value="ar_condicionado">Ar-condicionado</SelectItem>
              <SelectItem value="administrativo">Administrativo</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-sm font-medium">De</label>
          <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Até</label>
          <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Unidade</label>
          <Input placeholder="Filtrar por unidade" value={filterUnit} onChange={(e)=>setFilterUnit(e.target.value)} />
        </div>
      </div>

      <OSStats totals={totals} />

      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={()=>{ setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Abrir Nova OS
          </Button>
          <Button variant="outline">📊 Relatórios OS</Button>
        </div>
        <div className="text-sm text-muted-foreground self-center">{filtered.length} OS encontradas</div>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de Ordens de Serviço</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OS</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Materiais</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o=>(
                <TableRow key={o.id}>
                  <TableCell className="font-mono">{o.os_number}</TableCell>
                  <TableCell>{o.contract_name}</TableCell>
                  <TableCell>{o.unit_name}</TableCell>
                  <TableCell className="capitalize">{o.service_type}</TableCell>
                  <TableCell>
                    <Badge className={
                      o.priority==="Crítica" ? "bg-red-100 text-red-700" :
                      o.priority==="Alta" ? "bg-orange-100 text-orange-700" :
                      o.priority==="Média" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                    }>{o.priority}</Badge>
                  </TableCell>
                  <TableCell>{o.opened_at?.slice(0,16).replace("T"," ")}</TableCell>
                  <TableCell className="capitalize">{o.status || "Aberta"}</TableCell>
                  <TableCell className="font-semibold">{fmtMoney(o.total_material_cost || 0)}</TableCell>
                  <TableCell className="font-semibold">{o.total_hours || 0}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={()=>{ setEditing(o); setShowForm(true); }}>Editar</Button>
                    <Button variant="outline" size="sm" onClick={()=>setShowChecklist(o.id)}><ListChecks className="w-4 h-4 mr-1" />Checklist</Button>
                    <Button variant="outline" size="sm" onClick={()=>setShowMaterials(o.id)}>Materiais</Button>
                    <Button variant="outline" size="sm" onClick={()=>setShowTimeLog(o.id)}>Horas</Button>
                    <Button variant="outline" size="sm" onClick={()=>setShowExecution(o)}><MapPin className="w-4 h-4 mr-1" />Execução</Button>
                    <Button variant="outline" size="sm" onClick={()=>setShowPreview(o)}> <Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length===0 && (<TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground">Nenhuma OS encontrada com os filtros atuais.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar OS" : "Abrir Nova OS"}</DialogTitle></DialogHeader>
          <OSForm os={editing} onSaved={()=>{ setShowForm(false); setEditing(null); load(); }} onCancel={()=>{ setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showChecklist} onOpenChange={(v)=>{ if(!v) setShowChecklist(null); }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>Checklist de Execução</DialogTitle></DialogHeader>
          {showChecklist && <ChecklistManager serviceOrderId={showChecklist} onChanged={load} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showMaterials} onOpenChange={(v)=>{ if(!v) setShowMaterials(null); }}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader><DialogTitle>Materiais Usados</DialogTitle></DialogHeader>
          {showMaterials && <MaterialsManager serviceOrderId={showMaterials} onChanged={load} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showTimeLog} onOpenChange={(v)=>{ if(!v) setShowTimeLog(null); }}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader><DialogTitle>Horas/Homem</DialogTitle></DialogHeader>
          {showTimeLog && <TimeLogManager serviceOrderId={showTimeLog} onChanged={load} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showExecution} onOpenChange={(v)=>{ if(!v) setShowExecution(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Execução em Campo — {showExecution?.os_number}</DialogTitle></DialogHeader>
          {showExecution && (
            <ExecutionPanel
              os={showExecution}
              onChanged={(updated) => { setShowExecution(updated); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPreview} onOpenChange={(v)=>{ if(!v) setShowPreview(null); }}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
          {showPreview && <OSPreview os={showPreview} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}