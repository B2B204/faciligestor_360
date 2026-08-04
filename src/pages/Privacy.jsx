import React, { useEffect, useState } from "react";
import { User } from "@/entities/User";
import { DataSubjectRequest } from "@/entities/DataSubjectRequest";
import { DataAccessLog } from "@/entities/DataAccessLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, Plus, Loader2, ClipboardList, History } from "lucide-react";
import { format } from "date-fns";

const REQUEST_TYPE_LABELS = {
  acesso: "Acesso",
  correcao: "Correção",
  exportacao: "Exportação",
  exclusao: "Exclusão",
};

const STATUS_LABELS = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  rejeitado: "Rejeitado",
};

const STATUS_COLORS = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  em_andamento: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  concluido: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400",
  rejeitado: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400",
};

const ACTION_LABELS = {
  criacao: "Criação",
  edicao: "Edição",
  exclusao: "Exclusão",
  exportacao: "Exportação",
};

export default function PrivacyPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newRequest, setNewRequest] = useState({
    subject_name: "", subject_document: "", subject_email: "", request_type: "acesso", description: "",
  });

  const load = async (currentUser) => {
    const [reqs, accessLogs] = await Promise.all([
      DataSubjectRequest.filter({ cnpj: currentUser.cnpj }, "-created_at"),
      DataAccessLog.filter({ cnpj: currentUser.cnpj }, "-created_at", 300),
    ]);
    setRequests(reqs || []);
    setLogs(accessLogs || []);
  };

  useEffect(() => {
    (async () => {
      const me = await User.me().catch(() => null);
      setUser(me);
      if (me?.cnpj) await load(me);
      setLoading(false);
    })();
  }, []);

  const handleCreateRequest = async () => {
    if (!newRequest.subject_name.trim()) {
      alert("Informe o nome do titular dos dados.");
      return;
    }
    setSaving(true);
    try {
      await DataSubjectRequest.create({ ...newRequest, cnpj: user.cnpj, status: "pendente" });
      setNewRequest({ subject_name: "", subject_document: "", subject_email: "", request_type: "acesso", description: "" });
      setIsNewOpen(false);
      await load(user);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (req, status) => {
    setSaving(true);
    try {
      await DataSubjectRequest.update(req.id, {
        status,
        resolution_notes: resolutionNotes || req.resolution_notes || "",
        resolved_by: user.email,
        resolved_at: new Date().toISOString(),
      });
      setResolvingId(null);
      setResolutionNotes("");
      await load(user);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.department !== "admin") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md bg-card border-border shadow-sm text-center">
          <CardContent className="p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground text-sm">
              Somente administradores podem acessar as ferramentas de privacidade e LGPD.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Privacidade e LGPD
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitações do titular dos dados e log de auditoria de acesso a dados pessoais sensíveis.
          </p>
        </div>
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Solicitação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Solicitação do Titular</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome do Titular *</Label>
                <Input value={newRequest.subject_name} onChange={(e) => setNewRequest((s) => ({ ...s, subject_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF</Label>
                  <Input value={newRequest.subject_document} onChange={(e) => setNewRequest((s) => ({ ...s, subject_document: e.target.value }))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={newRequest.subject_email} onChange={(e) => setNewRequest((s) => ({ ...s, subject_email: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Tipo de Solicitação</Label>
                <Select value={newRequest.request_type} onValueChange={(v) => setNewRequest((s) => ({ ...s, request_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REQUEST_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={3} value={newRequest.description} onChange={(e) => setNewRequest((s) => ({ ...s, description: e.target.value }))} placeholder="Detalhes da solicitação recebida..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateRequest} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" className="gap-2"><ClipboardList className="w-4 h-4" /> Solicitações</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><History className="w-4 h-4" /> Log de Acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Solicitações do Titular dos Dados</CardTitle>
              <CardDescription>Pedidos de acesso, correção, exportação ou exclusão de dados pessoais (art. 18 da LGPD).</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma solicitação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titular</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recebido em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.subject_name}</div>
                          <div className="text-xs text-muted-foreground">{r.subject_document || r.subject_email}</div>
                        </TableCell>
                        <TableCell>{REQUEST_TYPE_LABELS[r.request_type] || r.request_type}</TableCell>
                        <TableCell><Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                        <TableCell>
                          {resolvingId === r.id ? (
                            <div className="flex flex-col gap-2 min-w-[220px]">
                              <Textarea
                                rows={2}
                                placeholder="Notas de resolução (opcional)"
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleResolve(r, "concluido")} disabled={saving}>Concluir</Button>
                                <Button size="sm" variant="outline" onClick={() => handleResolve(r, "rejeitado")} disabled={saving}>Rejeitar</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setResolvingId(null); setResolutionNotes(""); }}>Cancelar</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {r.status === "pendente" && (
                                <Button size="sm" variant="outline" onClick={() => handleResolve(r, "em_andamento")} disabled={saving}>
                                  Iniciar
                                </Button>
                              )}
                              {(r.status === "pendente" || r.status === "em_andamento") && (
                                <Button size="sm" onClick={() => { setResolvingId(r.id); setResolutionNotes(r.resolution_notes || ""); }}>
                                  Resolver
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Log de Acesso a Dados Sensíveis</CardTitle>
              <CardDescription>Registro de criação, edição e exclusão de dados pessoais de funcionários (últimos 300 eventos).</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm text-muted-foreground">{l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                        <TableCell className="text-sm">{l.actor_email || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{ACTION_LABELS[l.action] || l.action}</Badge></TableCell>
                        <TableCell className="text-sm">
                          <span className="text-muted-foreground">{l.resource_type}</span>{l.resource_label ? ` — ${l.resource_label}` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
