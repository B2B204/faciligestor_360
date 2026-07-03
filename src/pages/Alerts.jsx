
import React, { useEffect, useState } from "react";
import { Alert as AlertEntity } from "@/entities/Alert";
import { User } from "@/entities/User";
import { generateOperationalAlerts } from "@/lib/alertsGenerator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, RefreshCw } from "lucide-react";

export default function AlertsPage() {
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [checking, setChecking] = useState(false);

  useEffect(()=>{ load(); },[]);
  const load = async ()=>{
    const me = await User.me();
    setUser(me);
    const data = await AlertEntity.filter({ cnpj: me.cnpj });
    setAlerts(data);
  };

  const checkNow = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await generateOperationalAlerts(user.cnpj, user.email);
      await load();
    } finally {
      setChecking(false);
    }
  };

  const markRead = async (a) => {
    await AlertEntity.update(a.id, { status: "read" });
    load();
  };

  const filtered = alerts.filter(a=>{
    const t = typeFilter==="all" || a.type===typeFilter;
    const s = statusFilter==="all" || a.status===statusFilter;
    return t && s;
  });

  const typeLabel = {
    contract_expiry:"Contrato vencendo",
    contract_readjustment_sla:"Reajuste com SLA estourado",
    employee_probation:"Período de experiência",
    insurance_expiry:"Seguro a vencer",
    laudo_expiry:"Laudo a vencer",
    custom:"Personalizado"
  };

  const severityColor = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-blue-100 text-blue-800",
  };

  const SLA_TYPES = ["contract_readjustment_sla"];
  const severityFor = (a) => {
    if (a.tier == null) return null;
    if (SLA_TYPES.includes(a.type)) {
      if (a.tier >= 90) return "high";
      if (a.tier >= 60) return "medium";
      return "low";
    }
    if (a.tier <= 30) return "high";
    if (a.tier <= 60) return "medium";
    return "low";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Alertas</h1>
          <p className="text-muted-foreground text-sm">Gerencie e acompanhe todos os alertas do sistema.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={checkNow} disabled={checking}>
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} /> {checking ? "Verificando…" : "Verificar Agora"}
        </Button>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <select className="border border-border rounded px-2 py-1 bg-card text-foreground" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="all">Todos os tipos</option>
              {Object.keys(typeLabel).map(k=><option key={k} value={k}>{typeLabel[k]}</option>)}
            </select>
            <select className="border border-border rounded px-2 py-1 bg-card text-foreground" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="pending">Pendentes</option>
              <option value="read">Lidos</option>
              <option value="all">Todos</option>
            </select>
            <Button variant="outline" onClick={load}>Atualizar</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="min-w-[180px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="min-w-[300px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Mensagem</TableHead>
                  <TableHead className="min-w-[100px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Urgência</TableHead>
                  <TableHead className="min-w-[140px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Vencimento</TableHead>
                  <TableHead className="min-w-[120px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Status</TableHead>
                  <TableHead className="min-w-[120px] text-muted-foreground text-xs font-medium uppercase tracking-wider">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a=>(
                  <TableRow key={a.id} className="border-border hover:bg-muted/50 transition-colors">
                    <TableCell>{typeLabel[a.type]||a.type}</TableCell>
                    <TableCell>{a.message}</TableCell>
                    <TableCell>
                      {a.tier != null ? (
                        <Badge className={severityColor[severityFor(a)] || "bg-muted text-muted-foreground"}>
                          {`${a.tier}d`}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{a.due_date ? new Date(a.due_date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Badge className={a.status==="pending"?"bg-amber-100 text-amber-800":"bg-muted text-muted-foreground"}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.status==="pending" && (
                        <Button size="sm" onClick={()=>markRead(a)}>Marcar como lido</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length===0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem alertas neste filtro.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
