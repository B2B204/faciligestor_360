import React, { useEffect, useState } from "react";
import { CompanyCnpj } from "@/entities/CompanyCnpj";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Building2, ShieldAlert, Loader2 } from "lucide-react";

export default function CompanySettings() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ cnpj: "", display_name: "", is_active: true, notify_accounting: true });

  useEffect(() => {
    (async () => {
      const me = await User.me().catch(() => null);
      setUser(me);
      await load();
      setLoading(false);
    })();
  }, []);

  const load = async () => {
    const rows = await CompanyCnpj.list();
    setItems(rows || []);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md bg-card border-border shadow-sm text-center">
          <CardContent className="p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground text-sm">
              Somente administradores podem acessar as configurações da empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAdd = async () => {
    await CompanyCnpj.create(form);
    setForm({ cnpj: "", display_name: "", is_active: true, notify_accounting: true });
    await load();
  };

  const handleToggle = async (id, field, value) => {
    await CompanyCnpj.update(id, { [field]: value });
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este CNPJ?')) return;
    await CompanyCnpj.delete(id);
    await load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Configurações da Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os CNPJs cadastrados e suas configurações de integração contábil.
          </p>
        </div>
      </div>

      {/* Add New CNPJ */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Adicionar CNPJ
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Insira um novo CNPJ para vinculá-lo ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">CNPJ</Label>
              <Input
                className="bg-background border-border"
                placeholder="00.000.000/0001-00"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">Nome de Exibição</Label>
              <Input
                className="bg-background border-border"
                placeholder="Nome fantasia (opcional)"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!form.cnpj}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Adicionar CNPJ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CNPJ List */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            CNPJs Cadastrados
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {items.length === 0
              ? "Nenhum CNPJ cadastrado ainda."
              : `${items.length} CNPJ${items.length !== 1 ? 's' : ''} cadastrado${items.length !== 1 ? 's' : ''}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhum CNPJ cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione o primeiro CNPJ usando o formulário acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-medium">CNPJ</TableHead>
                    <TableHead className="text-muted-foreground font-medium">Nome</TableHead>
                    <TableHead className="text-muted-foreground font-medium">Ativo</TableHead>
                    <TableHead className="text-muted-foreground font-medium">Enviar à contabilidade</TableHead>
                    <TableHead className="text-right text-muted-foreground font-medium">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{it.cnpj}</TableCell>
                      <TableCell className="text-muted-foreground">{it.display_name || <span className="italic text-muted-foreground/60">—</span>}</TableCell>
                      <TableCell>
                        <Switch
                          checked={!!it.is_active}
                          onCheckedChange={(v) => handleToggle(it.id, 'is_active', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!it.notify_accounting}
                          onCheckedChange={(v) => handleToggle(it.id, 'notify_accounting', v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(it.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
