import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AccountsPayable as APEntity } from '@/entities/AccountsPayable';
import { BankAccount } from '@/entities/BankAccount';
import { CostCenter } from '@/entities/CostCenter';
import { User } from '@/entities/User';
import { PayablePayment } from '@/entities/PayablePayment';
import { generateDueRecurringEntries } from '@/lib/recurringGenerator';
import { format, differenceInDays, startOfDay, addMonths, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CreditCard, Plus, Search, X, ChevronDown, ChevronUp, CheckCircle2,
  Edit2, Trash2, MoreVertical, AlertCircle, Clock, Ban, DollarSign,
  CalendarDays, TrendingDown, AlertTriangle, Layers, ArrowLeft, ArrowRight,
  Save, XCircle, History as HistoryIcon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import NewPayableDialog from '@/components/payables/NewPayableDialog';
import CnpjLookupInput from '@/components/common/CnpjLookupInput';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const TODAY = startOfDay(new Date());
const TODAY_STR = format(TODAY, 'yyyy-MM-dd');

const STATUS_CONFIG = {
  aberto:    { label: 'Aberto',    bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  pago:      { label: 'Pago',      bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  vencido:   { label: 'Vencido',   bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  parcial:   { label: 'Parcial',   bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  cancelado: { label: 'Cancelado', bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const CATEGORY_CONFIG = {
  fornecedor: { label: 'Fornecedor', bg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  aluguel:    { label: 'Aluguel',    bg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  salarios:   { label: 'Salários',   bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  impostos:   { label: 'Impostos',   bg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  servicos:   { label: 'Serviços',   bg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  outros:     { label: 'Outros',     bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) =>
  Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fmtDate = (str) => {
  if (!str) return '—';
  try { return format(parseISO(str), 'dd/MM/yyyy'); } catch { return str; }
};

const dueDateColor = (due_date, status) => {
  if (!due_date || status === 'pago' || status === 'cancelado') return 'text-foreground';
  const d = startOfDay(parseISO(due_date));
  const diff = differenceInDays(d, TODAY);
  if (diff < 0) return 'text-red-600 dark:text-red-400 font-semibold';
  if (diff === 0) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-foreground';
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>;
}

function CategoryBadge({ category }) {
  const cfg = CATEGORY_CONFIG[category] || { label: category, bg: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>;
}

function KpiCard({ title, value, sub, colorClass, icon: Icon }) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          {Icon && (
            <div className="ml-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Icon className={`w-4 h-4 ${colorClass}`} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="border-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Pay Dialog ───────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'outros', label: 'Outros' },
];

function PayDialog({ open, onOpenChange, item, banks, onConfirm }) {
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(TODAY_STR);
  const [method, setMethod] = useState('pix');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openAmount = item ? Number(item.open_amount ?? item.face_value ?? 0) : 0;

  useEffect(() => {
    if (item) {
      setBankId(item.bank_account_id || (banks[0]?.id ?? ''));
      setAmount(String(Number(item.open_amount ?? item.face_value ?? 0).toFixed(2)));
      setDate(TODAY_STR);
      setMethod('pix');
      setNotes('');
    }
  }, [item, banks]);

  const handle = async () => {
    setSaving(true);
    try { await onConfirm({ bankId, amount: Number(amount), date, method, notes }); }
    finally { setSaving(false); }
  };

  const isPartial = Number(amount) > 0 && Number(amount) < openAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> Registrar Pagamento
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium text-foreground">{item.supplier_name}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{item.document_number} · Venc. {fmtDate(item.due_date)}</p>
              <p className="text-muted-foreground text-xs mt-0.5">Em aberto: <strong className="text-foreground">R$ {fmt(openAmount)}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Conta Bancária</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor Pago (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data de Pagamento</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
            {isPartial && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Pagamento parcial — restará R$ {fmt(openAmount - Number(amount))} em aberto.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observação</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" className="bg-background border-border" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving || !Number(amount)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment History Dialog ───────────────────────────────────────────────────

function PaymentHistoryDialog({ open, onOpenChange, item, banks }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setLoading(true);
      PayablePayment.filter({ payable_id: item.id }, '-payment_date')
        .then(setPayments)
        .finally(() => setLoading(false));
    }
  }, [open, item]);

  const bankName = (id) => banks.find(b => b.id === id)?.bank_name || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" /> Histórico de Pagamentos
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm mb-1">
            <p className="font-medium text-foreground">{item.supplier_name}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{item.document_number} · Valor total R$ {fmt(item.face_value)}</p>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                  <TableHead className="text-xs text-muted-foreground py-2 pl-3">Data</TableHead>
                  <TableHead className="text-xs text-muted-foreground py-2">Forma</TableHead>
                  <TableHead className="text-xs text-muted-foreground py-2">Conta</TableHead>
                  <TableHead className="text-xs text-muted-foreground py-2 text-right pr-3">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="py-1.5 pl-3 text-sm">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="py-1.5 text-sm capitalize">{p.method || '—'}</TableCell>
                    <TableCell className="py-1.5 text-sm">{bankName(p.bank_account_id)}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-sm text-right font-medium">R$ {fmt(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditDialog({ open, onOpenChange, item, banks, costCenters = [], onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setForm({ ...item });
  }, [item]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-primary" /> Editar Conta a Pagar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Fornecedor</Label>
              <Input value={form.supplier_name || ''} onChange={e => set('supplier_name', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Documento</Label>
              <Input value={form.document_number || ''} onChange={e => set('document_number', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CNPJ Fornecedor</Label>
              <CnpjLookupInput
                value={form.supplier_cnpj || ''}
                onChange={e => set('supplier_cnpj', e.target.value)}
                onFound={(data) => set('supplier_name', form.supplier_name || data.nome || form.supplier_name)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor Face (R$)</Label>
              <Input type="number" step="0.01" value={form.face_value || ''} onChange={e => set('face_value', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Em Aberto (R$)</Label>
              <Input type="number" step="0.01" value={form.open_amount || ''} onChange={e => set('open_amount', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vencimento</Label>
              <Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Emissão</Label>
              <Input type="date" value={form.issue_date || ''} onChange={e => set('issue_date', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={form.category || ''} onValueChange={v => set('category', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status || ''} onValueChange={v => set('status', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Conta Bancária</Label>
              <Select value={form.bank_account_id || ''} onValueChange={v => set('bank_account_id', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Centro de Custo</Label>
              <Select value={form.cost_center_id || ''} onValueChange={v => set('cost_center_id', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                <SelectContent>
                  {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.observations || ''} onChange={e => set('observations', e.target.value)} rows={2} className="bg-background border-border resize-none" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({ open, onOpenChange, item, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" /> Excluir Conta
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Deseja excluir o lançamento <strong className="text-foreground">{item?.supplier_name}</strong> — {item?.document_number}? Esta ação não pode ser desfeita.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button variant="destructive" onClick={handle} disabled={loading} className="gap-2">
            <Trash2 className="w-4 h-4" />
            {loading ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Pay Dialog ──────────────────────────────────────────────────────────

function BulkPayDialog({ open, onOpenChange, count, banks, onConfirm }) {
  const [bankId, setBankId] = useState('');
  const [date, setDate] = useState(TODAY_STR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (banks.length) setBankId(banks[0].id);
  }, [banks]);

  const handle = async () => {
    setSaving(true);
    try { await onConfirm({ bankId, date }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> Baixar em Lote
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Confirmar pagamento de <strong className="text-foreground">{count} {count === 1 ? 'conta' : 'contas'}</strong>?</p>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Conta Bancária</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data de Pagamento</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-background border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving || !bankId} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Processando…' : `Confirmar ${count} pagamento${count !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Parcelamento Dialog ──────────────────────────────────────────────────────

function ParcelamentoDialog({ open, onOpenChange, onCreated, userCnpj }) {
  const EMPTY = { supplier_name: '', description: '', total: '', parcelas: '2', first_due: TODAY_STR, category: 'fornecedor' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    const n = parseInt(form.parcelas, 10);
    const total = parseFloat(form.total);
    if (!n || !total || !form.first_due || isNaN(total)) return [];
    const each = Math.round((total / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => {
      const due = format(addMonths(parseISO(form.first_due), i), 'yyyy-MM-dd');
      const value = i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each;
      return { i: i + 1, due, value };
    });
  }, [form.parcelas, form.total, form.first_due]);

  const handle = async () => {
    if (!form.supplier_name || !form.total || !form.first_due) return;
    setSaving(true);
    try {
      const rows = preview.map(p => ({
        supplier_name: form.supplier_name,
        document_number: `${form.description || form.supplier_name} ${p.i}/${preview.length}`,
        due_date: p.due,
        face_value: p.value,
        open_amount: p.value,
        paid_amount: 0,
        status: 'aberto',
        category: form.category,
        cnpj: userCnpj,
      }));
      await APEntity.bulkCreate(rows);
      setForm(EMPTY);
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Parcelamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Fornecedor *</Label>
              <Input value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="Nome do fornecedor" className="bg-background border-border" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição / Referência</Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Contrato 001, NF 1234…" className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor Total (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={form.total} onChange={e => set('total', e.target.value)} placeholder="0,00" className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº de Parcelas *</Label>
              <Select value={form.parcelas} onValueChange={v => set('parcelas', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 35 }, (_, i) => i + 2).map(n => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vencimento 1ª Parcela *</Label>
              <Input type="date" value={form.first_due} onChange={e => set('first_due', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prévia das Parcelas</p>
              <div className="rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                      <TableHead className="text-xs text-muted-foreground py-2 pl-3">Parcela</TableHead>
                      <TableHead className="text-xs text-muted-foreground py-2">Vencimento</TableHead>
                      <TableHead className="text-xs text-muted-foreground py-2 text-right pr-3">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map(p => (
                      <TableRow key={p.i} className="border-border">
                        <TableCell className="py-1.5 pl-3 text-sm">{p.i}/{preview.length}</TableCell>
                        <TableCell className="py-1.5 text-sm">{fmtDate(p.due)}</TableCell>
                        <TableCell className="py-1.5 pr-3 text-sm text-right font-medium">R$ {fmt(p.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                Total: <strong className="text-foreground">R$ {fmt(preview.reduce((s, p) => s + p.value, 0))}</strong>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button
            onClick={handle}
            disabled={saving || !form.supplier_name || !form.total || preview.length === 0}
            className="gap-2"
          >
            <Layers className="w-4 h-4" />
            {saving ? 'Criando…' : `Criar ${preview.length} parcela${preview.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aging Table ──────────────────────────────────────────────────────────────

function AgingTable({ items }) {
  const [open, setOpen] = useState(false);

  const unpaid = items.filter(p => p.status !== 'pago' && p.status !== 'cancelado' && p.due_date);

  const buckets = useMemo(() => {
    const today = { label: 'Vence hoje', color: 'text-orange-600', count: 0, total: 0 };
    const b30    = { label: '1–30 dias vencido', color: 'text-amber-600', count: 0, total: 0 };
    const b60    = { label: '31–60 dias vencido', color: 'text-orange-600', count: 0, total: 0 };
    const b90    = { label: '61–90 dias vencido', color: 'text-red-600', count: 0, total: 0 };
    const b90p   = { label: '90+ dias vencido', color: 'text-red-700 font-semibold', count: 0, total: 0 };

    unpaid.forEach(p => {
      const diff = differenceInDays(TODAY, startOfDay(parseISO(p.due_date)));
      const v = Number(p.open_amount || p.face_value || 0);
      if (diff === 0)       { today.count++; today.total += v; }
      else if (diff <= 30)  { b30.count++;   b30.total += v; }
      else if (diff <= 60)  { b60.count++;   b60.total += v; }
      else if (diff <= 90)  { b90.count++;   b90.total += v; }
      else if (diff > 90)   { b90p.count++;  b90p.total += v; }
    });

    return [today, b30, b60, b90, b90p].filter(b => b.count > 0);
  }, [unpaid]);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-4 px-4">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">Análise de Aging</CardTitle>
            {buckets.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full px-2 py-0.5">
                {buckets.reduce((s, b) => s + b.count, 0)} vencido{buckets.reduce((s, b) => s + b.count, 0) !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="p-4 pt-3">
          {buckets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum título em atraso. Tudo em dia!</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="text-xs text-muted-foreground py-2 pl-3">Faixa</TableHead>
                    <TableHead className="text-xs text-muted-foreground py-2 text-center">Qtd</TableHead>
                    <TableHead className="text-xs text-muted-foreground py-2 text-right pr-3">Total em Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((b, i) => (
                    <TableRow key={i} className="border-border hover:bg-muted/20">
                      <TableCell className={`py-2 pl-3 text-sm ${b.color}`}>{b.label}</TableCell>
                      <TableCell className="py-2 text-center text-sm text-muted-foreground">{b.count}</TableCell>
                      <TableCell className={`py-2 pr-3 text-sm text-right font-semibold ${b.color}`}>R$ {fmt(b.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPayable() {
  const [allItems, setAllItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCnpj, setUserCnpj] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterPeriod, setFilterPeriod] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Dialogs
  const [showNew, setShowNew] = useState(false);
  const [showParcelamento, setShowParcelamento] = useState(false);
  const [payItem, setPayItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [showBulkPay, setShowBulkPay] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);

  // Action menus
  const [openMenu, setOpenMenu] = useState(null);

  const debounceRef = useRef(null);
  const menuRef = useRef(null);

  // ── Load ──
  const load = useCallback(async () => {
    const me = await User.me();
    if (me?.cnpj) await generateDueRecurringEntries(me.cnpj);
    const [rows, bks, ccs] = await Promise.all([
      APEntity.list('-updated_at', 5000),
      BankAccount.list('-updated_at', 200),
      me?.cnpj ? CostCenter.filter({ cnpj: me.cnpj }, '-created_at') : Promise.resolve([]),
    ]);
    setAllItems(rows || []);
    setBanks(bks || []);
    setCostCenters(ccs || []);
    setUserCnpj(me?.cnpj || '');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Debounce search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Filter ──
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(p => {
      if (q && !((p.supplier_name || '').toLowerCase().includes(q)) && !((p.document_number || '').toLowerCase().includes(q))) return false;
      if (filterStatus !== 'todos' && p.status !== filterStatus) return false;
      if (filterCategory !== 'todos' && p.category !== filterCategory) return false;
      if (filterPeriod !== 'todos' && p.due_date) {
        const d = startOfDay(parseISO(p.due_date));
        const now = TODAY;
        if (filterPeriod === 'mes') {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          if (isBefore(d, start) || isAfter(d, end)) return false;
        } else if (filterPeriod === 'prox30') {
          const end = addMonths(now, 1);
          if (isBefore(d, now) || isAfter(d, end)) return false;
        } else if (filterPeriod === 'vencidos') {
          if (!isBefore(d, now) || p.status === 'pago' || p.status === 'cancelado') return false;
        } else if (filterPeriod === 'custom') {
          if (dateFrom && isBefore(d, startOfDay(parseISO(dateFrom)))) return false;
          if (dateTo && isAfter(d, startOfDay(parseISO(dateTo)))) return false;
        }
      }
      return true;
    });
  }, [allItems, debouncedSearch, filterStatus, filterCategory, filterPeriod, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const currentMonth = format(TODAY, 'yyyy-MM');
    return {
      totalAberto: allItems
        .filter(p => ['aberto', 'parcial', 'vencido'].includes(p.status))
        .reduce((s, p) => s + Number(p.open_amount || p.face_value || 0), 0),
      totalVencido: allItems
        .filter(p => p.status === 'vencido')
        .reduce((s, p) => s + Number(p.open_amount || p.face_value || 0), 0),
      totalPagoMes: allItems
        .filter(p => p.status === 'pago' && (p.payment_date || '').startsWith(currentMonth))
        .reduce((s, p) => s + Number(p.paid_amount || p.face_value || 0), 0),
      vencendoHoje: allItems.filter(p =>
        p.due_date === TODAY_STR && p.status !== 'pago' && p.status !== 'cancelado'
      ).length,
    };
  }, [allItems]);

  // ── Selection ──
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length && paginated.every(p => selected.has(p.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map(p => p.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const isAllSelected = paginated.length > 0 && paginated.every(p => selected.has(p.id));

  // ── Mutations ──
  const handleCreate = async (data) => {
    await APEntity.create({
      supplier_name: data.supplier_name,
      supplier_cnpj: (data.supplier_cnpj || '').replace(/\D/g, ''),
      document_number: data.document_number || '',
      due_date: data.due_date,
      issue_date: data.issue_date || null,
      face_value: Number(data.face_value) || 0,
      open_amount: Number(data.face_value) || 0,
      paid_amount: 0,
      status: 'aberto',
      bank_account_id: data.bank_account_id || null,
      category: data.category || 'outros',
      cost_center_id: data.cost_center_id || null,
      observations: data.observations || '',
      cnpj: userCnpj,
    });
    setShowNew(false);
    await load();
  };

  const handlePay = async ({ bankId, amount, date, method, notes }) => {
    const fv = Number(payItem.face_value || 0);
    const paid = Number(amount);
    const currentOpen = Number(payItem.open_amount ?? fv);
    const remaining = Math.max(0, currentOpen - paid);
    const newStatus = remaining <= 0 ? 'pago' : 'parcial';
    const cumulativePaid = Number(payItem.paid_amount || 0) + paid;

    await PayablePayment.create({
      cnpj: userCnpj,
      payable_id: payItem.id,
      amount: paid,
      payment_date: date,
      method,
      bank_account_id: bankId || null,
      notes: notes || '',
    });

    await APEntity.update(payItem.id, {
      status: newStatus,
      paid_amount: cumulativePaid,
      open_amount: remaining,
      payment_date: date,
      bank_account_id: bankId || null,
    });
    setPayItem(null);
    await load();
  };

  const handleEdit = async (form) => {
    await APEntity.update(form.id, {
      supplier_name: form.supplier_name,
      supplier_cnpj: form.supplier_cnpj,
      document_number: form.document_number,
      due_date: form.due_date,
      issue_date: form.issue_date || null,
      face_value: Number(form.face_value) || 0,
      open_amount: Number(form.open_amount) || 0,
      status: form.status,
      bank_account_id: form.bank_account_id || null,
      category: form.category,
      cost_center_id: form.cost_center_id || null,
      observations: form.observations || '',
    });
    setEditItem(null);
    await load();
  };

  const handleDelete = async () => {
    await APEntity.delete(deleteItem.id);
    setDeleteItem(null);
    await load();
  };

  const handleBulkPay = async ({ bankId, date }) => {
    const ids = [...selected];
    const items = allItems.filter(p => ids.includes(p.id));
    await Promise.all(items.map(async (p) => {
      const amountDue = Number(p.open_amount ?? p.face_value ?? 0);
      await PayablePayment.create({
        cnpj: userCnpj,
        payable_id: p.id,
        amount: amountDue,
        payment_date: date,
        method: 'outros',
        bank_account_id: bankId || null,
        notes: 'Baixa em lote',
      });
      await APEntity.update(p.id, {
        status: 'pago',
        paid_amount: Number(p.paid_amount || 0) + amountDue,
        open_amount: 0,
        payment_date: date,
        bank_account_id: bankId || null,
      });
    }));
    setSelected(new Set());
    setShowBulkPay(false);
    await load();
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterStatus('todos');
    setFilterCategory('todos');
    setFilterPeriod('todos');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = search || filterStatus !== 'todos' || filterCategory !== 'todos' || filterPeriod !== 'todos';

  // ── Render ──
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" /> Contas a Pagar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie fornecedores, vencimentos e pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => setShowParcelamento(true)}>
            <Layers className="w-4 h-4" /> Parcelamento
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total a Pagar"
          value={`R$ ${fmt(kpis.totalAberto)}`}
          sub="Em aberto + parcial + vencido"
          colorClass="text-amber-600 dark:text-amber-400"
          icon={DollarSign}
        />
        <KpiCard
          title="Total Vencido"
          value={`R$ ${fmt(kpis.totalVencido)}`}
          sub="Status vencido"
          colorClass="text-red-600 dark:text-red-400"
          icon={AlertCircle}
        />
        <KpiCard
          title="Pago no Mês"
          value={`R$ ${fmt(kpis.totalPagoMes)}`}
          sub={`Mês atual — ${format(TODAY, 'MMM/yyyy', { locale: ptBR })}`}
          colorClass="text-green-600 dark:text-green-400"
          icon={CheckCircle2}
        />
        <KpiCard
          title="Vencendo Hoje"
          value={kpis.vencendoHoje}
          sub="Não pagos com venc. hoje"
          colorClass="text-orange-600 dark:text-orange-400"
          icon={CalendarDays}
        />
      </div>

      {/* ── Aging ── */}
      <AgingTable items={allItems} />

      {/* ── Filters ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor ou documento…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-background border-border h-9 text-sm"
              />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-9 bg-background border-border text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-9 bg-background border-border text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={v => { setFilterPeriod(v); setPage(1); }}>
              <SelectTrigger className="w-40 h-9 bg-background border-border text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os períodos</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="prox30">Próximos 30 dias</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {filterPeriod === 'custom' && (
              <>
                <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-36 h-9 bg-background border-border text-sm" />
                <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-36 h-9 bg-background border-border text-sm" />
              </>
            )}
            {hasFilters && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border text-muted-foreground hover:text-foreground shrink-0" onClick={clearFilters}>
                <X className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Bulk toolbar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.size} {selected.size === 1 ? 'item selecionado' : 'itens selecionados'}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-2 h-8" onClick={() => setShowBulkPay(true)}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Baixar em lote
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={clearSelection}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    {['', 'Fornecedor', 'Documento', 'Vencimento', 'Categoria', 'Valor', 'Em Aberto', 'Status', 'Ações'].map((h, i) => (
                      <TableHead key={i} className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
                </TableBody>
              </Table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {hasFilters ? 'Nenhum resultado encontrado' : 'Nenhuma conta a pagar'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                {hasFilters
                  ? 'Tente ajustar os filtros para encontrar o que procura.'
                  : 'Clique em "Nova Conta" para adicionar o primeiro lançamento.'}
              </p>
              {hasFilters ? (
                <Button variant="outline" size="sm" className="gap-2 border-border" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" /> Limpar filtros
                </Button>
              ) : (
                <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
                  <Plus className="w-4 h-4" /> Nova Conta
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAll}
                        className="border-border"
                      />
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Fornecedor</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Documento</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Vencimento</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Categoria</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Valor</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Em Aberto</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(p => {
                    const isSelected = selected.has(p.id);
                    const canPay = p.status !== 'pago' && p.status !== 'cancelado';
                    return (
                      <TableRow
                        key={p.id}
                        className={`border-border hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <TableCell className="pl-4 w-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(p.id)}
                            className="border-border"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground text-sm">{p.supplier_name || '—'}</div>
                          {p.supplier_cnpj && <div className="text-xs text-muted-foreground font-mono">{p.supplier_cnpj}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{p.document_number || '—'}</TableCell>
                        <TableCell>
                          <span className={`text-sm ${dueDateColor(p.due_date, p.status)}`}>{fmtDate(p.due_date)}</span>
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={p.category} />
                          {p.cost_center_id && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {costCenters.find(cc => cc.id === p.cost_center_id)?.name || '—'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">R$ {fmt(p.face_value)}</TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={Number(p.open_amount || 0) > 0 && p.status !== 'pago' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}>
                            R$ {fmt(p.open_amount)}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {canPay && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-border text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-900/30"
                                onClick={() => setPayItem(p)}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Pagar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditItem(p)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <div className="relative" ref={openMenu === p.id ? menuRef : null}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                              {openMenu === p.id && (
                                <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg bg-card border border-border shadow-lg py-1">
                                  <button
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                                    onClick={() => { setHistoryItem(p); setOpenMenu(null); }}
                                  >
                                    <HistoryIcon className="w-3.5 h-3.5" /> Histórico
                                  </button>
                                  <button
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-muted transition-colors"
                                    onClick={() => { setDeleteItem(p); setOpenMenu(null); }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                  </button>
                                  {canPay && (
                                    <button
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                                      onClick={async () => {
                                        setOpenMenu(null);
                                        await APEntity.update(p.id, { status: 'cancelado' });
                                        await load();
                                      }}
                                    >
                                      <Ban className="w-3.5 h-3.5" /> Cancelar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
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

      {/* ── Pagination ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-border"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Anterior
            </Button>
            <span className="px-3 text-xs font-medium">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-border"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Próxima <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <NewPayableDialog open={showNew} onOpenChange={setShowNew} banks={banks} costCenters={costCenters} onCreate={handleCreate} />

      <ParcelamentoDialog
        open={showParcelamento}
        onOpenChange={setShowParcelamento}
        onCreated={load}
        userCnpj={userCnpj}
      />

      <PayDialog
        open={!!payItem}
        onOpenChange={v => !v && setPayItem(null)}
        item={payItem}
        banks={banks}
        onConfirm={handlePay}
      />

      <EditDialog
        open={!!editItem}
        onOpenChange={v => !v && setEditItem(null)}
        item={editItem}
        banks={banks}
        costCenters={costCenters}
        onSave={handleEdit}
      />

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={v => !v && setDeleteItem(null)}
        item={deleteItem}
        onConfirm={handleDelete}
      />

      <BulkPayDialog
        open={showBulkPay}
        onOpenChange={setShowBulkPay}
        count={selected.size}
        banks={banks}
        onConfirm={handleBulkPay}
      />

      <PaymentHistoryDialog
        open={!!historyItem}
        onOpenChange={v => !v && setHistoryItem(null)}
        item={historyItem}
        banks={banks}
      />
    </div>
  );
}
