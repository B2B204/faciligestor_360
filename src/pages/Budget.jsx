import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Budget as BudgetEntity } from '@/entities/Budget';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { IndirectCost } from '@/entities/IndirectCost';
import { User } from '@/entities/User';
import {
  Wallet, Plus, Edit2, Trash2, TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const CATEGORY_LABELS = {
  fornecedor: 'Fornecedor',
  aluguel: 'Aluguel',
  salarios: 'Salários',
  impostos: 'Impostos',
  servicos: 'Serviços',
  energia: 'Energia Elétrica',
  internet: 'Internet/Telefone',
  marketing: 'Marketing/Publicidade',
  contador: 'Contador/Jurídico',
  sistemas: 'Sistemas/Software',
  depreciacao: 'Depreciação de Ativos',
  outros: 'Outros',
};

const fmt = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const EMPTY_FORM = { category: 'aluguel', cost_center: '', budgeted_amount: '', notes: '' };

function BudgetDialog({ open, onOpenChange, initial, month, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  }, [initial, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.category || !form.budgeted_amount) {
      alert('Informe categoria e valor orçado.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, budgeted_amount: Number(form.budgeted_amount) || 0, competence_month: month });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> {initial ? 'Editar Orçamento' : 'Novo Orçamento'} — {monthLabel(month)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria / Centro de Custo *</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)} disabled={!!initial}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Centro de Custo (opcional)</Label>
            <Input value={form.cost_center} onChange={(e) => set('cost_center', e.target.value)} placeholder="Ex: Filial Centro, Contrato 001…" className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor Orçado (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={form.budgeted_amount} onChange={(e) => set('budgeted_amount', e.target.value)} className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="bg-background border-border resize-none" />
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

export default function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [payables, setPayables] = useState([]);
  const [indirectCosts, setIndirectCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCnpj, setUserCnpj] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await User.me();
    setUserCnpj(me?.cnpj || '');
    const [bgs, ap, ic] = await Promise.all([
      BudgetEntity.filter({ cnpj: me?.cnpj, competence_month: month }),
      AccountsPayable.filter({ cnpj: me?.cnpj }),
      IndirectCost.filter({ cnpj: me?.cnpj }),
    ]);
    setBudgets(bgs || []);
    setPayables(ap || []);
    setIndirectCosts(ic || []);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const byCategory = {};
    Object.keys(CATEGORY_LABELS).forEach((cat) => {
      byCategory[cat] = { category: cat, label: CATEGORY_LABELS[cat], budgeted: 0, budgetId: null, realizedPayable: 0, realizedIndirect: 0 };
    });

    budgets.forEach((b) => {
      if (byCategory[b.category]) {
        byCategory[b.category].budgeted = Number(b.budgeted_amount || 0);
        byCategory[b.category].budgetId = b.id;
        byCategory[b.category].raw = b;
      }
    });

    payables
      .filter((p) => p.competence_month === month)
      .forEach((p) => {
        const cat = p.category || 'outros';
        if (!byCategory[cat]) byCategory[cat] = { category: cat, label: CATEGORY_LABELS[cat] || cat, budgeted: 0, budgetId: null, realizedPayable: 0, realizedIndirect: 0 };
        byCategory[cat].realizedPayable += Number(p.face_value || 0);
      });

    indirectCosts
      .filter((c) => c.status === 'ativo')
      .forEach((c) => {
        const cat = c.cost_type || 'outros';
        if (!byCategory[cat]) byCategory[cat] = { category: cat, label: CATEGORY_LABELS[cat] || cat, budgeted: 0, budgetId: null, realizedPayable: 0, realizedIndirect: 0 };
        byCategory[cat].realizedIndirect += Number(c.monthly_value || 0);
      });

    return Object.values(byCategory)
      .map((r) => ({ ...r, realizedTotal: r.realizedPayable + r.realizedIndirect, variance: r.budgeted - (r.realizedPayable + r.realizedIndirect) }))
      .filter((r) => r.budgeted > 0 || r.realizedTotal > 0)
      .sort((a, b) => b.realizedTotal - a.realizedTotal);
  }, [budgets, payables, indirectCosts, month]);

  const kpis = useMemo(() => ({
    totalBudgeted: rows.reduce((s, r) => s + r.budgeted, 0),
    totalRealized: rows.reduce((s, r) => s + r.realizedTotal, 0),
    overBudgetCount: rows.filter((r) => r.budgeted > 0 && r.realizedTotal > r.budgeted).length,
  }), [rows]);

  const handleCreate = async (data) => {
    await BudgetEntity.create({ ...data, cnpj: userCnpj });
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleUpdate = async (data) => {
    await BudgetEntity.update(editing.budgetId, data);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (row) => {
    if (!row.budgetId) return;
    if (!window.confirm(`Remover orçamento de "${row.label}" para ${monthLabel(month)}?`)) return;
    await BudgetEntity.delete(row.budgetId);
    await load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Orçamento
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Orçado x Realizado por categoria / centro de custo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2 capitalize min-w-[140px] text-center">{monthLabel(month)}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Orçado</p>
            <p className="text-2xl font-bold mt-1 text-foreground">R$ {fmt(kpis.totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Realizado</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.totalRealized > kpis.totalBudgeted && kpis.totalBudgeted > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              R$ {fmt(kpis.totalRealized)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Categorias Estouradas</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.overBudgetCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{kpis.overBudgetCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Wallet className="w-10 h-10 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum orçamento definido para {monthLabel(month)}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Cadastre valores orçados por categoria e compare com os gastos reais de Contas a Pagar e Custos Indiretos.
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Novo Orçamento
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Categoria</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Orçado</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Realizado (Contas a Pagar)</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Custo Indireto Recorrente</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Realizado Total</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Saldo</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const pct = r.budgeted > 0 ? (r.realizedTotal / r.budgeted) * 100 : null;
                    const over = r.budgeted > 0 && r.realizedTotal > r.budgeted;
                    return (
                      <TableRow key={r.category} className="border-border hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground text-sm">
                          <div className="flex items-center gap-2">
                            {r.label}
                            {over && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          {pct !== null && (
                            <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">R$ {fmt(r.budgeted)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">R$ {fmt(r.realizedPayable)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">R$ {fmt(r.realizedIndirect)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">R$ {fmt(r.realizedTotal)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${r.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          <span className="inline-flex items-center gap-1 justify-end">
                            {r.variance < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                            R$ {fmt(Math.abs(r.variance))}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditing(r); setShowForm(true); }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {r.budgetId && (
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                                onClick={() => handleDelete(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BudgetDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        initial={editing ? {
          category: editing.category,
          budgeted_amount: editing.budgeted || '',
          cost_center: editing.raw?.cost_center || '',
          notes: editing.raw?.notes || '',
        } : null}
        month={month}
        onSave={editing?.budgetId ? handleUpdate : handleCreate}
      />
    </div>
  );
}
