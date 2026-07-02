import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RecurringTemplate } from '@/entities/RecurringTemplate';
import { BankAccount } from '@/entities/BankAccount';
import { User } from '@/entities/User';
import { generateDueRecurringEntries } from '@/lib/recurringGenerator';
import { format } from 'date-fns';
import {
  Repeat, Plus, Trash2, Edit2, Play, Pause, RefreshCw, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const CATEGORY_OPTIONS = [
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'salarios', label: 'Salários' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'outros', label: 'Outros' },
];

const fmt = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const EMPTY_FORM = {
  type: 'payable',
  name: '',
  party_name: '',
  category: 'aluguel',
  amount: '',
  day_of_month: '5',
  start_month: format(new Date(), 'yyyy-MM'),
  end_month: '',
  bank_account_id: '',
  notes: '',
};

function TemplateDialog({ open, onOpenChange, initial, banks, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  }, [initial, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.name || !form.party_name || !form.amount || !form.start_month) {
      alert('Preencha Nome, Cliente/Fornecedor, Valor e Mês de início.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        amount: Number(form.amount) || 0,
        day_of_month: Number(form.day_of_month) || 1,
        end_month: form.end_month || null,
        bank_account_id: form.bank_account_id || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" /> {initial ? 'Editar Recorrência' : 'Nova Recorrência'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)} disabled={!!initial}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable">Conta a Pagar</SelectItem>
                  <SelectItem value="receivable">Conta a Receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Nome da Recorrência *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Aluguel da sede, Mensalidade Condomínio X" className="bg-background border-border" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">{form.type === 'payable' ? 'Fornecedor *' : 'Cliente *'}</Label>
              <Input value={form.party_name} onChange={(e) => set('party_name', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dia do Vencimento</Label>
              <Input type="number" min="1" max="28" value={form.day_of_month} onChange={(e) => set('day_of_month', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mês Inicial *</Label>
              <Input type="month" value={form.start_month} onChange={(e) => set('start_month', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mês Final (opcional)</Label>
              <Input type="month" value={form.end_month} onChange={(e) => set('end_month', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Conta Bancária</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => set('bank_account_id', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="bg-background border-border resize-none" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving} className="gap-2">
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RecurringTemplates() {
  const [templates, setTemplates] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userCnpj, setUserCnpj] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    const me = await User.me();
    setUserCnpj(me?.cnpj || '');
    const [tpls, bks] = await Promise.all([
      RecurringTemplate.filter({ cnpj: me?.cnpj }, '-created_at'),
      BankAccount.list('-updated_date', 200),
    ]);
    setTemplates(tpls || []);
    setBanks(bks || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateDueRecurringEntries(userCnpj);
      setLastResult(result);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  // Geração automática silenciosa ao entrar na página
  useEffect(() => {
    if (userCnpj) generateDueRecurringEntries(userCnpj).then(() => load());
  }, [userCnpj, load]);

  const handleCreate = async (data) => {
    await RecurringTemplate.create({ ...data, cnpj: userCnpj, is_active: true });
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleUpdate = async (data) => {
    await RecurringTemplate.update(editing.id, data);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleActive = async (tpl) => {
    await RecurringTemplate.update(tpl.id, { is_active: !tpl.is_active });
    await load();
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Excluir a recorrência "${tpl.name}"? Lançamentos já gerados não são afetados.`)) return;
    await RecurringTemplate.delete(tpl.id);
    await load();
  };

  const kpis = useMemo(() => ({
    ativas: templates.filter((t) => t.is_active).length,
    totalMensalPagar: templates.filter((t) => t.is_active && t.type === 'payable').reduce((s, t) => s + Number(t.amount || 0), 0),
    totalMensalReceber: templates.filter((t) => t.is_active && t.type === 'receivable').reduce((s, t) => s + Number(t.amount || 0), 0),
  }), [templates]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Repeat className="w-6 h-6 text-primary" /> Recorrências
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Templates de lançamentos recorrentes (aluguel, mensalidades) — geração automática de contas a pagar/receber
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border" onClick={handleGenerate} disabled={generating}>
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Gerando…' : 'Gerar Pendentes'}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Nova Recorrência
          </Button>
        </div>
      </div>

      {lastResult && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm text-primary">
          {lastResult.generated > 0
            ? `${lastResult.generated} lançamento(s) gerado(s) automaticamente a partir de ${lastResult.templatesProcessed} recorrência(s) ativa(s).`
            : 'Nenhum lançamento pendente — todas as recorrências já estão em dia.'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recorrências Ativas</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{kpis.ativas}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Mensal a Pagar</p>
            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">R$ {fmt(kpis.totalMensalPagar)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Mensal a Receber</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">R$ {fmt(kpis.totalMensalReceber)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Repeat className="w-10 h-10 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma recorrência cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Crie templates para gerar automaticamente aluguéis, mensalidades e outras contas recorrentes todo mês.
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Nova Recorrência
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cliente/Fornecedor</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Valor</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Dia Venc.</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Último Gerado</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground text-sm">{tpl.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 border-border">
                          {tpl.type === 'payable' ? <ArrowUpCircle className="w-3 h-3 text-amber-500" /> : <ArrowDownCircle className="w-3 h-3 text-green-500" />}
                          {tpl.type === 'payable' ? 'A Pagar' : 'A Receber'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.party_name}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-foreground">R$ {fmt(tpl.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.day_of_month}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.last_generated_month || '—'}</TableCell>
                      <TableCell>
                        <Badge className={tpl.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}>
                          {tpl.is_active ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => toggleActive(tpl)} title={tpl.is_active ? 'Pausar' : 'Ativar'}>
                            {tpl.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(tpl); setShowForm(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => handleDelete(tpl)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        initial={editing}
        banks={banks}
        onSave={editing ? handleUpdate : handleCreate}
      />
    </div>
  );
}
